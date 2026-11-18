import { Router, urlencoded } from 'express';
import multer from 'multer';
import { requireAdmin, csrfProtection } from '../middleware/admin-auth.js';
import { settingsSections, assetSlots, validateSettings } from '../config/organization-fields.js';
import { SettingsError, assetUrl } from '../services/organization-settings.js';

export function createOrganizationRouter(settings) {
  const router = Router();
  router.use(requireAdmin);
  router.use((req, res, next) => {
    if (!settings) return res.status(503).render('admin/request-error', {title: 'Settings unavailable', message: 'Organization Settings are not configured.'});
    next();
  });
  const parse = multer({storage: multer.memoryStorage(), limits: {fileSize: 10*1024*1024, files: 5, fields: 65, parts: 71, fieldSize: 16000}}).fields(assetSlots.map(({key}) => ({name: key, maxCount: 1})));
  router.use(urlencoded({extended: false, limit: '96kb', parameterLimit: 65}));
  router.post('/settings', (req, res, next) => parse(req, res, (error) => {
    if (error) return res.status(400).render('admin/request-error', {title: 'Upload rejected', message: 'Upload rejected. Use at most five PNG, JPEG or WebP images, up to 10 MB each. Return to Organization Settings and try again.'});
    next();
  }));
  // Multipart files remain in bounded memory until the existing CSRF guard accepts the form.
  router.use(csrfProtection);
  const render = (res, row, values = row || {}, errors = [], saved = false, revision = row?.revision || 0) => res.render('admin/organization-settings', {
    title: 'Organization Settings | Nahuda Sewa', section: 'Organization', settingsSections, assetSlots, assetUrl,
    row: row || {}, values, errors, saved, revision,
  });
  router.get('/', (req, res) => res.redirect(303, '/admin/organization/settings'));
  router.get('/settings', async (req, res) => render(res, await settings.read(), undefined, [], req.query.saved === '1'));
  router.post('/settings', async (req, res) => {
    const {values, errors} = validateSettings(req.body);
    if (errors.length) return render(res.status(400), await settings.read(), values, errors, false, req.body.revision);
    try { await settings.save(values, req.body, req.files); }
    catch (error) {
      if (!(error instanceof SettingsError)) throw error;
      return render(res.status(error.status), await settings.read(), values, [error.message], false, req.body.revision);
    }
    res.redirect(303, '/admin/organization/settings?saved=1');
  });
  return router;
}
