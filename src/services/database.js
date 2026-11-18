import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

export function createDatabase(databaseUrl) {
  const url = new URL(databaseUrl);
  // Explicit decoding preserves URL-encoded credentials. All access remains through Prisma.
  const adapter = new PrismaMariaDb({
    host: url.hostname.replace(/^\[|\]$/g, ''), port: Number(url.port || 3306),
    user: decodeURIComponent(url.username), password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.slice(1)), connectionLimit: 5,
    connectTimeout: 5000, acquireTimeout: 10000, timezone: '+00:00',
  });
  return new PrismaClient({ adapter, log: [] });
}
