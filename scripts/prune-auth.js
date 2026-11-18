import 'dotenv/config';
import { requireLocalDatabaseUrl } from '../src/config/env.js';
import { createDatabase } from '../src/services/database.js';
import { pruneAuthRecords } from '../src/services/session-store.js';

let db;
try {
  db = createDatabase(requireLocalDatabaseUrl());
  await pruneAuthRecords(db);
  console.log('Expired authentication records removed.');
} catch {
  console.error('Authentication cleanup failed. Check database availability.');
  process.exitCode = 1;
} finally { await db?.$disconnect(); }
