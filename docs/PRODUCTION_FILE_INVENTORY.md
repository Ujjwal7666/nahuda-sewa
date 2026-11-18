# Production package file inventory

**Package root:** `deployment/production/`  
**Inventory date:** 2026-11-18  
**Included file count:** 188; excludes `node_modules/`, Git metadata, and runtime upload contents. This count includes nine production documents and empty-storage `.gitkeep` markers.  
**Included file size:** 3,686,144 bytes (3.69 MB / about 3.51 MiB), excluding `node_modules/` and Git metadata.

The package is copied from the current source tree, not from the older `release/nhuda-sewa-production` folder. That older folder was inspected by name and representative configuration only; it has an older CLI pin and was not modified or reused. `deployment/production/` did not exist before this task.

## Directory inventory

| Directory | Files | Purpose / runtime requirement |
|---|---:|---|
| Root | 7 | Package/lock, Prisma config, safe environment example, ignore rules, README, and the root logo fixture used by an included test. |
| `src/` | 108 | Express app/server, runtime configuration including persistent storage paths, routes/controllers/services/middleware, Tailwind input, and all EJS views. Required for runtime and CSS build. |
| `src/config/` | 15 | Runtime validation, storage path resolution, locales, fields, form policies, content modules, SEO/content helpers. Required by source imports. |
| `src/controllers/` | 7 | Public and Admin response/data preparation. |
| `src/middleware/` | 3 | Authentication/CSRF, locale, and error handling. |
| `src/routes/` | 9 | Nested Admin, content, contact, donation and organization route modules. |
| `src/services/` | 13 | Prisma/database, authentication/session/rate limits, content/settings, image/media handling and storage operations. |
| `src/styles/` | 1 | Tailwind source used by `npm run build`. |
| `src/views/` | 58 | All Admin, public, error and shared EJS templates. Every template include is preserved. |
| `public/assets/` | 17 | One compiled CSS file, seven browser JavaScript files, eight fonts/license files, and the official public logo. Served at runtime. |
| `prisma/` | 16 | `schema.prisma`, migration lock and all 14 ordered SQL migrations. Required for Prisma generation, validation and deployment migrations. |
| `scripts/` | 6 | Admin provisioning, DB helper scripts, local-only migration/check guards, auth pruning and isolated test runner. `migrate-local.js` and `check-database.js` reject remote DB hosts. |
| `test/` | 23 | Unit and MySQL integration test source. Included to preserve and run the package's existing `npm test` script. DB integration wrapper requires an explicitly isolated test DB; it is not run against cPanel. |
| `storage/uploads/` | 1 | Empty marker only. Runtime-created normalized public CMS media lives here; persistent/writable at runtime. |
| `storage/receipts/` | 1 | Empty marker only. Runtime-created private donor receipt media lives here; must remain private and persistent. |
| `docs/` | 9 | Deployment guide, cPanel setup and simple steps, environment contract, DB procedure, storage procedure, security report, GitHub workflow and this inventory. |

## Important included files

| Path | Purpose / requirement |
|---|---|
| `package.json`, `package-lock.json` | Exact existing dependency versions, scripts, Node engine range and reproducible npm installation. Lockfile was copied with the manifest; no additional package was introduced. |
| `src/server.js` | Actual process entry, `npm start` target, port binding, cleanup timer and SIGINT/SIGTERM shutdown. |
| `src/app.js` | Express app, public/admin routes, static assets and security/SEO response behavior. |
| `src/config/env.js` | Environment parsing and production validation. |
| `src/config/storage.js` | Resolves optional absolute `STORAGE_ROOT`; defines separate uploads and private-receipts directories with app-root fallback. |
| `prisma.config.ts`, `prisma/schema.prisma` | Prisma CLI configuration and ORM schema. |
| `prisma/migrations/**/migration.sql` | 14 additive migration files; no migration was run during package preparation. |
| `public/assets/css/app.css` | Generated CSS included so the package can render without a production-host build. |
| `scripts/create-admin.js` | Create-only first administrator provisioning; requires private `ADMIN_*` variables. |
| `scripts/migrate-local.js` | Local loopback-only helper; intentionally not used for remote production migrations. |
| `logo.jpeg` | Test fixture required by `test/foundation.test.js`; the live public logo is also included at `public/assets/images/logo.jpeg`. |
| `.env.example` | Placeholder-only configuration reference; not auto-loaded as `.env`. |
| `.gitignore` | Excludes real environment files, node_modules, generated test output, logs and runtime media files while retaining empty storage markers. |

## Complete included file manifest

The following paths are relative to the package root. They are generated from the production package, not the development tree. This manifest includes nine documentation files and both empty storage markers.

- `.env.example`
- `.gitignore`
- `docs/DATABASE_DEPLOYMENT.md`
- `docs/GITHUB_WORKFLOW.md`
- `docs/NEST_NEPAL_CPANEL_SETUP.md`
- `docs/NEST_NEPAL_CPANEL_SIMPLE_STEPS.md`
- `docs/PRODUCTION_DEPLOYMENT_GUIDE.md`
- `docs/PRODUCTION_ENVIRONMENT.md`
- `docs/PRODUCTION_FILE_INVENTORY.md`
- `docs/PRODUCTION_SECURITY_REPORT.md`
- `docs/UPLOAD_STORAGE.md`
- `logo.jpeg`
- `package-lock.json`
- `package.json`
- `prisma.config.ts`
- `prisma/migrations/202609300001_phase_2_auth/migration.sql`
- `prisma/migrations/202609300002_organization_settings/migration.sql`
- `prisma/migrations/202610010001_donation_receipts/migration.sql`
- `prisma/migrations/202610010002_phase_4_content/migration.sql`
- `prisma/migrations/202610010003_about_improvements/migration.sql`
- `prisma/migrations/202610020001_phase_5_media/migration.sql`
- `prisma/migrations/202610020002_gallery_improvements/migration.sql`
- `prisma/migrations/202610020003_dynamic_services/migration.sql`
- `prisma/migrations/202610020004_contact_feedback/migration.sql`
- `prisma/migrations/202610270001_committee_branches/migration.sql`
- `prisma/migrations/202611020001_activity_detail/migration.sql`
- `prisma/migrations/202611020002_programs/migration.sql`
- `prisma/migrations/202611040001_program_images_information/migration.sql`
- `prisma/migrations/202611170001_life_members/migration.sql`
- `prisma/migrations/migration_lock.toml`
- `prisma/schema.prisma`
- `public/assets/css/app.css`
- `public/assets/fonts/Mukta-Bold.ttf`
- `public/assets/fonts/Mukta-ExtraBold.ttf`
- `public/assets/fonts/Mukta-Medium.ttf`
- `public/assets/fonts/Mukta-OFL.txt`
- `public/assets/fonts/Mukta-Regular.ttf`
- `public/assets/fonts/Mukta-SemiBold.ttf`
- `public/assets/fonts/YatraOne-OFL.txt`
- `public/assets/fonts/YatraOne-Regular.ttf`
- `public/assets/images/logo.jpeg`
- `public/assets/js/activity-editor.js`
- `public/assets/js/activity-hero.js`
- `public/assets/js/app.js`
- `public/assets/js/gallery-admin.js`
- `public/assets/js/gallery.js`
- `public/assets/js/home.js`
- `public/assets/js/news-slug.js`
- `README.md`
- `scripts/check-database.js`
- `scripts/create-admin.js`
- `scripts/migrate-local.js`
- `scripts/prune-auth.js`
- `scripts/setup-admin.ps1`
- `scripts/test-integration.js`
- `src/app.js`
- `src/config/activity-rich-text.js`
- `src/config/branding.js`
- `src/config/contact.js`
- `src/config/donation.js`
- `src/config/env.js`
- `src/config/fixed-content.js`
- `src/config/home.js`
- `src/config/locales.js`
- `src/config/media-content.js`
- `src/config/organization-fields.js`
- `src/config/programs.js`
- `src/config/services.js`
- `src/config/storage.js`
- `src/config/session.js`
- `src/config/youtube.js`
- `src/controllers/admin-controller.js`
- `src/controllers/fixed-content-controller.js`
- `src/controllers/gallery-controller.js`
- `src/controllers/media-content-controller.js`
- `src/controllers/programs-controller.js`
- `src/controllers/public-controller.js`
- `src/controllers/services-controller.js`
- `src/middleware/admin-auth.js`
- `src/middleware/errors.js`
- `src/middleware/locale.js`
- `src/routes/admin.js`
- `src/routes/contact-messages.js`
- `src/routes/contact.js`
- `src/routes/donate.js`
- `src/routes/donation-receipts.js`
- `src/routes/fixed-content.js`
- `src/routes/media-content.js`
- `src/routes/organization-settings.js`
- `src/routes/public.js`
- `src/server.js`
- `src/services/authentication.js`
- `src/services/contact-submissions.js`
- `src/services/database.js`
- `src/services/donation-receipts.js`
- `src/services/fixed-content.js`
- `src/services/image-assets.js`
- `src/services/media-content.js`
- `src/services/media-references.js`
- `src/services/organization-settings.js`
- `src/services/passwords.js`
- `src/services/rate-limit.js`
- `src/services/service-showcase.js`
- `src/services/session-store.js`
- `src/styles/app.css`
- `src/views/admin/account.ejs`
- `src/views/admin/activity-editor.ejs`
- `src/views/admin/committee.ejs`
- `src/views/admin/contact-message.ejs`
- `src/views/admin/contact-messages.ejs`
- `src/views/admin/content-delete.ejs`
- `src/views/admin/content-form.ejs`
- `src/views/admin/content-list.ejs`
- `src/views/admin/dashboard.ejs`
- `src/views/admin/donation-receipt.ejs`
- `src/views/admin/donation-receipts.ejs`
- `src/views/admin/gallery-image-grid.ejs`
- `src/views/admin/gallery-upload.ejs`
- `src/views/admin/login.ejs`
- `src/views/admin/media-asset.ejs`
- `src/views/admin/media-delete.ejs`
- `src/views/admin/media-form.ejs`
- `src/views/admin/media-list.ejs`
- `src/views/admin/organization-settings.ejs`
- `src/views/admin/partials/end.ejs`
- `src/views/admin/partials/sidebar.ejs`
- `src/views/admin/partials/start.ejs`
- `src/views/admin/placeholder.ejs`
- `src/views/admin/program-information-editor.ejs`
- `src/views/admin/program-view.ejs`
- `src/views/admin/request-error.ejs`
- `src/views/admin/service-slug.ejs`
- `src/views/errors/status.ejs`
- `src/views/partials/footer.ejs`
- `src/views/partials/head.ejs`
- `src/views/partials/header.ejs`
- `src/views/partials/navigation.ejs`
- `src/views/partials/social-icon.ejs`
- `src/views/public/about-content.ejs`
- `src/views/public/committee-content.ejs`
- `src/views/public/contact.ejs`
- `src/views/public/donate.ejs`
- `src/views/public/foundation.ejs`
- `src/views/public/gallery.ejs`
- `src/views/public/gallery/album-card.ejs`
- `src/views/public/gallery/album-detail.ejs`
- `src/views/public/gallery/album-grid.ejs`
- `src/views/public/gallery/lightbox.ejs`
- `src/views/public/gallery/photo-grid.ejs`
- `src/views/public/media-content.ejs`
- `src/views/public/news/news-card.ejs`
- `src/views/public/news/news-detail.ejs`
- `src/views/public/organization-content.ejs`
- `src/views/public/program-gallery.ejs`
- `src/views/public/programs.ejs`
- `src/views/public/services.ejs`
- `src/views/public/services/activity-cover.ejs`
- `src/views/public/services/activity-detail.ejs`
- `src/views/public/services/activity-gallery.ejs`
- `src/views/public/services/activity-hero.ejs`
- `src/views/public/services/category-showcase.ejs`
- `src/views/public/services/section-navigation.ejs`
- `src/views/public/services/service-card.ejs`
- `storage/receipts/.gitkeep`
- `storage/uploads/.gitkeep`
- `test/activity-migration.integration.test.js`
- `test/auth.integration.test.js`
- `test/committee-migration.integration.test.js`
- `test/contact.integration.test.js`
- `test/contact.test.js`
- `test/content.integration.test.js`
- `test/content.test.js`
- `test/donation.integration.test.js`
- `test/donation.test.js`
- `test/foundation.test.js`
- `test/gallery.test.js`
- `test/home.integration.test.js`
- `test/home.test.js`
- `test/media.integration.test.js`
- `test/media.test.js`
- `test/programs.integration.test.js`
- `test/programs.test.js`
- `test/security.test.js`
- `test/services.integration.test.js`
- `test/services.test.js`
- `test/settings.integration.test.js`
- `test/settings.test.js`
- `test/youtube.test.js`

## Excluded files and directories

| Excluded source path/type | Reason |
|---|---|
| `node_modules/` | Reproducibly installed from the included lockfile; native modules must match the server platform. |
| Parent development repository `.git/` | Not copied into this package. The production folder has its own separate Git metadata, which is excluded from this application-file count. |
| `.env`, `.env.local`, `.env.*` real files | May contain secrets; only placeholder `.env.example` is present. |
| `storage/uploads/**` and `storage/receipts/**` source contents | Local CMS images and private receipt data must not be blindly transferred. Only empty folder markers are included. |
| Local DB dumps, backups and private test data | Not required by runtime; contain sensitive or environment-specific records. |
| Root `.local/`, coverage, test result output, logs and caches | Local/generated development artifacts. |
| Root `release/nhuda-sewa-production/` | Older existing release folder; not used as source of truth, not changed, and not copied over. |
| Root `branding-upload-ready/` | Not referenced by runtime imports or asset paths; equivalent active logo is already in `public/assets/images/`. |
| Root historical project/phase docs and screenshots | Development history and QA evidence; package contains only its nine relevant deployment/operations documents. |
| `DEPLOYMENT-GUIDE.txt` and legacy host-specific instructions | Historical provider references conflict with the current target; current code and package documentation are authoritative. |

The original development project was not modified for this approved change. The production package adds configurable storage-root support while preserving existing app-root paths as the fallback and preserving the `/media/<key>` route.

## Package verification record

The installation/build/test/runtime results below were run before the approved `STORAGE_ROOT` source change. They are historical package verification, not post-change regression results.

- `npm ci --include=dev`: **PASS**, exact lockfile installation succeeded. npm reported that three package lifecycle scripts were not approved by this local npm policy; explicit client generation succeeded. Verify the cPanel install-script policy separately.
- `npm run db:generate`: **PASS**, Prisma Client 7.10.1 generated package-locally.
- `npm run db:validate`: **PASS**, schema valid; no DB connection.
- `npm test`: **PASS**, 53 passed, 0 failed, 11 DB-backed wrappers skipped. No MySQL integration run from this package because no isolated test DB was configured.
- `npm run build`: **PASS**, Tailwind CSS 4.3.5; output 99,910 bytes at `public/assets/css/app.css`.
- EJS compile: **PASS**, all 58 templates compile. Static references: 246 local imports, 83 EJS includes, 14 local asset references; no missing targets.
- Production-only dependency tree: **PASS**, `npm prune --omit=dev` and `npm ls --omit=dev --depth=0`; generated Prisma client initializes with the MariaDB adapter after pruning.
- Runtime: **PASS within boundary**, `npm start` in production mode starts from this folder with synthetic configuration; `/robots.txt` and CSS return 200. No DB connection was attempted. Test-mode package smoke routes rendered in both languages and returned 200.
- Package file safety: **PASS**, 188 application/package files, 58 EJS views, 14 migration directories, compiled CSS present; no `.env` (other than example), `node_modules`, parent-project Git metadata, local uploads, receipt files, database dumps, or package symlinks. This separate production repository's own `.git/` metadata is excluded from the file count.
- Storage-root change: static code review confirms `STORAGE_ROOT` selects `<root>/uploads` and `<root>/receipts`, requires an absolute path, and defaults to the original app-root `storage/` paths when unset. `node --check` passed for the five changed JavaScript files. Public `/media/:key` and authenticated receipt route wiring are unchanged. The test suite was not rerun after the code change; no cPanel path has been created/configured and no upload was tested.
- The temporary package `node_modules/` used for the earlier installation/build checks was removed. No production migration, seed, app database connection, cPanel file upload, or application start has been performed.

MySQL-dependent integration tests require a separately configured isolated test database. Do not point the test runner at development or production. Prior source-tree integration results are not substituted for a package-local database test.
