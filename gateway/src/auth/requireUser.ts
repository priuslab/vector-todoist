import type { FastifyReply, FastifyRequest } from 'fastify';
import { AuthError, type PocketBaseTokenVerifier, type VerifiedUser } from './verifyPocketBaseToken.js';

declare module 'fastify' {
  interface FastifyRequest { user: VerifiedUser; }
  interface FastifyInstance { requireUser: (request: FastifyRequest, reply: FastifyReply) => Promise<void | FastifyReply>; }
}

export function makeRequireUser(verifier: PocketBaseTokenVerifier) {
  return async function requireUser(request: FastifyRequest, reply: FastifyReply): Promise<void | FastifyReply> {
    try {
      request.user = await verifier.verify(request.headers.authorization);
    } catch (error) {
      if (!(error instanceof AuthError)) request.log.warn('Authentication failed');
      return reply.code(401).send({ error: 'UNAUTHORIZED' });
    }
  };
}
