import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

export interface AudioStorage {
  save(bytes: Buffer, mimeType: string): Promise<{ path: string }>;
  cleanup(file: { path: string }): Promise<void>;
  count?(): Promise<number>;
}

/** Ephemeral server-owned storage. The client filename is deliberately ignored. */
export function createAudioStorage(options: { directory?: string } = {}): AudioStorage {
  const directory = options.directory ?? join(process.cwd(), '.tmp', 'transcription');
  return {
    async save(bytes, mimeType) {
      await mkdir(directory, { recursive: true, mode: 0o700 });
      const extension = mimeType === 'audio/webm' ? '.webm' : mimeType === 'audio/mp4' ? '.m4a' : mimeType === 'audio/mpeg' ? '.mp3' : mimeType === 'audio/wav' ? '.wav' : '.audio';
      const path = join(directory, `${randomUUID()}${extension}`);
      await writeFile(path, bytes, { mode: 0o600, flag: 'wx' });
      return { path };
    },
    async cleanup(file) {
      await rm(file.path, { force: true });
    },
    async count() {
      try { return (await readdir(directory)).length; } catch { return 0; }
    },
  };
}
