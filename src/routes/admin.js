import { Router, urlencoded } from 'express';
import session from 'express-session';
import { csrfProtection, loadAdmin, requireAdmin } from '../middleware/admin-auth.js';
import { adminController } from '../controllers/admin-controller.js';
import { cookieName, cookieOptions } from '../config/session.js';
import { createOrganizationRouter } from './organization-settings.js';
import { createReceiptAdminRouter } from './donation-receipts.js';
import { createFixedContentRouter } from './fixed-content.js';
import { modules } from '../config/fixed-content.js';
import {mediaModules} from '../config/media-content.js';
import {createMediaContentRouter} from './media-content.js';
import { createContactAdminRouter } from './contact-messages.js';

export function createAdminRouter(config, { auth, store, settings, receipts, content, mediaContent, messages } = {}) {
  const router = Router();
  router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  if (!auth || !store || !config.sessionSecret) {
    router.use((req, res) => res.status(503).render('admin/request-error', {
      title: 'Admin unavailable | Nahuda Sewa', message: 'Admin access is not configured. Please contact the site administrator.',
    }));
    return router;
  }
  router.use(session({ name: cookieName, secret: config.sessionSecret, store,
    resave: false, saveUninitialized: false, rolling: false, cookie: cookieOptions(config) }));
  router.use(loadAdmin(auth, config));
  for(const key of ['programs','services','serviceCategories','news','gallery','testimonials']) router.use(mediaModules[key].path.slice(6),createMediaContentRouter(mediaContent,mediaModules[key]));
  for (const key of ['about','vision','team','committee','lifeMembers']) router.use(modules[key].path.slice(6),createFixedContentRouter(content,modules[key]));
  router.use('/organization', createOrganizationRouter(settings));
  router.use(urlencoded({ extended: false, limit: '8kb', parameterLimit: 10 }));
  // All future Admin mutations inherit CSRF protection, including unknown routes.
  router.use(csrfProtection);
  const controller = adminController(auth, config);
  router.get('/login', controller.loginPage);
  router.post('/login', controller.login);
  router.use(requireAdmin);
  router.use('/messages/donation-receipts', createReceiptAdminRouter(receipts));
  router.use('/messages/contact-feedback', createContactAdminRouter(messages));
  router.get('/', (req, res) => res.redirect(303, '/admin/dashboard'));
  router.get('/dashboard', controller.dashboard);
  router.get(['/content','/messages'], controller.placeholder);
  router.get('/account', (req, res) => res.redirect(303, '/admin/account/change-password'));
  router.get('/account/change-password', controller.passwordPage);
  router.post('/account/change-password', controller.changePassword);
  router.post('/logout', controller.logout);
  return router;
}
