import { consumeRateLimit } from './rate-limit.js';
import { hashPassword, verifyPassword } from './passwords.js';

export function normalizeEmail(value) {
  if (typeof value !== 'string' || value.length > 254) return null;
  const email = value.trim().toLowerCase();
  return /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,63}$/.test(email) ? email : null;
}

export function authenticationService(db, config) {
  return {
    findAdmin: (id) => db.adminUser.findUnique({ where: { id } }),
    async authenticate(email, password) {
      const admin = await db.adminUser.findUnique({ where: { email } });
      const valid = await verifyPassword(password, admin?.password_hash);
      if (!valid || !admin?.is_active) return null;
      await db.adminUser.update({ where: { id: admin.id }, data: { last_login_at: new Date() } });
      return admin;
    },
    async changePassword(admin, password) {
      const password_hash = await hashPassword(password);
      // Compare-and-swap prevents overlapping changes from using a stale current password.
      const result = await db.adminUser.updateMany({
        where: { id: admin.id, session_version: admin.session_version, is_active: true },
        data: { password_hash, session_version: { increment: 1 } },
      });
      return result.count === 1;
    },
    async consumeAttempt(kind, ip, identifier) {
      return consumeRateLimit(db, config.sessionSecret, kind, [[`ip:${ip}`, config.loginIpMax], [`account:${identifier}`, config.loginAccountMax]], config.loginWindowMs);
    },
  };
}
