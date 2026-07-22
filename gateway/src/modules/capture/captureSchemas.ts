import { z } from 'zod';

export const captureRequestSchema = z.object({
  kind: z.enum(['text', 'voice']),
  text: z.string(),
  timezone: z.string().trim().min(1).max(100),
});

export type CaptureRequest = z.infer<typeof captureRequestSchema>;
export type CaptureDraftResponse = { id: string; status: 'draft'; rawText: string };

export function normalizeBrainDumpText(value: string): string {
  return value
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .trim();
}

export function isTimezone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('uk-UA', { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}
