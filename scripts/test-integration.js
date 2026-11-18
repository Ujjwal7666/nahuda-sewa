import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { requireLocalDatabaseUrl } from '../src/config/env.js';
import { createDatabase } from '../src/services/database.js';

let db;
let created = false;
// This identifier is exclusively generated here, never accepted from user input.
const name = `nahuda_auth_test_${randomBytes(8).toString('hex')}`;
try {
  const url = new URL(requireLocalDatabaseUrl());
  db = createDatabase(url.href);
  await db.$executeRawUnsafe(`CREATE DATABASE \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  created = true;
  url.pathname = `/${name}`;
  const env = { ...process.env, DATABASE_URL: url.href, AUTH_TEST_DATABASE_URL: url.href, NODE_ENV: 'test' };
  const preservation = spawnSync(process.execPath, ['--test', 'test/committee-migration.integration.test.js'], {
    env:{...env,COMMITTEE_MIGRATION_DATABASE_URL:url.href},stdio:'inherit',timeout:30000,
  });
  if(preservation.status !== 0) throw new Error('Committee migration preservation rehearsal failed.');
  const activityPreservation=spawnSync(process.execPath,['--test','test/activity-migration.integration.test.js'],{
    env:{...env,ACTIVITY_MIGRATION_DATABASE_URL:url.href},stdio:'inherit',timeout:30000,
  });
  if(activityPreservation.status!==0) throw new Error('Activity migration preservation rehearsal failed.');
  const migrate = spawnSync(process.execPath, ['scripts/migrate-local.js'], { env, encoding: 'utf8', timeout: 60000 });
  if (migrate.status !== 0) throw new Error('Test migration failed.');
  console.log('Applied migration to a new isolated local test database.');
  const result = spawnSync(process.execPath, ['--test', '--test-concurrency=1', 'test/auth.integration.test.js', 'test/settings.integration.test.js', 'test/donation.integration.test.js', 'test/content.integration.test.js', 'test/media.integration.test.js', 'test/services.integration.test.js', 'test/programs.integration.test.js', 'test/contact.integration.test.js', 'test/home.integration.test.js'], { env, stdio: 'inherit', timeout: 180000 });
  process.exitCode = result.status === 0 ? 0 : 1;
} catch {
  console.error('Integration setup failed. Check local MySQL availability and CREATE DATABASE permissions.');
  process.exitCode = 1;
} finally {
  if (created) {
    // Drop only the random database successfully created by this invocation.
    try { await db.$executeRawUnsafe(`DROP DATABASE \`${name}\``); console.log('Isolated test database removed.'); }
    catch { console.error('Test database cleanup failed.'); process.exitCode = 1; }
  }
  await db?.$disconnect();
}
