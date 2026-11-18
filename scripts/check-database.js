import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { requireLocalDatabaseUrl } from '../src/config/env.js';

try {
  requireLocalDatabaseUrl();
  const child = spawn(process.execPath, [
    fileURLToPath(new URL('../node_modules/prisma/build/index.js', import.meta.url)),
    'db', 'execute', '--stdin',
  ], { stdio: ['pipe', 'pipe', 'pipe'], timeout: 20000 });
  // Do not print CLI diagnostics: they may contain connection details.
  child.stdout.resume();
  child.stderr.resume();
  child.stdin.on('error', () => {});
  child.stdin.end('SELECT 1;');
  child.on('error', () => { console.error('Unable to start Prisma connection check.'); process.exitCode = 1; });
  child.on('close', (code) => {
    if (code === 0) console.log('Local MySQL connection verified through Prisma. No tables changed.');
    else { console.error('Local MySQL check failed. Verify the server, local database, credentials and Prisma installation. Connection details have been withheld.'); process.exitCode = 1; }
  });
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
