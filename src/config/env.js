import dotenv from 'dotenv';
import { resolveStorageRoot } from './storage.js';

dotenv.config({ quiet: true });

export function readConfig(env = process.env) {
  const nodeEnv = env.NODE_ENV || 'development';
  if (!['development', 'test', 'production'].includes(nodeEnv)) {
    throw new Error('NODE_ENV must be development, test or production.');
  }
  const rawPort = env.PORT || '3000';
  if (!/^\d+$/.test(rawPort) || Number(rawPort) < 1 || Number(rawPort) > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }
  const host = env.HOST || '127.0.0.1';
  if (!['127.0.0.1', 'localhost', '::1'].includes(host)) {
    throw new Error('Phase 1 supports loopback HOST values only.');
  }
  const integer = (name, fallback, min, max) => {
    const value = env[name] || String(fallback);
    if (!/^\d+$/.test(value) || Number(value) < min || Number(value) > max) {
      throw new Error(`${name} must be an integer between ${min} and ${max}.`);
    }
    return Number(value);
  };
  const databaseUrl = env.DATABASE_URL || '';
  const storageRoot = resolveStorageRoot(env.STORAGE_ROOT);
  let publicOrigin = `http://${host === '::1' ? '[::1]' : host}:${rawPort}`;
  if (env.PUBLIC_ORIGIN) {
    try {
      const origin = new URL(env.PUBLIC_ORIGIN);
      if (!['http:', 'https:'].includes(origin.protocol) || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) throw new Error();
      publicOrigin = origin.origin;
    } catch { throw new Error('PUBLIC_ORIGIN must be an HTTP(S) origin without a path or credentials.'); }
  }
  if (databaseUrl) requireDatabaseUrl(env);
  const sessionSecret = env.SESSION_SECRET || '';
  if (sessionSecret && Buffer.byteLength(sessionSecret) < 32) throw new Error('SESSION_SECRET must contain at least 32 bytes.');
  if (nodeEnv === 'production' && (!databaseUrl || !sessionSecret)) {
    throw new Error('Production requires DATABASE_URL and SESSION_SECRET.');
  }
  return Object.freeze({ nodeEnv, port: Number(rawPort), host, databaseUrl, sessionSecret, publicOrigin, storageRoot,
    sessionLifetimeMs: integer('SESSION_LIFETIME_MINUTES', 480, 5, 1440) * 60000,
    loginWindowMs: integer('LOGIN_WINDOW_MINUTES', 15, 1, 60) * 60000,
    loginIpMax: integer('LOGIN_IP_MAX', 20, 1, 100),
    loginAccountMax: integer('LOGIN_ACCOUNT_MAX', 10, 1, 100),
    receiptWindowMs: integer('RECEIPT_WINDOW_MINUTES', 60, 1, 1440) * 60000,
    receiptIpMax: integer('RECEIPT_IP_MAX', 10, 1, 100),
    receiptEmailMax: integer('RECEIPT_EMAIL_MAX', 5, 1, 100),
    contactWindowMs: integer('CONTACT_WINDOW_MINUTES', 60, 1, 1440) * 60000,
    contactIpMax: integer('CONTACT_IP_MAX', 10, 1, 100),
    contactEmailMax: integer('CONTACT_EMAIL_MAX', 5, 1, 100),
  });
}

export function requireLocalDatabaseUrl(env = process.env) {
  const value = requireDatabaseUrl(env);
  const url = new URL(value);
  if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
    throw new Error('Local database checks allow local MySQL only.');
  }
  return value;
}

export function requireDatabaseUrl(env = process.env) {
  if (!env.DATABASE_URL) throw new Error('Set DATABASE_URL in the private environment configuration.');
  let url;
  try { url = new URL(env.DATABASE_URL); } catch {
    throw new Error('DATABASE_URL must be a valid MySQL URL.');
  }
  if (url.protocol !== 'mysql:' || !url.hostname || url.hostname === '[::]') {
    throw new Error('DATABASE_URL must use the mysql: protocol and specify a database host.');
  }
  if (!url.username || url.pathname.length < 2) {
    throw new Error('DATABASE_URL needs a user and database name.');
  }
  return env.DATABASE_URL;
}
