import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { TranscriptionUnavailableError, TranscriptionValidationError, type TranscriptionService } from './transcriptionService.js';

function bodyBytes(body: unknown): Buffer | undefined {
  if (Buffer.isBuffer(body)) return body;
  if (body instanceof Uint8Array) return Buffer.from(body);
  return undefined;
}

function multipartAudio(body: Buffer, contentType: string): { bytes: Buffer; mimeType: string } | undefined {
  const boundary = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType)?.[1] ?? /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType)?.[2];
  if (!boundary) return undefined;
  const source = body.toString('latin1');
  const headerEnd = source.indexOf('\r\n\r\n');
  if (headerEnd < 0) return undefined;
  const partHeaders = source.slice(0, headerEnd);
  const mimeType = /content-type:\s*([^;\r\n]+)/i.exec(partHeaders)?.[1]?.trim().toLowerCase();
  if (!mimeType?.startsWith('audio/')) return undefined;
  const end = source.indexOf(`\r\n--${boundary}`, headerEnd + 4);
  if (end < 0) return undefined;
  return { bytes: body.subarray(headerEnd + 4, end), mimeType };
}

export async function transcriptionRoutes(app: FastifyInstance, service: TranscriptionService): Promise<void> {
  app.post('/api/v1/brain-dumps/voice', { preHandler: (request, reply) => app.requireUser(request, reply) }, async (request: FastifyRequest, reply: FastifyReply) => {
    const rawContentType = String(request.headers['content-type'] ?? '');
    const contentType = rawContentType.split(';', 1)[0].toLowerCase();
    const rawBody = bodyBytes(request.body);
    const multipart = rawBody && contentType === 'multipart/form-data' ? multipartAudio(rawBody, rawContentType) : undefined;
    const bytes = multipart?.bytes ?? rawBody;
    const uploadMimeType = multipart?.mimeType ?? contentType;
    const durationHeader = request.headers['x-audio-duration'];
    const durationSeconds = typeof durationHeader === 'string' && Number.isFinite(Number(durationHeader)) ? Number(durationHeader) : undefined;
    if (!bytes || !uploadMimeType.startsWith('audio/')) return reply.code(400).send({ error: 'INVALID_AUDIO' });
    try {
      return reply.code(200).send(await service.transcribe(request.user, { bytes, mimeType: uploadMimeType, durationSeconds }));
    } catch (error) {
      if (error instanceof TranscriptionValidationError) return reply.code(400).send({ error: 'INVALID_AUDIO' });
      if (error instanceof TranscriptionUnavailableError) return reply.code(503).send({ error: 'TRANSCRIPTION_UNAVAILABLE' });
      request.log.warn('Voice transcription failed');
      return reply.code(503).send({ error: 'TRANSCRIPTION_UNAVAILABLE' });
    }
  });
}
