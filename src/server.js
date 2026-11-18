import { createApp } from './app.js';
import { readConfig } from './config/env.js';
import { pruneAuthRecords } from './services/session-store.js';

const config = readConfig();
const app = createApp(config);
const server = app.listen(config.port, config.nodeEnv === 'production' ? undefined : config.host, () => {
  console.log(`Nahuda Sewa is listening on port ${config.port} (${config.nodeEnv}).`);
});
const cleanup = app.locals.db ? setInterval(() => {
  pruneAuthRecords(app.locals.db).catch(() => console.error('[auth-cleanup] Failed; retrying on next interval.'));
}, 15 * 60000) : null;
cleanup?.unref();
server.on('error', (error) => {
  console.error(`Server could not start (${error.code || 'unknown error'}). Check HOST and PORT.`);
  process.exitCode = 1;
});
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    clearInterval(cleanup);
    server.close(async () => { await app.locals.db?.$disconnect(); process.exit(0); });
  });
}
