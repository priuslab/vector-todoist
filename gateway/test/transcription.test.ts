import { describe, expect, it, vi } from 'vitest';
import { buildApp } from '../src/app.js';
import { createGeminiTranscriptionAdapter, createTranscriptionService, type TranscriptionAdapter } from '../src/modules/transcription/transcriptionService.js';
import { createAudioStorage } from '../src/modules/transcription/audioStorage.js';

const config = {
  nodeEnv: 'test' as const, host: '127.0.0.1', port: 8787, publicWebOrigin: 'https://app.vector.test',
  pocketbaseUrl: 'http://127.0.0.1:8090', trustProxy: false,
  enableGoogleIntegration: false, enableTelegramIntegration: false, enableStripeIntegration: false,
};

const alice = { userId: 'alice', email: 'alice@example.test' };
const bob = { userId: 'bob', email: 'bob@example.test' };

function adapter(result = 'Мені треба підготувати випуск подкасту') : TranscriptionAdapter {
  return { transcribe: vi.fn(async () => result) };
}

describe('transcription service safety', () => {
  it('retains a safe Gemini status and error code when transcription is rejected', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      error: { code: 429, status: 'RESOURCE_EXHAUSTED', message: 'Quota exceeded for this project.' },
    }), { status: 429, headers: { 'content-type': 'application/json' } }));
    const gemini = createGeminiTranscriptionAdapter({ apiKey: 'test-key', fetcher });

    await expect(gemini.transcribe({ bytes: Buffer.from('audio'), mimeType: 'audio/webm', locale: 'uk-UA' })).rejects.toMatchObject({
      name: 'TranscriptionProviderError',
      status: 429,
      providerCode: 'RESOURCE_EXHAUSTED',
      providerMessage: 'Quota exceeded for this project.',
    });
  });

  it('accepts Ukrainian audio, returns normalized transcript and cleans temporary audio', async () => {
    const storage = createAudioStorage({ directory: '/tmp/vector-transcription-test' });
    const adapterInstance = adapter('  Мені треба\r\nпідготувати випуск  ');
    const service = createTranscriptionService(adapterInstance, storage, { maxBytes: 100, maxDurationSeconds: 60 });
    const result = await service.transcribe(alice, { bytes: Buffer.from('audio'), mimeType: 'audio/webm', durationSeconds: 2 });
    expect(result).toEqual({ transcript: 'Мені треба\nпідготувати випуск', locale: 'uk-UA' });
    expect(adapterInstance.transcribe).toHaveBeenCalledWith(expect.objectContaining({ mimeType: 'audio/webm', locale: 'uk-UA' }));
    expect(await storage.count()).toBe(0);
  });

  it('rejects unsupported, oversized and too-long audio before calling provider', async () => {
    const storage = createAudioStorage({ directory: '/tmp/vector-transcription-test-limits' });
    const adapterInstance = adapter();
    const service = createTranscriptionService(adapterInstance, storage, { maxBytes: 3, maxDurationSeconds: 10 });
    await expect(service.transcribe(alice, { bytes: Buffer.from('audio'), mimeType: 'audio/webm', durationSeconds: 1 })).rejects.toMatchObject({ code: 'INVALID_AUDIO' });
    await expect(service.transcribe(alice, { bytes: Buffer.from('1'), mimeType: 'audio/flac', durationSeconds: 1 })).rejects.toMatchObject({ code: 'INVALID_AUDIO' });
    await expect(service.transcribe(alice, { bytes: Buffer.from('1'), mimeType: 'audio/webm', durationSeconds: 11 })).rejects.toMatchObject({ code: 'INVALID_AUDIO' });
    expect(adapterInstance.transcribe).not.toHaveBeenCalled();
  });

  it('cleans audio after provider failure and leaves a retryable safe error', async () => {
    const storage = createAudioStorage({ directory: '/tmp/vector-transcription-test-failure' });
    const adapterInstance: TranscriptionAdapter = { transcribe: vi.fn(async () => { throw new Error('provider secret'); }) };
    const service = createTranscriptionService(adapterInstance, storage);
    await expect(service.transcribe(alice, { bytes: Buffer.from('audio'), mimeType: 'audio/webm', durationSeconds: 1 })).rejects.toMatchObject({ code: 'TRANSCRIPTION_UNAVAILABLE' });
    expect(await storage.count()).toBe(0);
  });

  it('does not let a forged short duration bypass the conservative server duration bound', async () => {
    const storage = createAudioStorage({ directory: '/tmp/vector-transcription-test-spoof' });
    const adapterInstance = adapter();
    const service = createTranscriptionService(adapterInstance, storage, { maxBytes: 10_000, maxDurationSeconds: 2, minBytesPerSecond: 1_000 });
    await expect(service.transcribe(alice, { bytes: Buffer.alloc(2_001), mimeType: 'audio/webm', durationSeconds: 0.1 })).rejects.toMatchObject({ code: 'INVALID_AUDIO' });
    expect(adapterInstance.transcribe).not.toHaveBeenCalled();
  });

  it('times out a hanging provider and still cleans temporary audio', async () => {
    const storage = createAudioStorage({ directory: '/tmp/vector-transcription-test-timeout' });
    const service = createTranscriptionService({ transcribe: vi.fn(() => new Promise<string>(() => undefined)) }, storage, { timeoutMs: 10 });
    await expect(service.transcribe(alice, { bytes: Buffer.from('audio'), mimeType: 'audio/webm' })).rejects.toMatchObject({ code: 'TRANSCRIPTION_UNAVAILABLE' });
    expect(await storage.count()).toBe(0);
  });
});

describe('POST /api/v1/brain-dumps/voice', () => {
  it('requires auth, accepts audio upload, and never accepts a client owner', async () => {
    const storage = createAudioStorage({ directory: '/tmp/vector-transcription-test-route' });
    const adapterInstance = adapter();
    const service = createTranscriptionService(adapterInstance, storage);
    const app = await buildApp({ config, services: {
      authVerifier: { verify: vi.fn(async (authorization?: string) => authorization ? alice : (() => { throw new Error('no'); })()) },
      transcriptionService: service,
    } });
    const missing = await app.inject({ method: 'POST', url: '/api/v1/brain-dumps/voice', headers: { 'content-type': 'audio/webm' }, payload: Buffer.from('audio') });
    expect(missing.statusCode).toBe(401);
    const withOwner = await app.inject({ method: 'POST', url: '/api/v1/brain-dumps/voice?user=bob', headers: { authorization: 'Bearer token', 'content-type': 'audio/webm', 'x-audio-duration': '2' }, payload: Buffer.from('audio') });
    expect(withOwner.statusCode).toBe(200);
    expect(withOwner.json()).toEqual({ transcript: 'Мені треба підготувати випуск подкасту', locale: 'uk-UA' });
    await app.close();
  });

  it('rejects unauthenticated requests', async () => {
    const app = await buildApp({ config, services: { authVerifier: { verify: vi.fn(async () => { throw new Error('no'); }) }, transcriptionService: createTranscriptionService(adapter(), createAudioStorage({ directory: '/tmp/vector-transcription-test-auth' })) } });
    const response = await app.inject({ method: 'POST', url: '/api/v1/brain-dumps/voice', headers: { 'content-type': 'audio/webm' }, payload: Buffer.from('audio') });
    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it('accepts a multipart audio part without trusting its filename', async () => {
    const storage = createAudioStorage({ directory: '/tmp/vector-transcription-test-multipart' });
    const app = await buildApp({ config, services: { authVerifier: { verify: vi.fn(async () => alice) }, transcriptionService: createTranscriptionService(adapter(), storage) } });
    const boundary = 'voice-boundary';
    const payload = Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="audio"; filename="../../secret.wav"\r\nContent-Type: audio/webm\r\n\r\naudio\r\n--${boundary}--\r\n`);
    const response = await app.inject({ method: 'POST', url: '/api/v1/brain-dumps/voice', headers: { authorization: 'Bearer token', 'content-type': `multipart/form-data; boundary=${boundary}` }, payload });
    expect(response.statusCode).toBe(200);
    expect(await storage.count?.()).toBe(0);
    await app.close();
  });
});
