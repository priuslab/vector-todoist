import { describe, expect, it, vi } from 'vitest';
import { createTelegramCaptureHandler } from '../src/integrations/telegram/telegramCaptureHandler.js';

const user = { userId: 'user-1', email: 'olena@example.com' };

describe('Telegram capture', () => {
  it('routes paired text through the shared capture service and deduplicates update ids', async () => {
    const capture = { createTextDraft: vi.fn(async () => ({ id: 'dump-1', status: 'draft' as const, rawText: 'підготувати епізод' })) };
    const reply = vi.fn(async () => undefined);
    const state = { connection: vi.fn(async () => ({ id: 'conn-1', user: 'user-1', chatId: 'chat-1' })), seen: new Set<string>(), mark: vi.fn(async (id: string) => { if (state.seen.has(id)) return false; state.seen.add(id); return true; }) };
    const handler = createTelegramCaptureHandler({ pairing: { findByChat: state.connection }, captureService: capture, updateStore: { has: async (id) => state.seen.has(id), mark: state.mark }, telegram: { sendMessage: reply } as any, resolveUser: async () => user });
    await handler.handle({ update_id: 10, message: { chat: { id: 1 }, text: '  підготувати   епізод ' } });
    await handler.handle({ update_id: 10, message: { chat: { id: 1 }, text: 'повтор' } });
    expect(capture.createTextDraft).toHaveBeenCalledOnce();
    expect(capture.createTextDraft).toHaveBeenCalledWith(user, expect.objectContaining({ kind: 'text', text: 'підготувати епізод' }), expect.stringContaining('telegram:10'), 'telegram');
    expect(reply).toHaveBeenCalledWith('1', expect.stringContaining('Чернетку збережено'), expect.objectContaining({ inlineKeyboard: expect.any(Array) }));
  });

  it('does not reveal data to an unpaired chat and validates voice limits before download', async () => {
    const reply = vi.fn(async () => undefined);
    const download = vi.fn(async () => Buffer.alloc(2_000));
    const handler = createTelegramCaptureHandler({ pairing: { findByChat: async () => null }, captureService: { createTextDraft: vi.fn() }, updateStore: { mark: async () => true }, telegram: { sendMessage: reply, getFile: vi.fn(async () => ({ file_path: 'voice.ogg', mimeType: 'audio/ogg', fileSize: 2_000 })), downloadFile: download } as any, resolveUser: async () => user, maxVoiceBytes: 1_000 });
    await handler.handle({ update_id: 11, message: { chat: { id: 99 }, voice: { file_id: 'voice-1', file_size: 2_000, duration: 3 } } });
    expect(reply).toHaveBeenCalledWith('99', expect.stringContaining('підключити Telegram'), undefined);
    expect(download).not.toHaveBeenCalled();
  });
});
