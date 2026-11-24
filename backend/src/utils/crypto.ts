import crypto from 'crypto';
import { config } from '../config/index.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

/**
 * Encrypt a plaintext string using AES-256-GCM.
 */
export function encrypt(text: string): string {
  if (!text) return '';
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = crypto.createHash('sha256').update(config.ENCRYPTION_KEY).digest();
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  // Combine iv + tag + ciphertext into base64 string
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

/**
 * Decrypt an AES-256-GCM encrypted string.
 */
export function decrypt(encryptedText: string): string {
  if (!encryptedText) return '';
  try {
    const buffer = Buffer.from(encryptedText, 'base64');
    if (buffer.length < IV_LENGTH + TAG_LENGTH) {
      throw new Error('Encrypted payload too short');
    }

    const iv = buffer.subarray(0, IV_LENGTH);
    const tag = buffer.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const ciphertext = buffer.subarray(IV_LENGTH + TAG_LENGTH);

    const key = crypto.createHash('sha256').update(config.ENCRYPTION_KEY).digest();
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    return decipher.update(ciphertext, undefined, 'utf8') + decipher.final('utf8');
  } catch (err) {
    return '';
  }
}
