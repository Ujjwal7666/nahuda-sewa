import { randomBytes, timingSafeEqual } from 'node:crypto';

export const sessionAction = (req, action) => new Promise((resolve, reject) => {
  req.session[action]((error) => error ? reject(error) : resolve());
});

export function validCsrf(req) {
  const token = req.body?._csrf;
  return typeof token === 'string' && /^[a-f0-9]{64}$/.test(token) &&
    typeof req.session?.csrfToken === 'string' && req.session.csrfToken.length === 64 &&
    timingSafeEqual(Buffer.from(token), Buffer.from(req.session.csrfToken));
}

export function csrfProtection(req, res, next) {
  if (!req.session.csrfToken) req.session.csrfToken = randomBytes(32).toString('hex');
  res.locals.csrfToken = req.session.csrfToken;
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (!validCsrf(req)) {
    return res.status(403).render('admin/request-error', {
      title: 'Request expired | Nahuda Sewa',
      message: 'This form has expired or could not be verified. Reload the page and try again.',
    });
  }
  next();
}

export function loadAdmin(auth, config) {
  return async (req, res, next) => {
    res.locals.admin = null;
    if (req.session.adminId) {
      const admin = await auth.findAdmin(req.session.adminId);
      if (!admin?.is_active || admin.session_version !== req.session.adminVersion ||
          !req.session.authenticatedAt || Date.now() - req.session.authenticatedAt >= config.sessionLifetimeMs) {
        await sessionAction(req, 'regenerate');
      } else {
        req.admin = admin;
        res.locals.admin = { id: admin.id, name: admin.name, email: admin.email };
      }
    }
    next();
  };
}

export function requireAdmin(req, res, next) {
  if (!req.admin) return res.redirect(303, '/admin/login');
  next();
}

export async function establishSession(req, admin, config) {
  await sessionAction(req, 'regenerate');
  req.session.adminId = admin.id;
  req.session.adminVersion = admin.session_version;
  req.session.authenticatedAt = Date.now();
  req.session.cookie.maxAge = config.sessionLifetimeMs;
  req.session.csrfToken = randomBytes(32).toString('hex');
  await sessionAction(req, 'save');
}
