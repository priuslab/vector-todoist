import type { VerifiedUser } from '../../auth/verifyPocketBaseToken.js';
import type { CaptureService } from '../../modules/capture/captureService.js';
import type { TranscriptionService } from '../../modules/transcription/transcriptionService.js';
import type { TelegramPairingService } from './pairingService.js';
import type { TelegramClient } from './telegramClient.js';
import type { PocketBaseClient, PocketBaseRecord } from '../../pocketbase/client.js';
import { RepositoryError } from '../../repositories/base.js';

type TelegramUpdate = { update_id?: unknown; message?: { chat?: { id?: unknown }; from?: { username?: unknown }; text?: unknown; voice?: { file_id?: unknown; file_size?: unknown; duration?: unknown; mime_type?: unknown } } };
export interface TelegramUpdateStore { mark(updateId: string): Promise<boolean | void>; }
export interface TelegramCaptureHandler {
  handle(update: unknown): Promise<void>;
}

export function createTelegramUpdateStore(client: PocketBaseClient): TelegramUpdateStore {
  return {
    async mark(updateId) {
      try { await client.create('telegram_updates', { updateId, receivedAt: new Date().toISOString() }); return true; }
      catch {
        const rows = await client.list<PocketBaseRecord & { updateId?: string }>('telegram_updates', `updateId = '${updateId.replaceAll("'", "\\'")}'`);
        if (rows.some((row) => row.updateId === updateId)) return false;
        throw new RepositoryError('UNAVAILABLE');
      }
    },
  };
}

const chatIdOf = (message: TelegramUpdate['message']) => typeof message?.chat?.id === 'number' || typeof message?.chat?.id === 'string' ? String(message.chat.id) : null;
const timezone = 'Europe/Kyiv';
const fileMime = (path: string, declared?: unknown) => typeof declared === 'string' && declared.startsWith('audio/') ? declared : path.toLowerCase().endsWith('.ogg') ? 'audio/ogg' : path.toLowerCase().endsWith('.mp3') ? 'audio/mpeg' : path.toLowerCase().endsWith('.wav') ? 'audio/wav' : 'audio/webm';

export function createTelegramCaptureHandler(deps: {
  pairing: Pick<TelegramPairingService, 'findByChat'>;
  captureService: Pick<CaptureService, 'createTextDraft'>;
  transcriptionService?: Pick<TranscriptionService, 'transcribe'>;
  updateStore: TelegramUpdateStore;
  telegram: Pick<TelegramClient, 'sendMessage' | 'getFile' | 'downloadFile'>;
  resolveUser: (connection: { user: string }) => Promise<VerifiedUser>;
  maxVoiceBytes?: number;
  maxVoiceDurationSeconds?: number;
}): TelegramCaptureHandler {
  const maxVoiceBytes = Math.min(Math.max(Math.floor(deps.maxVoiceBytes ?? 15_000_000), 1_024), 25_000_000);
  const maxVoiceDurationSeconds = Math.min(Math.max(Math.floor(deps.maxVoiceDurationSeconds ?? 180), 1), 600);
  return {
    async handle(raw) {
      if (!raw || typeof raw !== 'object') return;
      const update = raw as TelegramUpdate;
      const updateId = typeof update.update_id === 'number' || typeof update.update_id === 'string' ? String(update.update_id) : null;
      const message = update.message;
      const chatId = chatIdOf(message);
      if (!updateId || !message || !chatId) return;
      if ((await deps.updateStore.mark(updateId)) === false) return;
      const connection = await deps.pairing.findByChat(chatId);
      if (!connection) { await deps.telegram.sendMessage(chatId, 'Щоб підключити Telegram, відкрий Вектор і натисни «Підключити Telegram».', undefined); return; }
      const user = await deps.resolveUser(connection);
      const idempotencyKey = `telegram:${updateId}`;
      const text = typeof message.text === 'string' ? message.text.replace(/[ \t]+/g, ' ').trim() : '';
      if (text) {
        const draft = await deps.captureService.createTextDraft(user, { kind: 'text', text, timezone }, idempotencyKey, 'telegram');
        await deps.telegram.sendMessage(chatId, 'Чернетку збережено. Вектор підготує задачі та ідеї.', { inlineKeyboard: [[{ text: 'Відкрити план', callbackData: `open_plan:${draft.id}` }], [{ text: 'Залишити як ідею', callbackData: `keep_idea:${draft.id}` }, { text: 'Undo', callbackData: `undo:${draft.id}` }]] });
        return;
      }
      const voice = message.voice;
      if (!voice || typeof voice.file_id !== 'string' || !deps.transcriptionService) { await deps.telegram.sendMessage(chatId, 'Надішли текст або коротке голосове повідомлення українською.', undefined); return; }
      const size = typeof voice.file_size === 'number' ? voice.file_size : 0;
      const duration = typeof voice.duration === 'number' ? voice.duration : 0;
      if (size <= 0 || size > maxVoiceBytes || duration < 0 || duration > maxVoiceDurationSeconds) { await deps.telegram.sendMessage(chatId, 'Голосове повідомлення завелике або задовге. Спробуй коротший запис.', undefined); return; }
      try {
        const file = await deps.telegram.getFile(voice.file_id);
        if (!file.filePath || (file.fileSize !== undefined && file.fileSize > maxVoiceBytes)) throw new Error('VOICE_LIMIT');
        const bytes = await deps.telegram.downloadFile(file.filePath);
        if (bytes.length === 0 || bytes.length > maxVoiceBytes) throw new Error('VOICE_LIMIT');
        const result = await deps.transcriptionService.transcribe(user, { bytes, mimeType: fileMime(file.filePath, voice.mime_type), durationSeconds: duration });
        const draft = await deps.captureService.createTextDraft(user, { kind: 'voice', text: result.transcript, timezone }, idempotencyKey, 'telegram');
        await deps.telegram.sendMessage(chatId, 'Голосову думку розпізнано й збережено як чернетку.', { inlineKeyboard: [[{ text: 'Відкрити план', callbackData: `open_plan:${draft.id}` }], [{ text: 'Залишити як ідею', callbackData: `keep_idea:${draft.id}` }, { text: 'Undo', callbackData: `undo:${draft.id}` }]] });
      } catch { await deps.telegram.sendMessage(chatId, 'Не вдалося обробити голосове. Спробуй надіслати його ще раз.', undefined); }
    },
  };
}
