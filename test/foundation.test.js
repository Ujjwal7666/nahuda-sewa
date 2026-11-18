import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { createApp } from '../src/app.js';
import { readConfig, requireLocalDatabaseUrl } from '../src/config/env.js';
import { localeMiddleware } from '../src/middleware/locale.js';
import { errorHandler } from '../src/middleware/errors.js';

async function withServer(app, run) {
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try { await run(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise((resolve) => server.close(resolve)); }
}

test('localized foundation renders shared assets and a real language switch', async () => {
  await withServer(createApp(readConfig({ NODE_ENV: 'test' })), async (base) => {
    for (const [path, language, heading, alternate] of [
      ['/', 'en', 'Nahuda Sewa', '/ne'],
      ['/ne', 'ne', 'नहुदा सेवा', '/'],
    ]) {
      const response = await fetch(base + path);
      const html = await response.text();
      assert.equal(response.status, 200);
      assert.ok(html.includes(`<html lang="${language}">`));
      assert.ok(html.includes(heading));
      assert.ok(html.includes(`href="${alternate}"`));
      assert.ok(html.includes('/assets/images/logo.jpeg'));
      assert.ok(html.includes('/assets/css/app.css'));
      assert.ok(html.includes('/assets/js/app.js'));
      assert.equal(response.headers.get('x-powered-by'), null);
      assert.equal(response.headers.get('x-robots-tag'), 'index, follow');
      assert.match(html, /<meta name="robots" content="index, follow">/);
      assert.match(html, /rel="canonical"/);
    }
  });
});

test('public crawler files and localized metadata are available', async () => {
  await withServer(createApp(readConfig({ NODE_ENV: 'test' })), async (base) => {
    const robots = await fetch(`${base}/robots.txt`);
    assert.equal(robots.status, 200);
    assert.match(await robots.text(), /Disallow: \/admin(?:\r?\n|$)/);
    const sitemap = await fetch(`${base}/sitemap.xml`);
    assert.equal(sitemap.status, 200);
    assert.match(sitemap.headers.get('content-type'), /application\/xml/);
    const xml = await sitemap.text();
    assert.match(xml, /<loc>http:\/\/127\.0\.0\.1:\d+\/ne\/about<\/loc>/);
    assert.doesNotMatch(xml, /\/admin/);
    const admin = await fetch(`${base}/admin`);
    assert.equal(admin.headers.get('x-robots-tag'), 'noindex, nofollow');
  });
});

test('all representative public page families inherit paired locale metadata', async () => {
  await withServer(createApp(readConfig({ NODE_ENV: 'test' })), async (base) => {
    for (const path of ['/about', '/ne/about/team', '/about/committee', '/ne/testimonials', '/donate']) {
      const response = await fetch(base + path);
      const html = await response.text();
      assert.equal(response.status, 200, path);
      assert.match(html, /rel="canonical"/, path);
      assert.match(html, /hreflang="en"/, path);
      assert.match(html, /hreflang="ne"/, path);
      assert.match(html, /hreflang="x-default"/, path);
      assert.match(html, /content="index, follow"/, path);
      assert.match(html, /<meta name="description" content="[^"]+">/, path);
    }
  });
});

test('sitemap includes active bilingual dynamic content from the content service', async () => {
  const mediaContent = {
    list: async module => ({
      service: [{ slug: 'active-service' }], serviceCategory: [{ slug: 'active-category' }],
      program: [{ slug: 'active-program' }], news: [{ slug: 'published-story' }],
    })[module.model] || [],
    galleryOverview: async () => [{ id: 42 }],
  };
  const config = readConfig({ NODE_ENV: 'test', PUBLIC_ORIGIN: 'https://example.test' });
  await withServer(createApp(config, { mediaContent }), async base => {
    const response = await fetch(`${base}/sitemap.xml`);
    const xml = await response.text();
    assert.equal(response.status, 200);
    for (const route of ['/services/active-service', '/ne/services/active-service', '/services/category/active-category', '/programs/active-program', '/ne/news/published-story', '/gallery/42', '/ne/gallery/42']) {
      assert.ok(xml.includes(`https://example.test${route}`), route);
    }
  });
});

test('assets load and the served official logo is byte-identical', async () => {
  await withServer(createApp(readConfig({ NODE_ENV: 'test' })), async (base) => {
    for (const [path, type] of [['css/app.css', 'text/css'], ['js/app.js', 'javascript'], ['images/logo.jpeg', 'image/jpeg']]) {
      const response = await fetch(`${base}/assets/${path}`);
      assert.equal(response.status, 200);
      assert.ok(response.headers.get('content-type').includes(type));
    }
    const response = await fetch(`${base}/assets/images/logo.jpeg`);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), await readFile(new URL('../logo.jpeg', import.meta.url)));
  });
});

test('unknown and future routes are localized 404s; internal files stay private', async () => {
  await withServer(createApp(readConfig({ NODE_ENV: 'test' })), async (base) => {
    for (const path of ['/future-module', '/.env', '/package.json', '/docs/PROJECT.md', '/prisma/schema.prisma', '/assets/.env', '/assets/%2e%2e/%2e%2e/.env']) {
      const response = await fetch(base + path);
      assert.equal(response.status, 404, path);
      assert.ok(!(await response.text()).includes('DATABASE_URL'));
    }
    const response = await fetch(base + '/ne/missing');
    assert.equal(response.status, 404);
    assert.ok((await response.text()).includes('यो पृष्ठ उपलब्ध छैन।'));
  });
});

test('canonical trailing slashes redirect locally and preserve query strings', async () => {
  await withServer(createApp(readConfig({ NODE_ENV: 'test' })), async (base) => {
    const response = await fetch(base + '/ne/?check=1', { redirect: 'manual' });
    assert.equal(response.status, 308);
    assert.equal(response.headers.get('location'), '/ne?check=1');
    const suspicious = await fetch(base + '//example.com/', { redirect: 'manual' });
    assert.equal(suspicious.status, 404);
    assert.equal(suspicious.headers.get('location'), null);
  });
});

test('missing Admin configuration fails closed without breaking the public preview', async () => {
  await withServer(createApp(readConfig({ NODE_ENV: 'test' })), async (base) => {
    const response = await fetch(base + '/admin');
    assert.equal(response.status, 503);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.ok((await response.text()).includes('Admin access is not configured.'));
    assert.equal((await fetch(base + '/admin', { method: 'POST' })).status, 503);
  });
  assert.throws(() => readConfig({ NODE_ENV: 'production' }), /Production requires/);
});

test('configuration fails clearly without exposing supplied secrets', () => {
  assert.equal(readConfig({}).port, 3000);
  for (const env of [{ PORT: 'no' }, { PORT: '0' }, { PORT: '65536' }, { NODE_ENV: 'staging' }, { HOST: '0.0.0.0' }]) {
    assert.throws(() => readConfig(env));
  }
  assert.throws(() => requireLocalDatabaseUrl({}), /Set DATABASE_URL/);
  assert.throws(() => requireLocalDatabaseUrl({ DATABASE_URL: 'mysql://example:never-log-this@remote.invalid/db' }), /local MySQL only/);
  assert.doesNotThrow(() => requireLocalDatabaseUrl({ DATABASE_URL: 'mysql://local@127.0.0.1/db' }));
});

test('production errors do not expose details; localized template is safe', async (context) => {
  const application = express();
  application.set('env', 'production');
  application.set('view engine', 'ejs');
  application.set('views', fileURLToPath(new URL('../src/views/', import.meta.url)));
  application.use(localeMiddleware);
  application.get('/ne/failure', () => { throw new Error('PRIVATE_DATABASE_PASSWORD'); });
  application.use(errorHandler);
  const logged = [];
  context.mock.method(console, 'error', (...args) => logged.push(args.join(' ')));
  await withServer(application, async (base) => {
    const response = await fetch(base + '/ne/failure');
    const html = await response.text();
    assert.equal(response.status, 500);
    assert.ok(html.includes('केही समस्या भयो।'));
    assert.ok(!html.includes('PRIVATE_DATABASE_PASSWORD'));
    assert.ok(!logged.join('\n').includes('PRIVATE_DATABASE_PASSWORD'));
  });
});
