import { normalizeEmail } from '../services/authentication.js';
import { validPasswordInput, validNewPassword, verifyPassword, passwordPolicy } from '../services/passwords.js';
import { establishSession, sessionAction } from '../middleware/admin-auth.js';
import { cookieName, cookieOptions } from '../config/session.js';

export function adminController(auth, config) {
  const loginView = (res, status = 200, error = '') => res.status(status).render('admin/login', {
    title: 'Admin login | Nahuda Sewa', error,
  });
  const passwordView = (res, status = 200, error = '') => res.status(status).render('admin/account', {
    title: 'Change password | Nahuda Sewa', section: 'Account', error, passwordPolicy,
  });
  const limit = async (req, res, kind, identifier, render) => {
    const result = await auth.consumeAttempt(kind, req.ip, identifier);
    if (result.allowed) return true;
    res.set('Retry-After', String(result.retryAfter));
    render(res, 429, 'Too many attempts. Please try again later.');
    return false;
  };
  return {
    loginPage(req, res) {
      if (req.admin) return res.redirect(303, '/admin/dashboard');
      loginView(res);
    },
    async login(req, res) {
      if (req.admin) return res.redirect(303, '/admin/dashboard');
      const email = normalizeEmail(req.body?.email);
      if (!await limit(req, res, 'login', email || 'invalid-input', loginView)) return;
      if (!email || !validPasswordInput(req.body?.password)) return loginView(res, 400, 'Enter a valid email address and password.');
      const admin = await auth.authenticate(email, req.body.password);
      if (!admin) return loginView(res, 401, 'Invalid credentials.');
      await establishSession(req, admin, config);
      res.redirect(303, '/admin/dashboard');
    },
    dashboard(req, res) {
      const success = req.session.notice || '';
      delete req.session.notice;
      res.render('admin/dashboard', { title: 'Dashboard | Nahuda Sewa', section: 'Dashboard', success });
    },
    placeholder(req, res) {
      const section = { '/organization': 'Organization', '/content': 'Content', '/messages': 'Messages' }[req.path];
      res.render('admin/placeholder', { title: `${section} | Nahuda Sewa`, section });
    },
    passwordPage(req, res) { passwordView(res); },
    async changePassword(req, res) {
      if (!await limit(req, res, 'password', String(req.admin.id), passwordView)) return;
      const { current_password, new_password, confirm_password } = req.body || {};
      if (!validPasswordInput(current_password) || !await verifyPassword(current_password, req.admin.password_hash)) {
        return passwordView(res, 400, 'Current password is incorrect.');
      }
      if (!validNewPassword(new_password)) return passwordView(res, 400, passwordPolicy);
      if (new_password !== confirm_password) return passwordView(res, 400, 'New passwords must match.');
      if (new_password === current_password) return passwordView(res, 400, 'Choose a different new password.');
      if (!await auth.changePassword(req.admin, new_password)) {
        await sessionAction(req, 'destroy');
        return res.redirect(303, '/admin/login');
      }
      await establishSession(req, { ...req.admin, session_version: req.admin.session_version + 1 }, config);
      req.session.notice = 'Password changed. Other sessions have been signed out.';
      await sessionAction(req, 'save');
      res.redirect(303, '/admin/dashboard');
    },
    async logout(req, res) {
      await sessionAction(req, 'destroy');
      const { maxAge, ...options } = cookieOptions(config);
      res.clearCookie(cookieName, options);
      res.redirect(303, '/admin/login');
    },
  };
}
