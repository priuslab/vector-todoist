import { createCipheriv, createDecipheriv, randomBytes as nodeRandomBytes } from 'node:crypto';

const VERSION = 'v1';
const NONCE_BYTES = 12;
const TAG_BYTES = 16;

function asKey(value: Buffer | Uint8Array | string): Buffer {
  const key = Buffer.isBuffer(value) ? value : value instanceof Uint8Array ? Buffer.from(value) : Buffer.from(value, /^[0-9a-f]{64}$/i.test(value) ? 'hex' : 'base64');
  if (key.length !== 32) throw new Error('Encryption key must be exactly 32 bytes');
  return key;
}

export function encryptSecret(secret: string, key: Buffer | Uint8Array | string, random = nodeRandomBytes): string {
  if (typeof secret !== 'string' || secret.length === 0) throw new Error('Secret is required');
  const nonce = random(NONCE_BYTES);
  const cipher = createCipheriv('aes-256-gcm', asKey(key), nonce);
  const ciphertext = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, nonce.toString('base64url'), tag.toString('base64url'), ciphertext.toString('base64url')].join('.');
}

export function decryptSecret(payload: string, key: Buffer | Uint8Array | string): string {
  try {
    const parts = payload.split('.');
    if (parts.length !== 4 || parts[0] !== VERSION) throw new Error('Invalid encrypted secret');
    const nonce = Buffer.from(parts[1], 'base64url');
    const tag = Buffer.from(parts[2], 'base64url');
    const ciphertext = Buffer.from(parts[3], 'base64url');
    if (nonce.length !== NONCE_BYTES || tag.length !== TAG_BYTES || ciphertext.length === 0) throw new Error('Invalid encrypted secret');
    const decipher = createDecipheriv('aes-256-gcm', asKey(key), nonce);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  } catch {
    throw new Error('Unable to decrypt secret');
  }
}
