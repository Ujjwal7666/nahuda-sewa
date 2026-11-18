import session from 'express-session';
import { createHash } from 'node:crypto';

const key = (sid) => createHash('sha256').update(sid).digest('hex');

export class PrismaSessionStore extends session.Store {
  constructor(db, lifetimeMs, namespace = '') {
    super();
    this.db = db;
    this.key = (sid) => key(namespace ? `${namespace}:${sid}` : sid);
    this.lifetimeMs = lifetimeMs;
  }

  get(sid, callback) {
    this.db.adminSession.findUnique({ where: { id: this.key(sid) } }).then((row) => {
      callback(null, row && !row.revoked && row.expires_at > new Date() ? JSON.parse(row.data) : null);
    }).catch(callback);
  }

  set(sid, value, callback = () => {}) {
    const id = this.key(sid);
    const data = JSON.stringify(value);
    const expires_at = new Date(value.cookie.expires);
    // A revoked row is a tombstone: an overlapping request cannot resurrect logout.
    this.db.$executeRaw`INSERT INTO admin_sessions (id, data, expires_at, revoked)
      VALUES (${id}, ${data}, ${expires_at}, false)
      ON DUPLICATE KEY UPDATE data = IF(revoked, data, ${data}),
        expires_at = IF(revoked, expires_at, ${expires_at})`
      .then(() => callback()).catch(callback);
  }

  destroy(sid, callback = () => {}) {
    const id = this.key(sid);
    const expires_at = new Date(Date.now() + this.lifetimeMs);
    this.db.$executeRaw`INSERT INTO admin_sessions (id, data, expires_at, revoked)
      VALUES (${id}, '{}', ${expires_at}, true)
      ON DUPLICATE KEY UPDATE data = '{}', revoked = true, expires_at = ${expires_at}`
      .then(() => callback()).catch(callback);
  }

  // Sessions have an absolute lifetime, so reads must not extend their expiry.
  touch(sid, value, callback = () => {}) { callback(); }
}

export async function pruneAuthRecords(db) {
  const where = { expires_at: { lt: new Date() } };
  await db.adminSession.deleteMany({ where });
  await db.authRateLimit.deleteMany({ where });
}
