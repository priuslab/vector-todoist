import { z } from 'zod';

export const supportedAudioMimeTypes = ['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/ogg'] as const;
export const transcriptionInputSchema = z.object({
  bytes: z.instanceof(Buffer).refine((value) => value.length > 0),
  mimeType: z.string().trim().transform((value) => value.split(';', 1)[0].toLowerCase()),
  durationSeconds: z.number().finite().nonnegative().optional(),
});

export function normalizeTranscript(value: string, maxLength = 20_000): string {
  return value.replace(/\r\n?/g, '\n').replace(/[ \t]+/g, ' ').replace(/[ \t]*\n[ \t]*/g, '\n').trim().slice(0, maxLength);
}
