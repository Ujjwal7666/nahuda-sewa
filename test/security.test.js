import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { hashPassword, verifyPassword, validNewPassword } from '../src/services/passwords.js';
import { normalizeEmail } from '../src/services/authentication.js';
import { cookieOptions } from '../src/config/session.js';
import { readConfig } from '../src/config/env.js';

test('passwords use salted scrypt hashes and bounded Unicode-aware validation', async () => {
  const password = randomBytes(24).toString('base64url');
  const hash = await hashPassword(password);
  assert.match(hash, /^scrypt\$131072\$8\$1\$/);
  assert.ok(!hash.includes(password));
  assert.notEqual(hash, await hashPassword(password));
  assert.equal(await verifyPassword(password, hash), true);
  assert.equal(await verifyPassword(`${password}x`, hash), false);
  assert.equal(await verifyPassword(password), false);
  assert.equal(await verifyPassword(password, 'malformed'), false);
  for (const input of ['', 'short', 'x'.repeat(129), null, [], {}]) assert.equal(validNewPassword(input), false);
  assert.equal(validNewPassword('x'.repeat(7)), false);
  assert.equal(validNewPassword('x'.repeat(8)), true);
  assert.equal(validNewPassword('क'.repeat(8)), true);
  const minimumPassword = randomBytes(4).toString('hex');
  assert.equal(await verifyPassword(minimumPassword, await hashPassword(minimumPassword)), true);
});

test('email normalization and configuration reject invalid inputs', () => {
  assert.equal(normalizeEmail(' Admin@Example.COM '), 'admin@example.com');
  for (const value of ['', 'admin', 'a@b', ['a@example.com'], 'a'.repeat(255)]) assert.equal(normalizeEmail(value), null);
  for (const env of [{ SESSION_SECRET: 'short' }, { LOGIN_IP_MAX: '0' }, { SESSION_LIFETIME_MINUTES: '99999' }]) {
    assert.throws(() => readConfig(env));
  }
});

test('production cookies are Secure, HttpOnly, SameSite Lax, scoped and bounded', () => {
  const config = readConfig({ NODE_ENV: 'production', DATABASE_URL: 'mysql://local@127.0.0.1/db',
    SESSION_SECRET: randomBytes(32).toString('hex') });
  assert.deepEqual(cookieOptions(config), { httpOnly: true, secure: true, sameSite: 'lax', path: '/admin', maxAge: 28800000 });
  assert.equal(cookieOptions(readConfig({})).secure, false);
});
