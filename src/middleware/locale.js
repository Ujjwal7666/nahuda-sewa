import { messages } from '../config/locales.js';
import { branding } from '../config/branding.js';
import { publicOrganization } from '../services/organization-settings.js';

export function localeMiddleware(req, res, next) {
  const locale = req.path === '/ne' || req.path.startsWith('/ne/') ? 'ne' : 'en';
  const contentPath = locale === 'ne' ? req.path.slice(3) || '/' : req.path;
  const alternateUrl = locale === 'ne' ? contentPath : `/ne${contentPath === '/' ? '' : contentPath}`;
  Object.assign(res.locals, {
    locale, t: messages[locale], branding, name: branding.name[locale], serviceCategories: [],
    homeUrl: locale === 'ne' ? '/ne' : '/', alternateUrl,
    donateUrl: locale === 'ne' ? '/ne/donate' : '/donate', isDonate: contentPath === '/donate',
    contentPath, localePrefix: locale === 'ne' ? '/ne' : '',
    year: new Date().getFullYear(), title: messages[locale].title,
    organization: publicOrganization(null, locale), isHome: contentPath === '/', publicOrigin: '',
    robots: req.path === '/admin' || req.path.startsWith('/admin/') ? 'noindex, nofollow' : 'index, follow',
  });
  next();
}
