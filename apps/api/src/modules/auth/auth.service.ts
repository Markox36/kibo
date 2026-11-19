import { newUlid, nowUtc } from '@kibo/shared';
import { OAuth2Client } from 'google-auth-library';
import type { AuthRepository, UserDoc } from './auth.repository.js';
import type { EmailService } from '../email/email.service.js';
import type { Env } from '../../config/env.js';
import { hashPassword, verifyPassword, randomToken, sha256Hex } from '../../utils/crypto.js';
import type { AccessTokenPayload, RefreshTokenPayload } from '../../plugins/auth.plugin.js';
import type { FastifyInstance } from 'fastify';

const REFRESH_DAYS = 30;
const VERIFY_HOURS = 48;
const RESET_HOURS = 1;

function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}
function hoursFromNow(hours: number): Date {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

export class AuthError extends Error {
  constructor(
    public code: string,
    public statusCode: number,
    message?: string,
  ) {
    super(message ?? code);
  }
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export class AuthService {
  private google: OAuth2Client | null;
  private googleAudiences: string[] = [];

  constructor(
    private readonly app: FastifyInstance,
    private readonly repo: AuthRepository,
    private readonly email: EmailService,
    private readonly env: Env,
  ) {
    this.googleAudiences = [env.GOOGLE_CLIENT_ID, env.GOOGLE_DESKTOP_CLIENT_ID].filter(
      (v): v is string => !!v,
    );
    this.google = this.googleAudiences.length > 0 ? new OAuth2Client() : null;
  }

  private async issueTokens(userId: string, workspaceId: string): Promise<TokenPair> {
    const accessToken = this.app.jwt.sign(
      { sub: userId, workspaceId, type: 'access' } satisfies AccessTokenPayload,
      { expiresIn: this.env.JWT_ACCESS_EXPIRES_IN },
    );

    const jti = newUlid();
    const refreshToken = this.app.jwt.sign(
      { sub: userId, type: 'refresh', jti } satisfies RefreshTokenPayload,
      { expiresIn: this.env.JWT_REFRESH_EXPIRES_IN },
    );

    await this.repo.refreshTokens().insertOne({
      _id: jti,
      userId,
      tokenHash: sha256Hex(refreshToken),
      createdAt: nowUtc(),
      expiresAt: daysFromNow(REFRESH_DAYS),
      revokedAt: null,
      replacedBy: null,
    });

    return { accessToken, refreshToken };
  }

  private async ensureWorkspace(userId: string): Promise<string> {
    const existing = await this.repo.findWorkspaceByOwner(userId);
    if (existing) return existing._id;
    const id = newUlid();
    const now = nowUtc();
    await this.repo.workspaces().insertOne({
      _id: id,
      ownerUserId: userId,
      name: 'Personal',
      createdAt: now,
      updatedAt: now,
    });
    return id;
  }

  async register(input: {
    email: string;
    password: string;
    name?: string;
  }): Promise<{ tokens: TokenPair; user: UserDoc; workspaceId: string }> {
    const emailLower = input.email.toLowerCase();
    const existing = await this.repo.findUserByEmail(emailLower);
    if (existing) throw new AuthError('email_in_use', 409);

    const now = nowUtc();
    const user: UserDoc = {
      _id: newUlid(),
      email: input.email,
      emailLower,
      passwordHash: await hashPassword(input.password),
      name: input.name ?? null,
      emailVerifiedAt: null,
      googleId: null,
      createdAt: now,
      updatedAt: now,
    };
    await this.repo.users().insertOne(user);

    const workspaceId = await this.ensureWorkspace(user._id);
    await this.sendVerificationEmail(user);
    const tokens = await this.issueTokens(user._id, workspaceId);
    return { tokens, user, workspaceId };
  }

  async login(input: {
    email: string;
    password: string;
  }): Promise<{ tokens: TokenPair; user: UserDoc; workspaceId: string }> {
    const user = await this.repo.findUserByEmail(input.email);
    if (!user || !user.passwordHash) throw new AuthError('invalid_credentials', 401);
    const ok = await verifyPassword(user.passwordHash, input.password);
    if (!ok) throw new AuthError('invalid_credentials', 401);
    const workspaceId = await this.ensureWorkspace(user._id);
    const tokens = await this.issueTokens(user._id, workspaceId);
    return { tokens, user, workspaceId };
  }

  async refresh(refreshToken: string): Promise<TokenPair> {
    let payload: RefreshTokenPayload;
    try {
      payload = this.app.jwt.verify<RefreshTokenPayload>(refreshToken);
    } catch {
      throw new AuthError('invalid_refresh', 401);
    }
    if (payload.type !== 'refresh') throw new AuthError('invalid_refresh', 401);

    const existing = await this.repo.refreshTokens().findOne({ _id: payload.jti });
    if (!existing || existing.revokedAt || existing.tokenHash !== sha256Hex(refreshToken)) {
      // reuse detected — revoke all for this user
      await this.repo
        .refreshTokens()
        .updateMany({ userId: payload.sub, revokedAt: null }, { $set: { revokedAt: nowUtc() } });
      throw new AuthError('refresh_reused', 401);
    }

    const user = await this.repo.findUserById(payload.sub);
    if (!user) throw new AuthError('user_not_found', 401);
    const workspaceId = await this.ensureWorkspace(user._id);
    const tokens = await this.issueTokens(user._id, workspaceId);
    await this.repo
      .refreshTokens()
      .updateOne(
        { _id: payload.jti },
        { $set: { revokedAt: nowUtc(), replacedBy: sha256Hex(tokens.refreshToken) } },
      );
    return tokens;
  }

  async logout(refreshToken: string): Promise<void> {
    try {
      const payload = this.app.jwt.verify<RefreshTokenPayload>(refreshToken);
      if (payload.type !== 'refresh') return;
      await this.repo
        .refreshTokens()
        .updateOne({ _id: payload.jti }, { $set: { revokedAt: nowUtc() } });
    } catch {
      // ignore
    }
  }

  private async sendVerificationEmail(user: UserDoc): Promise<void> {
    const token = randomToken(32);
    await this.repo.emailTokens().insertOne({
      _id: newUlid(),
      userId: user._id,
      kind: 'verify',
      tokenHash: sha256Hex(token),
      createdAt: nowUtc(),
      expiresAt: hoursFromNow(VERIFY_HOURS),
      usedAt: null,
    });
    const url = `${this.env.API_PUBLIC_URL}/auth/verify-email?token=${token}`;
    await this.email.sendVerification(user.email, url);
  }

  async resendVerification(email: string): Promise<void> {
    const user = await this.repo.findUserByEmail(email);
    if (!user || user.emailVerifiedAt) return;
    await this.sendVerificationEmail(user);
  }

  async verifyEmail(token: string): Promise<void> {
    const tokenHash = sha256Hex(token);
    const doc = await this.repo
      .emailTokens()
      .findOne({ tokenHash, kind: 'verify', usedAt: null });
    if (!doc || doc.expiresAt.getTime() < Date.now()) throw new AuthError('invalid_token', 400);
    await this.repo.emailTokens().updateOne({ _id: doc._id }, { $set: { usedAt: nowUtc() } });
    await this.repo
      .users()
      .updateOne(
        { _id: doc.userId },
        { $set: { emailVerifiedAt: nowUtc(), updatedAt: nowUtc() } },
      );
  }

  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.repo.findUserByEmail(email);
    if (!user) return; // do not leak
    const token = randomToken(32);
    await this.repo.emailTokens().insertOne({
      _id: newUlid(),
      userId: user._id,
      kind: 'password_reset',
      tokenHash: sha256Hex(token),
      createdAt: nowUtc(),
      expiresAt: hoursFromNow(RESET_HOURS),
      usedAt: null,
    });
    const url = `${this.env.WEB_ORIGIN}/reset-password?token=${token}`;
    await this.email.sendPasswordReset(user.email, url);
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const tokenHash = sha256Hex(token);
    const doc = await this.repo
      .emailTokens()
      .findOne({ tokenHash, kind: 'password_reset', usedAt: null });
    if (!doc || doc.expiresAt.getTime() < Date.now()) throw new AuthError('invalid_token', 400);
    const passwordHash = await hashPassword(newPassword);
    await this.repo.emailTokens().updateOne({ _id: doc._id }, { $set: { usedAt: nowUtc() } });
    await this.repo
      .users()
      .updateOne({ _id: doc.userId }, { $set: { passwordHash, updatedAt: nowUtc() } });
    // revoke all refresh tokens
    await this.repo
      .refreshTokens()
      .updateMany({ userId: doc.userId, revokedAt: null }, { $set: { revokedAt: nowUtc() } });
  }

  async googleLogin(
    idToken: string,
  ): Promise<{ tokens: TokenPair; user: UserDoc; workspaceId: string }> {
    if (!this.google || this.googleAudiences.length === 0)
      throw new AuthError('google_not_configured', 501);
    const ticket = await this.google.verifyIdToken({
      idToken,
      audience: this.googleAudiences,
    });
    const payload = ticket.getPayload();
    if (!payload?.email || !payload.sub) throw new AuthError('invalid_google_token', 401);

    let user = await this.repo.findUserByGoogleId(payload.sub);
    if (!user) user = await this.repo.findUserByEmail(payload.email);

    const now = nowUtc();
    if (!user) {
      user = {
        _id: newUlid(),
        email: payload.email,
        emailLower: payload.email.toLowerCase(),
        passwordHash: null,
        name: payload.name ?? null,
        emailVerifiedAt: payload.email_verified ? now : null,
        googleId: payload.sub,
        createdAt: now,
        updatedAt: now,
      };
      await this.repo.users().insertOne(user);
    } else if (!user.googleId) {
      await this.repo
        .users()
        .updateOne(
          { _id: user._id },
          {
            $set: {
              googleId: payload.sub,
              emailVerifiedAt: user.emailVerifiedAt ?? now,
              updatedAt: now,
            },
          },
        );
      user.googleId = payload.sub;
    }

    const workspaceId = await this.ensureWorkspace(user._id);
    const tokens = await this.issueTokens(user._id, workspaceId);
    return { tokens, user, workspaceId };
  }
}
