export type TelegramInlineButton = { text: string; callbackData: string };

export interface TelegramClient {
  sendMessage(chatId: string, text: string, options?: { inlineKeyboard?: TelegramInlineButton[][] }): Promise<void>;
  getFile(fileId: string): Promise<{ filePath: string; mimeType?: string; fileSize?: number }>;
  downloadFile(filePath: string): Promise<Buffer>;
}

export function createTelegramClient(options: { botToken: string; apiBaseUrl?: string; fetcher?: typeof fetch; timeoutMs?: number }): TelegramClient {
  const token = options.botToken.trim();
  if (!token) throw new Error('Telegram bot is not configured');
  const fetcher = options.fetcher ?? fetch;
  const base = (options.apiBaseUrl ?? 'https://api.telegram.org').replace(/\/$/, '');
  const timeoutMs = Math.min(Math.max(Math.floor(options.timeoutMs ?? 10_000), 500), 30_000);
  async function call<T>(method: string, body?: Record<string, unknown>): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetcher(`${base}/bot${encodeURIComponent(token)}/${method}`, { method: 'POST', signal: controller.signal, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
      if (!response.ok) throw new Error('Telegram request failed');
      const result = await response.json() as { ok?: boolean; result?: T };
      if (!result.ok) throw new Error('Telegram request failed');
      return result.result as T;
    } finally { clearTimeout(timer); }
  }
  return {
    async sendMessage(chatId, text, options) { await call('sendMessage', { chat_id: chatId, text, ...(options?.inlineKeyboard ? { reply_markup: { inline_keyboard: options.inlineKeyboard.map((row) => row.map((button) => ({ text: button.text, callback_data: button.callbackData }))) } } : {}) }); },
    async getFile(fileId) { const result = await call<{ file_path?: string; file_size?: number }>('getFile', { file_id: fileId }); if (!result?.file_path) throw new Error('Telegram file unavailable'); return { filePath: result.file_path, fileSize: result.file_size }; },
    async downloadFile(filePath) {
      const response = await fetcher(`${base}/file/bot${encodeURIComponent(token)}/${filePath}`);
      if (!response.ok) throw new Error('Telegram file unavailable');
      return Buffer.from(await response.arrayBuffer());
    },
  };
}
