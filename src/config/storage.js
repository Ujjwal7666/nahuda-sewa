import { isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const defaultStorageRoot = fileURLToPath(new URL('../../storage/', import.meta.url));

export function resolveStorageRoot(value = process.env.STORAGE_ROOT) {
  const configuredRoot = typeof value === 'string' ? value.trim() : '';
  if (configuredRoot && !isAbsolute(configuredRoot)) {
    throw new Error('STORAGE_ROOT must be an absolute filesystem path.');
  }
  return resolve(configuredRoot || defaultStorageRoot);
}

export const storageRoot = resolveStorageRoot();
export const uploadRoot = join(storageRoot, 'uploads');
export const receiptRoot = join(storageRoot, 'receipts');
