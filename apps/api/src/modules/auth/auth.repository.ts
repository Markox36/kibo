import type { Db } from 'mongodb';

export interface UserDoc {
  _id: string;
  email: string;
  emailLower: string;
  passwordHash: string | null;
  name: string | null;
  emailVerifiedAt: string | null;
  googleId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceDoc {
  _id: string;
  ownerUserId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface RefreshTokenDoc {
  _id: string;
  userId: string;
  tokenHash: string;
  createdAt: string;
  expiresAt: Date;
  revokedAt: string | null;
  replacedBy: string | null;
}

export type EmailTokenKind = 'verify' | 'password_reset';

export interface EmailTokenDoc {
  _id: string;
  userId: string;
  kind: EmailTokenKind;
  tokenHash: string;
  createdAt: string;
  expiresAt: Date;
  usedAt: string | null;
}

export class AuthRepository {
  constructor(private readonly db: Db) {}

  users() {
    return this.db.collection<UserDoc>('users');
  }
  workspaces() {
    return this.db.collection<WorkspaceDoc>('workspaces');
  }
  refreshTokens() {
    return this.db.collection<RefreshTokenDoc>('refresh_tokens');
  }
  emailTokens() {
    return this.db.collection<EmailTokenDoc>('email_tokens');
  }

  findUserByEmail(email: string) {
    return this.users().findOne({ emailLower: email.toLowerCase() });
  }

  findUserById(id: string) {
    return this.users().findOne({ _id: id });
  }

  findUserByGoogleId(googleId: string) {
    return this.users().findOne({ googleId });
  }

  findWorkspaceByOwner(userId: string) {
    return this.workspaces().findOne({ ownerUserId: userId });
  }
}
