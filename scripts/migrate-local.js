import 'dotenv/config';
import { spawnSync } from 'node:child_process';
import { requireLocalDatabaseUrl } from '../src/config/env.js';

try {
  requireLocalDatabaseUrl();
  const result = spawnSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], {
    encoding: 'utf8', timeout: 60000,
  });
  if (result.error || result.status !== 0) throw new Error('Migration failed.');
  console.log('Local migrations applied successfully. Run npm run db:status to inspect history.');
} catch {
  console.error('Local migration failed. Check the local database configuration, availability and migration permissions.');
  process.exitCode = 1;
}
