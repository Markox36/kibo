import fp from 'fastify-plugin';
import jwtPlugin from '@fastify/jwt';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

export interface AccessTokenPayload {
  sub: string;
  workspaceId: string;
  type: 'access';
}

export interface RefreshTokenPayload {
  sub: string;
  type: 'refresh';
  jti: string;
}

declare module 'fastify' {
  interface FastifyInstance {
    requireAuth: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
  interface FastifyRequest {
    auth?: AccessTokenPayload;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: AccessTokenPayload | RefreshTokenPayload;
    user: AccessTokenPayload;
  }
}

interface Opts {
  secret: string;
  accessExpiresIn: string;
  refreshExpiresIn: string;
}

export const authPlugin = fp<Opts>(async (app: FastifyInstance, opts) => {
  await app.register(jwtPlugin, {
    secret: opts.secret,
    sign: { expiresIn: opts.accessExpiresIn },
  });

  app.decorate(
    'requireAuth',
    async (req: FastifyRequest, reply: FastifyReply): Promise<void> => {
      try {
        const decoded = await req.jwtVerify<AccessTokenPayload | RefreshTokenPayload>();
        if (decoded.type !== 'access') {
          reply.code(401).send({ error: 'invalid_token_type' });
          return;
        }
        req.auth = decoded;
      } catch {
        reply.code(401).send({ error: 'unauthorized' });
      }
    },
  );
});
