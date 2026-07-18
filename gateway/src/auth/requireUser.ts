import type { FastifyReply, FastifyRequest } from 'fastify';
import { AuthError, type PocketBaseTokenVerifier, type VerifiedUser } from './verifyPocketBaseToken.js';

declare module 'fastify' {
  interface FastifyRequest { user: VerifiedUser; }
  interface FastifyInstance { requireUser: (request: FastifyRequest, reply: FastifyReply) => Promise<void | FastifyReply>; }
}

export function makeRequireUser(verifier: PocketBaseTokenVerifier) {
  return async function requireUser(request: FastifyRequest, reply: FastifyReply): Promise<void | FastifyReply> {
    try {
      const user = await verifier.verify(request.headers.authorization);
      const authorization = request.headers.authorization;
      const token = authorization?.startsWith('Bearer ') ? authorization.slice(7).trim() : undefined;
      request.user = user;
      if (token) Object.defineProperty(request.user, 'token', { value: token, enumerable: false, configurable: true });
    } catch (error) {
      if (!(error instanceof AuthError)) request.log.warn('Authentication failed');
      return reply.code(401).send({ error: 'UNAUTHORIZED' });
    }
  };
}
