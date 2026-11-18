import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const derive = promisify(scrypt);
const options = { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 };
export const passwordPolicy = 'Use 8–128 characters (up to 512 UTF-8 bytes).';
export const validPasswordInput = (value) => typeof value === 'string' && value.length > 0 &&
  [...value].length <= 128 && Buffer.byteLength(value, 'utf8') <= 512;
export const validNewPassword = (value) => validPasswordInput(value) && [...value].length >= 8;

export async function hashPassword(password) {
  if (!validNewPassword(password)) throw new Error('Password does not meet policy.');
  const salt = randomBytes(16).toString('hex');
  const key = await derive(password, salt, 64, options);
  return `scrypt$131072$8$1$${salt}$${key.toString('hex')}`;
}

// The same expensive operation runs for unknown/inactive accounts.
const dummyHash = `scrypt$131072$8$1$${'0'.repeat(32)}$${'0'.repeat(128)}`;
export async function verifyPassword(password, encoded = dummyHash) {
  if (!validPasswordInput(password)) return false;
  const match = /^scrypt\$131072\$8\$1\$([a-f0-9]{32})\$([a-f0-9]{128})$/.exec(encoded);
  const [, salt, expected] = match || /^scrypt\$131072\$8\$1\$([a-f0-9]{32})\$([a-f0-9]{128})$/.exec(dummyHash);
  const key = await derive(password, salt, 64, options);
  return timingSafeEqual(key, Buffer.from(expected, 'hex')) && Boolean(match) && encoded !== dummyHash;
}
