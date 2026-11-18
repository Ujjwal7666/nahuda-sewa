import {programsController} from './controllers/programs-controller.js';
import express from 'express';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { readConfig } from './config/env.js';
import { localeMiddleware } from './middleware/locale.js';
import { notFound, errorHandler } from './middleware/errors.js';
import { createPublicRouter } from './routes/public.js';
import { createAdminRouter } from './routes/admin.js';
import { createDatabase } from './services/database.js';
import { PrismaSessionStore } from './services/session-store.js';
import { authenticationService } from './services/authentication.js';
import { organizationSettingsService, publicOrganization } from './services/organization-settings.js';
import { donationReceiptService } from './services/donation-receipts.js';
import { createDonateRouter } from './routes/donate.js';
import { receiptLifetimeMs } from './config/donation.js';
import { fixedContentService } from './services/fixed-content.js';
import { fixedContentController } from './controllers/fixed-content-controller.js';
import { modules } from './config/fixed-content.js';
import {mediaContentService} from './services/media-content.js';
import {mediaContentController} from './controllers/media-content-controller.js';
import {galleryController} from './controllers/gallery-controller.js';
import {servicesController} from './controllers/services-controller.js';
import {serviceModules} from './config/services.js';
import {mediaModules} from './config/media-content.js';
import { contactSubmissionService } from './services/contact-submissions.js';
import { createContactRouter } from './routes/contact.js';
import { contactLifetimeMs } from './config/contact.js';

export function createApp(config = readConfig(), dependencies) {
  const app = express();
  app.set('env', config.nodeEnv);
  app.disable('x-powered-by');
  // cPanel commonly terminates HTTPS before forwarding requests to the app.
  // Trust one proxy hop so Express sessions can issue Secure cookies.
  app.set('trust proxy', config.nodeEnv === 'production' ? 1 : false);
  app.set('view engine', 'ejs');
  app.set('views', fileURLToPath(new URL('./views/', import.meta.url)));

  app.use((req, res, next) => {
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'X-Frame-Options': 'DENY',
      'X-Robots-Tag': req.path === '/admin' || req.path.startsWith('/admin/') ? 'noindex, nofollow' : 'index, follow',
      'Content-Security-Policy': "default-src 'self'; img-src 'self'; style-src 'self'; script-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
    });
    next();
  });
  app.use(localeMiddleware);
  app.use((req, res, next) => { res.locals.publicOrigin = config.publicOrigin; next(); });
  app.use('/assets', express.static(fileURLToPath(new URL('../public/assets/', import.meta.url)), {
    dotfiles: 'deny', index: false, redirect: false,
  }));
  app.get('/robots.txt', (req, res) => {
    res.type('text/plain').send(`User-agent: *\nAllow: /\nDisallow: /admin\nSitemap: ${config.publicOrigin}/sitemap.xml\n`);
  });
  app.get('/sitemap.xml', async (req, res, next) => {
    try {
      const paths = ['/', '/ne', '/about', '/ne/about', '/about/team', '/ne/about/team', '/about/committee', '/ne/about/committee', '/services', '/ne/services', '/programs', '/ne/programs', '/news', '/ne/news', '/gallery', '/ne/gallery', '/testimonials', '/ne/testimonials', '/contact', '/ne/contact', '/donate', '/ne/donate'];
      if (dependencies?.mediaContent) {
        const [services, categories, programs, news, albums] = await Promise.all([
          dependencies.mediaContent.list(mediaModules.services, true),
          dependencies.mediaContent.list(serviceModules.serviceCategories, true),
          dependencies.mediaContent.list(mediaModules.programs, true),
          dependencies.mediaContent.list(mediaModules.news, true),
          dependencies.mediaContent.galleryOverview(),
        ]);
        for (const row of services) paths.push(`/services/${row.slug}`, `/ne/services/${row.slug}`);
        for (const row of categories) paths.push(`/services/category/${row.slug}`, `/ne/services/category/${row.slug}`);
        for (const row of programs) paths.push(`/programs/${row.slug}`, `/ne/programs/${row.slug}`);
        for (const row of news) paths.push(`/news/${row.slug}`, `/ne/news/${row.slug}`);
        for (const row of albums) paths.push(`/gallery/${row.id}`, `/ne/gallery/${row.id}`);
      }
      const xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${[...new Set(paths)].map(path => `<url><loc>${config.publicOrigin}${path.replace(/&/g, '&amp;')}</loc></url>`).join('')}</urlset>`;
      res.type('application/xml').set('Cache-Control', 'public, max-age=300').send(xml);
    } catch (error) { next(error); }
  });
  app.use((req, res, next) => {
    if (['GET', 'HEAD'].includes(req.method) && req.path.length > 1 && req.path.endsWith('/')) {
      const query = req.originalUrl.includes('?') ? req.originalUrl.slice(req.originalUrl.indexOf('?')) : '';
      const path = req.path.replace(/\/+$/, '') || '/';
      // A leading double slash must never become an external redirect.
      if (!path.startsWith('//')) return res.redirect(308, path + query);
    }
    next();
  });
  if (!dependencies && config.databaseUrl) {
    const db = createDatabase(config.databaseUrl);
    app.locals.db = db;
    const uploadsDirectory = config.storageRoot ? join(config.storageRoot, 'uploads') : undefined;
    const receiptsDirectory = config.storageRoot ? join(config.storageRoot, 'receipts') : undefined;
    dependencies = { auth: authenticationService(db, config), store: new PrismaSessionStore(db, config.sessionLifetimeMs), settings: organizationSettingsService(db, uploadsDirectory) };
    dependencies.receipts = donationReceiptService(db,config,receiptsDirectory);
    dependencies.content = fixedContentService(db,uploadsDirectory);
    dependencies.mediaContent = mediaContentService(db,uploadsDirectory);
    dependencies.receiptStore = new PrismaSessionStore(db,receiptLifetimeMs,'donation');
    dependencies.messages = contactSubmissionService(db,config);
    dependencies.contactStore = new PrismaSessionStore(db,contactLifetimeMs,'contact');
  }
  app.use('/admin', createAdminRouter(config, dependencies));
  app.get('/media/:key', async (req, res) => {
    const asset = await dependencies?.settings?.findAsset(req.params.key);
    if (!asset) return res.sendStatus(404);
    res.type('png').set('Cache-Control', 'public, max-age=3600');
    res.sendFile(asset.storage_key, {root: dependencies.settings.root, dotfiles: 'deny'}, (error) => {
      if (error && !res.headersSent) res.sendStatus(404);
    });
  });
  app.use(async (req, res, next) => {
    if (dependencies?.mediaContent) res.locals.serviceCategories = await dependencies.mediaContent.list(serviceModules.serviceCategories,true);
    if (dependencies?.settings) {
      const row = await dependencies.settings.read();
      res.locals.organization = publicOrganization(row, res.locals.locale);
      res.locals.name = res.locals.organization.name;
      res.locals.title = res.locals.organization.site_title || (row ? res.locals.name : res.locals.title);
    }
    if (!res.locals.organization.site_description) res.locals.organization.site_description = res.locals.locale === 'ne'
      ? 'नहुदा सेवा, यसको संस्था, कार्यक्रम, समाचार र सामुदायिक कार्यबारे जानकारी लिनुहोस्।'
      : 'Learn about Nahuda Sewa, its organization, programs, news, and community work.';
    const canonicalPath = `${res.locals.localePrefix}${res.locals.contentPath === '/' && res.locals.localePrefix ? '' : res.locals.contentPath}` || '/';
    const canonical = `${config.publicOrigin}${canonicalPath}`;
    res.locals.seo = {
      description: res.locals.organization.site_description,
      canonical, en: `${config.publicOrigin}${res.locals.contentPath}`, ne: `${config.publicOrigin}/ne${res.locals.contentPath === '/' ? '' : res.locals.contentPath}`,
    };
    next();
  });
  app.use(createDonateRouter(config, dependencies));
  app.use(createContactRouter(config, dependencies));
  app.get(['/programs','/ne/programs'],programsController(dependencies?.mediaContent));
  app.get(['/programs/:slug','/ne/programs/:slug'],programsController(dependencies?.mediaContent,true));
  app.get(['/services','/ne/services'],servicesController(dependencies?.mediaContent));
  app.get(['/services/category/:slug','/ne/services/category/:slug'],servicesController(dependencies?.mediaContent,false,true));
  app.get(['/services/:slug','/ne/services/:slug'],servicesController(dependencies?.mediaContent,true));
  app.get(['/about/vision-mission','/ne/about/vision-mission'],(req,res)=>res.redirect(308,res.locals.localePrefix+'/about#vision-mission'));
  for (const key of ['about','team','committee']) app.get([modules[key].publicPath, '/ne'+modules[key].publicPath],fixedContentController(dependencies?.content,key));
  for(const key of ['news','testimonials']) app.get(['/'+key,'/ne/'+key],mediaContentController(dependencies?.mediaContent,key));
  app.get(['/gallery','/ne/gallery'],galleryController(dependencies?.mediaContent));
  app.get(['/gallery/:albumId','/ne/gallery/:albumId'],galleryController(dependencies?.mediaContent,true));
  app.get(['/news/:slug','/ne/news/:slug'],mediaContentController(dependencies?.mediaContent,'news',true));
  app.use(createPublicRouter(dependencies?.mediaContent,dependencies?.content));
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
