import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomBytes, createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createApp } from '../src/app.js';
import { readConfig } from '../src/config/env.js';
import { createDatabase } from '../src/services/database.js';
import { hashPassword, verifyPassword } from '../src/services/passwords.js';
import { authenticationService } from '../src/services/authentication.js';
import { PrismaSessionStore, pruneAuthRecords } from '../src/services/session-store.js';
import { organizationSettingsService } from '../src/services/organization-settings.js';

test('Admin authentication against isolated MySQL', { skip: !process.env.AUTH_TEST_DATABASE_URL }, async (t) => {
  const url = new URL(process.env.AUTH_TEST_DATABASE_URL);
  assert.match(url.pathname, /^\/nahuda_auth_test_[a-f0-9]{16}$/);
  const config = readConfig({ NODE_ENV: 'test', DATABASE_URL: url.href,
    SESSION_SECRET: randomBytes(32).toString('hex'), LOGIN_IP_MAX: '100', LOGIN_ACCOUNT_MAX: '100' });
  const db = createDatabase(url.href);
  const auth = authenticationService(db, config);
  const store = new PrismaSessionStore(db, config.sessionLifetimeMs);
  const password = randomBytes(24).toString('base64url');
  const nextPassword = randomBytes(24).toString('base64url');
  const email = 'admin@example.test';
  const initial = await db.adminUser.create({ data: { name: '<script>Admin</script>', email, password_hash: await hashPassword(password) } });
  const app = createApp(config, { auth, store, settings: organizationSettingsService(db) });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  let base = `http://127.0.0.1:${server.address().port}`;
  const logs = [];
  t.mock.method(console, 'error', (...args) => logs.push(args.join(' ')));
  const bodies = [];
  function browser() {
    return { cookie: '', token: '', async request(path, fields, method) {
      const headers = this.cookie ? { cookie: this.cookie } : {};
      if (fields) headers['content-type'] = 'application/x-www-form-urlencoded';
      const response = await fetch(base + path, { method: method || (fields ? 'POST' : 'GET'), headers,
        body: fields ? new URLSearchParams(fields) : undefined, redirect: 'manual' });
      const setCookie = response.headers.get('set-cookie');
      if (setCookie) this.cookie = setCookie.split(';')[0];
      const html = await response.text();
      bodies.push(html);
      const token = /name="_csrf" value="([a-f0-9]+)"/.exec(html)?.[1];
      if (token) this.token = token;
      return { response, html };
    }, async login(value = password, identifier = email) {
      await this.request('/admin/login');
      return this.request('/admin/login', { _csrf: this.token, email: identifier, password: value });
    } };
  }
  const client = browser();
  let other;
  try {
    await t.test('all protected routes redirect before exposing content', async () => {
      for (const path of ['/admin', '/admin/dashboard', '/admin/organization', '/admin/content', '/admin/messages', '/admin/account', '/admin/account/change-password']) {
        const { response, html } = await client.request(path);
        assert.equal(response.status, 303, path);
        assert.equal(response.headers.get('location'), '/admin/login');
        assert.ok(!html.includes(initial.name));
      }
    });
    await t.test('login issues a scoped HttpOnly cookie and rejects missing/wrong/cross-session CSRF', async () => {
      const { response } = await client.request('/admin/login');
      const cookie = response.headers.get('set-cookie') || client.cookie;
      const fresh = browser();
      const freshResponse = (await fresh.request('/admin/login')).response;
      assert.match(freshResponse.headers.get('set-cookie'), /Path=\/admin;.*HttpOnly; SameSite=Lax/);
      assert.ok(!freshResponse.headers.get('set-cookie').includes('Secure'));
      for (const token of ['', 'invalid', fresh.token]) {
        assert.equal((await client.request('/admin/login', { _csrf: token, email, password })).response.status, 403);
      }
      assert.ok(cookie);
    });
    await t.test('invalid and unknown accounts have identical generic errors', async () => {
      const known = await client.login('wrong-password-long');
      const unknown = await client.login('wrong-password-long', 'unknown@example.test');
      assert.equal(known.response.status, 401);
      assert.equal(unknown.response.status, 401);
      assert.equal(known.html, unknown.html);
      assert.match(known.html, /Invalid credentials\./);
    });
    await t.test('server validation rejects missing, malformed and excessive fields', async () => {
      for (const fields of [{}, { email: 'invalid', password }, { email, password: 'x'.repeat(129) }]) {
        assert.equal((await client.request('/admin/login', { _csrf: client.token, ...fields })).response.status, 400);
      }
      assert.equal((await client.request('/admin/login', { _csrf: client.token, email, password: 'x'.repeat(9000) })).response.status, 413);
    });
    await t.test('successful login regenerates session, records timestamp and escapes identity', async () => {
      const oldCookie = client.cookie;
      const oldToken = client.token;
      const result = await client.login(password, 'ADMIN@EXAMPLE.TEST');
      assert.equal(result.response.status, 303);
      assert.equal(result.response.headers.get('location'), '/admin/dashboard');
      assert.notEqual(client.cookie, oldCookie);
      const { response, html } = await client.request('/admin/dashboard');
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      assert.match(html, /&lt;script&gt;Admin&lt;\/script&gt;/);
      assert.ok(!html.includes('<script>Admin</script>'));
      assert.notEqual(client.token, oldToken);
      assert.ok((await db.adminUser.findUnique({ where: { id: initial.id } })).last_login_at);
      const replay = browser(); replay.cookie = oldCookie;
      assert.equal((await replay.request('/admin/dashboard')).response.status, 303);
    });
    await t.test('authenticated navigation, refresh and login redirect work', async () => {
      assert.equal((await client.request('/admin/organization')).response.headers.get('location'), '/admin/organization/settings');
      for (const path of ['/admin/dashboard', '/admin/organization/settings', '/admin/content', '/admin/messages', '/admin/account/change-password']) {
        assert.equal((await client.request(path)).response.status, 200);
      }
      assert.equal((await client.request('/admin/dashboard')).response.status, 200);
      assert.equal((await client.request('/admin/login')).response.headers.get('location'), '/admin/dashboard');
    });
    await t.test('sessions survive a new application instance', async () => {
      const second = createApp(config, { auth, store: new PrismaSessionStore(db, config.sessionLifetimeMs) }).listen(0, '127.0.0.1');
      await once(second, 'listening');
      const previous = base;
      try { base = `http://127.0.0.1:${second.address().port}`; assert.equal((await client.request('/admin/dashboard')).response.status, 200); }
      finally { base = previous; await new Promise((resolve) => second.close(resolve)); }
    });
    await t.test('logout and password changes reject CSRF and GET logout does not mutate', async () => {
      assert.equal((await client.request('/admin/logout', {})).response.status, 403);
      assert.equal((await client.request('/admin/account/change-password', {})).response.status, 403);
      assert.equal((await client.request('/admin/logout')).response.status, 404);
      assert.equal((await client.request('/admin/dashboard')).response.status, 200);
    });
    await t.test('password change verifies current password, policy and confirmation', async () => {
      for (const [current, next, confirm, message] of [
        ['wrong', nextPassword, nextPassword, 'Current password is incorrect.'],
        [password, 'short', 'short', 'Use 8'],
        [password, nextPassword, 'different', 'New passwords must match.'],
        [password, password, password, 'Choose a different new password.'],
      ]) {
        const result = await client.request('/admin/account/change-password', { _csrf: client.token,
          current_password: current, new_password: next, confirm_password: confirm });
        assert.equal(result.response.status, 400);
        assert.ok(result.html.includes(message));
      }
      assert.equal((await db.adminUser.findUnique({ where: { id: initial.id } })).password_hash, initial.password_hash);
    });
    await t.test('password change stores a fresh hash, rotates session and revokes other sessions', async () => {
      other = browser(); await other.login();
      const oldCookie = client.cookie;
      const result = await client.request('/admin/account/change-password', { _csrf: client.token,
        current_password: password, new_password: nextPassword, confirm_password: nextPassword });
      assert.equal(result.response.status, 303);
      assert.notEqual(client.cookie, oldCookie);
      const updated = await db.adminUser.findUnique({ where: { id: initial.id } });
      assert.notEqual(updated.password_hash, initial.password_hash);
      assert.equal(await verifyPassword(nextPassword, updated.password_hash), true);
      assert.equal(updated.session_version, 2);
      assert.equal((await other.request('/admin/dashboard')).response.status, 303);
      assert.match((await client.request('/admin/dashboard')).html, /Password changed\./);
    });
    await t.test('logout destroys server session and replay cannot access protected pages', async () => {
      const cookie = client.cookie;
      const result = await client.request('/admin/logout', { _csrf: client.token });
      assert.equal(result.response.status, 303);
      assert.match(result.response.headers.get('set-cookie'), /Expires=Thu, 01 Jan 1970/);
      assert.equal((await client.request('/admin/dashboard')).response.status, 303);
      const replay = browser(); replay.cookie = cookie;
      assert.equal((await replay.request('/admin/dashboard')).response.status, 303);
    });
    await t.test('old password fails and new password authenticates', async () => {
      assert.equal((await client.login(password)).response.status, 401);
      assert.equal((await client.login(nextPassword)).response.status, 303);
    });
    await t.test('inactive account is rejected and active sessions are invalidated', async () => {
      await db.adminUser.update({ where: { id: initial.id }, data: { is_active: false } });
      assert.equal((await client.request('/admin/dashboard')).response.status, 303);
      assert.equal((await client.login(nextPassword)).response.status, 401);
      await db.adminUser.update({ where: { id: initial.id }, data: { is_active: true } });
    });
    await t.test('database expiry and absolute authenticated timeout reject sessions', async () => {
      await client.login(nextPassword);
      await db.adminSession.updateMany({ where: { revoked: false }, data: { expires_at: new Date(0) } });
      assert.equal((await client.request('/admin/dashboard')).response.status, 303);
      await client.login(nextPassword);
      const rows = await db.adminSession.findMany({ where: { revoked: false } });
      for (const row of rows) {
        const data = JSON.parse(row.data);
        if (data.adminId) { data.authenticatedAt = 1; await db.adminSession.update({ where: { id: row.id }, data: { data: JSON.stringify(data) } }); }
      }
      assert.equal((await client.request('/admin/dashboard')).response.status, 303);
    });
    await t.test('session tombstones prevent overlapping writes from resurrecting logout', async () => {
      const sid = randomBytes(32).toString('hex');
      const value = { cookie: { expires: new Date(Date.now() + 60000) }, adminId: initial.id };
      const call = (method, ...args) => new Promise((resolve, reject) => store[method](...args, (error, result) => error ? reject(error) : resolve(result)));
      await call('set', sid, value); await call('destroy', sid); await call('set', sid, value);
      assert.equal(await call('get', sid), null);
      assert.equal((await db.adminSession.findUnique({ where: { id: createHash('sha256').update(sid).digest('hex') } })).revoked, true);
    });
    await t.test('rate limits persist across instances, cover IP/account and expire', async () => {
      const limited = { ...config, loginIpMax: 2, loginAccountMax: 2 };
      const first = authenticationService(db, limited);
      const second = authenticationService(db, limited);
      assert.equal((await first.consumeAttempt('limit-test', 'one', email)).allowed, true);
      assert.equal((await second.consumeAttempt('limit-test', 'two', email)).allowed, true);
      const blocked = await first.consumeAttempt('limit-test', 'three', email);
      assert.equal(blocked.allowed, false); assert.ok(blocked.retryAfter > 0);
      await first.consumeAttempt('ip-test', 'one', 'a'); await first.consumeAttempt('ip-test', 'one', 'b');
      assert.equal((await second.consumeAttempt('ip-test', 'one', 'c')).allowed, false);
      const now = Date.now();
      const clock = t.mock.method(Date, 'now', () => now + config.loginWindowMs);
      try { assert.equal((await first.consumeAttempt('limit-test', 'one', email)).allowed, true); }
      finally { clock.mock.restore(); }
    });
    await t.test('parallel attempts cannot bypass a fresh account limit', async () => {
      const limited = authenticationService(db, { ...config, loginIpMax: 2, loginAccountMax: 2 });
      const results = await Promise.all(Array.from({ length: 6 }, () => limited.consumeAttempt('parallel', 'same-ip', 'same-account')));
      assert.equal(results.filter((result) => result.allowed).length, 2);
    });
    await t.test('production cookie header is Secure behind an explicitly trusted test proxy', async () => {
      const production = createApp({ ...config, nodeEnv: 'production' }, { auth, store });
      // Test-only topology; the real application keeps trust proxy disabled.
      production.set('trust proxy', 'loopback');
      const secure = production.listen(0, '127.0.0.1');
      await once(secure, 'listening');
      try {
        const response = await fetch(`http://127.0.0.1:${secure.address().port}/admin/login`, { headers: { 'x-forwarded-proto': 'https' } });
        await response.text();
        assert.match(response.headers.get('set-cookie'), /HttpOnly; Secure; SameSite=Lax/);
        const plain = await fetch(`http://127.0.0.1:${secure.address().port}/admin/login`);
        await plain.text(); assert.equal(plain.headers.get('set-cookie'), null);
      } finally { await new Promise((resolve) => secure.close(resolve)); }
    });
    await t.test('repeated invalid HTTP login returns 429 and Retry-After', async () => {
      const limitedConfig = { ...config, loginAccountMax: 2, loginIpMax: 2 };
      await db.authRateLimit.deleteMany();
      const limited = createApp(limitedConfig, { auth: authenticationService(db, limitedConfig), store }).listen(0, '127.0.0.1');
      await once(limited, 'listening'); const previous = base;
      try {
        base = `http://127.0.0.1:${limited.address().port}`; const limitedClient = browser();
        assert.equal((await limitedClient.login('wrong-password-long')).response.status, 401);
        assert.equal((await limitedClient.login('wrong-password-long')).response.status, 401);
        const result = await limitedClient.login(nextPassword);
        assert.equal(result.response.status, 429); assert.ok(Number(result.response.headers.get('retry-after')) > 0);
      } finally { base = previous; await new Promise((resolve) => limited.close(resolve)); }
    });
    await t.test('unique email constraint, session data minimization and expiry cleanup', async () => {
      await assert.rejects(db.adminUser.create({ data: { name: 'Duplicate', email: email.toUpperCase(), password_hash: initial.password_hash } }));
      const rows = await db.adminSession.findMany();
      assert.ok(rows.every((row) => !row.data.includes('password_hash') && !row.data.includes(nextPassword)));
      await db.adminSession.create({ data: { id: 'expired', data: '{}', expires_at: new Date(0) } });
      await pruneAuthRecords(db);
      assert.equal(await db.adminSession.findUnique({ where: { id: 'expired' } }), null);
    });
    await t.test('public English/Nepali pages remain accessible without session cookies', async () => {
      for (const path of ['/', '/ne']) {
        const result = await browser().request(path);
        assert.equal(result.response.status, 200); assert.equal(result.response.headers.get('set-cookie'), null);
      }
    });
    await t.test('provisioning CLI hashes private credentials and refuses overwrite on rerun', async () => {
      const seedPassword = randomBytes(24).toString('base64url');
      const env = { ...process.env, DATABASE_URL: url.href, ADMIN_NAME: 'Provisioning Test',
        ADMIN_EMAIL: 'provision@example.test', ADMIN_PASSWORD: seedPassword };
      const first = spawnSync(process.execPath, ['scripts/create-admin.js'], { env, encoding: 'utf8', timeout: 15000 });
      assert.equal(first.status, 0);
      const record = await db.adminUser.findUnique({ where: { email: env.ADMIN_EMAIL } });
      assert.equal(await verifyPassword(seedPassword, record.password_hash), true);
      const repeat = spawnSync(process.execPath, ['scripts/create-admin.js'], { env, encoding: 'utf8', timeout: 15000 });
      assert.equal(repeat.status, 1);
      assert.equal((await db.adminUser.findUnique({ where: { id: record.id } })).password_hash, record.password_hash);
      assert.ok(!(first.stdout + first.stderr + repeat.stdout + repeat.stderr).includes(seedPassword));
    });
    await t.test('passwords and hashes never appear in captured responses or logs', () => {
      for (const secret of [password, nextPassword, initial.password_hash]) {
        assert.ok(!bodies.join('\n').includes(secret)); assert.ok(!logs.join('\n').includes(secret));
      }
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await db.$disconnect();
  }
});
