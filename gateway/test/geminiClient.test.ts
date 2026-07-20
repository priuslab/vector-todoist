import { describe, expect, it, vi } from 'vitest';
import { createGeminiClient } from '../src/modules/ai/geminiClient.js';

describe('Gemini analysis client', () => {
  it('falls back to the stable Flash-Lite model when the primary model is temporarily unavailable', async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        error: { code: 503, status: 'UNAVAILABLE', message: 'Primary model is busy.' },
      }), { status: 503, headers: { 'content-type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        candidates: [{ content: { parts: [{ text: JSON.stringify({ summary: 'Готово' }) }] } }],
      }), { status: 200, headers: { 'content-type': 'application/json' } }));
    const client = createGeminiClient({ apiKey: 'test-key', model: 'gemini-3.5-flash', fetcher });

    await expect(client.complete({ brainDumpText: 'Потрібно написати план.' })).resolves.toEqual({ summary: 'Готово' });
    expect(fetcher.mock.calls.map(([url]) => String(url))).toEqual([
      expect.stringContaining('/models/gemini-3.5-flash:generateContent'),
      expect.stringContaining('/models/gemini-2.5-flash-lite:generateContent'),
    ]);
  });
});
