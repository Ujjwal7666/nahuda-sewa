# Nahuda Sewa — Nest Nepal cPanel setup preparation

**Status:** interactive preparation is in progress. The owner has configured a stopped Node.js application entry and created the empty production database and user. No application files or secrets have been uploaded, no migrations have been run, and no DNS/SSL setting has been changed.

## Owner-reported account checks (2026-11-18)

- cPanel offers Node.js **24.22.3**; it is selected in Production mode.
- The app entry is `nahuda-sewa-app` at the root of `nahudasewa.com`, with startup file `src/server.js`. The domain is new and had no existing site, according to the owner.
- The app is currently stopped. cPanel created `public/`, `src/`, `tmp/`, and `stderr.log` inside the app root. These are cPanel-created files/folders, not the production application package. Do not delete or replace them blindly; inspect before any later upload.
- The environment-variable section is empty.
- phpMyAdmin reports MariaDB **10.11.20**, connection collation `utf8mb4_unicode_ci`, and server character set `cp1252`. The owner created database `nahudase_nsprod` and confirmed its own collation is `utf8mb4_unicode_ci`; the server-wide charset was not changed.
- The owner created database user `nahudase_nsapp` and assigned it privileges on `nahudase_nsprod`. No migration has been run.
- cPanel Terminal is available. The owner reports PHP 8.4.27 in phpMyAdmin; that PHP version does not determine the Node.js app runtime.
- No production environment values or source files have been added. The app remains stopped and no migration or deployment has been performed.

## 1. Confirmed application requirements

| Setting | Project requirement |
|---|---|
| Application | Nahuda Sewa bilingual public website and Admin CMS |
| Runtime | Node.js ESM; `package.json` requires `>=24.0.0 <25` |
| Entry file | `src/server.js` |
| Start script | `npm start` → `node src/server.js` |
| Framework / views | Express 5 and EJS |
| Database | MySQL through Prisma 7 and `@prisma/adapter-mariadb` |
| Schema / migrations | `prisma/schema.prisma`; 14 ordered directories under `prisma/migrations/` |
| Static assets | `public/assets/`, served at `/assets/`; compiled CSS is already included |
| Public CMS image files | `<STORAGE_ROOT>/uploads/` when configured; otherwise `<application-root>/storage/uploads/`. Served only through database-backed `/media/:key`. |
| Private donation receipts | `<STORAGE_ROOT>/receipts/` when configured; otherwise `<application-root>/storage/receipts/`. Served through Admin-protected routes only. |
| Email | No SMTP or outbound email integration is implemented |
| cPanel environment | Production requires `DATABASE_URL` and `SESSION_SECRET`; `STORAGE_ROOT` is recommended for persistent media; cPanel supplies the process `PORT` when using a Node app manager |

The current application listens on `config.port`. In production `src/server.js` calls `app.listen(config.port, undefined, ...)`, leaving the interface selection to Node while using the supplied port. It does not hardcode a production port. `HOST`, if present, is still validated as a loopback value, but it is not passed to `listen()` in production. Do not set a cPanel-assigned port manually if the cPanel application manager owns `PORT`.

The server handles `SIGINT` and `SIGTERM` by closing its listener and disconnecting Prisma. It sets Express proxy trust to one hop in production. This assumes the host has one trusted reverse proxy in front of the app; confirm that topology before relying on Secure cookies and client IP rate limiting.

## 2. Node.js compatibility

The production package's declared contract is Node `>=24.0.0 <25`. The package was locally verified on Node 24.19.0. A static scan of the application source did not find an API that obviously requires Node 24 specifically; however, the application has not been installed, built, or regression-tested on Node 22 in this preparation step. The package manifest and lock are the authority for the approved runtime.

Current Prisma 7 documentation accepts Node `^20.19.0`, `^22.12.0`, or `^24.0.0`, and the locked direct packages inspected also have lower engine floors. That indicates some dependency compatibility with Node 22, **not** that this application is approved or verified on Node 22. The app explicitly excludes it in `package.json`. As of this guide's review date, the official Node release schedule lists Node 24 as LTS and Node 22 as end-of-life (2026-11-11). Keep the package requirement unchanged.

**Decision:** Node 24.x is required by the current package. If the account does not offer Node 24, do not deploy with Node 22 or edit the engine range as a hosting workaround. Ask Nest Nepal whether Node 24 can be enabled on this account, or pause for an explicitly scoped compatibility change followed by install/build/test verification on the alternate version.

Nest Nepal's public Node hosting page advertises Node.js, cPanel and MySQL but does not publish a per-account Node version list. The owner has now confirmed that this account's selector offers Node.js 24.22.3, satisfying the app's major-version requirement. Current cPanel documentation makes available versions provider-dependent; some legacy cPanel installation documentation lists Node versions only through 22, while its newer Websites hub lets an account choose from versions the provider has enabled.

### Check in your cPanel account

1. The owner reports the tool is **Setup Node.js App / Web Applications**. The app entry has been created and stopped.
2. The owner reports the version selector offers **24.22.3**, selected for this app. No passwords or hidden values were shared.
4. If the selector is missing or does not show Node 24, ask Nest Nepal support: “Can Node.js 24.x be enabled for my cPanel account’s Node application environment? Which application manager/process manager is enabled, and what startup-file/command format does it require?”
5. Also ask whether the account supports Prisma 7 with `@prisma/adapter-mariadb`, the required Node native module used by `sharp`, and a persistent writable filesystem for application storage.

You can share a screenshot with account names, domain names, and credentials obscured, or just report the selector values and screen labels. No credentials are needed for this assessment.

## 3. cPanel application values (do not submit yet)

| cPanel field | Project-specific value / status |
|---|---|
| Application name | `Nahuda Sewa` (display label; exact field support is cPanel-version dependent) |
| Application mode | Production; set cPanel run mode to Production and ensure the runtime has `NODE_ENV=production` |
| Node.js version | Node 24.x only, after confirming it is available in this account |
| Application root | A stable directory in the cPanel account home directory, **outside `public_html`**, for example `nahuda-sewa-app`. This is only an example; choose the path shown/accepted by the account and confirm it is not already in use. |
| Application URL | Unknown. Use the intended domain/subdomain only after the owner confirms it. Do not change DNS or map the live domain during preparation. |
| Startup file | `src/server.js` |
| Startup command | `npm start` (`node src/server.js`) if the app manager accepts npm start commands. If the interface accepts only a startup-file path, select `src/server.js` only if that path is supported; otherwise stop and ask before adding any wrapper. |
| Install command | `npm ci --include=dev` so the lockfile is honored and Prisma/Tailwind build tools are available. Confirm the account's app manager permits custom install/build commands. |
| Build / prepare | `npm run db:generate`, `npm run db:validate`, and `npm run build`, after Node and the private environment are configured. The build writes CSS in place; it does not create a `dist/` directory. |
| Process port | cPanel/Passenger-assigned `PORT`; do not hardcode or manually override it where the manager reserves it. |

Do not expose the application root as a static document root or put it under `public_html`. The app manager should route the selected app URL to the Node process. If cPanel's selected deployment tool requires a generated output directory, ask the provider which server-app workflow to use: this package is an Express server and its build script does not emit a separate output folder.

### Install/build/start sequence

From the actual application root, using the hosting account's configured Node 24.x runtime:

```sh
npm ci --include=dev
npm run db:generate
npm run db:validate
npm run build
npm start
```

Do not run this in the development project or against a live database during preparation. `db:validate` validates schema configuration; it is not a connectivity test. The production CSS is already in the repository, but `npm run build` rebuilds it from the included Tailwind source.

The current `npm run db:migrate` helper intentionally rejects remote MySQL hosts. Do **not** use it for cPanel. The reviewed production command after a separately approved backup is `npx prisma migrate deploy`; see [DATABASE_DEPLOYMENT.md](DATABASE_DEPLOYMENT.md). No migration has been run for this hosting preparation.

## 4. Environment variables

Use the cPanel application's private environment-variable screen when available. The values below are names and purposes only; no production values have been provided or configured. For cPanel's newer Web Apps interface, its documentation says `PORT` is reserved by the platform and cannot be set manually. A legacy interface may differ; follow the interface's behavior and don't override a manager-assigned port.

| Variable | Required? | Purpose / source |
|---|---|---|
| `NODE_ENV` | Required in effect | Must be `production`. Set via the cPanel Production run-mode control if that control supplies it; otherwise set this exact variable. Confirm the resulting runtime mode. |
| `PORT` | Required at runtime; platform supplied | App listener port assigned by cPanel/Passenger. Do not invent a value or override a reserved value. |
| `DATABASE_URL` | Yes | MySQL URL from the cPanel database/user details. Format: `mysql://DB_USER:URL_ENCODED_PASSWORD@DB_HOST:3306/DB_NAME`; all components are placeholders. URL-encode special characters in username/password. Keep private. |
| `SESSION_SECRET` | Yes | Private random value of at least 32 bytes. Generate/store privately; never commit, log, or share it. |
| `PUBLIC_ORIGIN` | Operationally required for correct production SEO | The confirmed HTTPS origin, with no path, such as `https://YOUR_CONFIRMED_DOMAIN`. It drives canonical URLs and sitemap links. The app can start without it, but would otherwise derive a local HTTP origin. |
| `STORAGE_ROOT` | Optional, recommended for production persistence | Absolute path outside the Git checkout; app creates/uses `uploads/` and `receipts/` beneath it. Proposed account path: `/home1/nahudase/nahuda-sewa-storage`; create and verify it before setting this value. |
| `HOST` | Optional | Defaults to `127.0.0.1`; only `127.0.0.1`, `localhost`, or `::1` pass validation. Production `listen()` does not use this value. Leave unset unless the provider specifically requires a compatible value. |
| `SESSION_LIFETIME_MINUTES` | Optional | Admin session duration; default `480`; permitted range `5`–`1440`. |
| `LOGIN_WINDOW_MINUTES` | Optional | Admin login rate-limit window; default `15`; range `1`–`60`. |
| `LOGIN_IP_MAX` | Optional | Login attempts per IP/window; default `20`; range `1`–`100`. |
| `LOGIN_ACCOUNT_MAX` | Optional | Login attempts per account/window; default `10`; range `1`–`100`. |
| `RECEIPT_WINDOW_MINUTES` | Optional | Donation-receipt submission rate-limit window; default `60`; range `1`–`1440`. |
| `RECEIPT_IP_MAX` | Optional | Receipt submissions per IP/window; default `10`; range `1`–`100`. |
| `RECEIPT_EMAIL_MAX` | Optional | Receipt submissions per email/window; default `5`; range `1`–`100`. |
| `CONTACT_WINDOW_MINUTES` | Optional | Contact submission rate-limit window; default `60`; range `1`–`1440`. |
| `CONTACT_IP_MAX` | Optional | Contact submissions per IP/window; default `10`; range `1`–`100`. |
| `CONTACT_EMAIL_MAX` | Optional | Contact submissions per email/window; default `5`; range `1`–`100`. |
| `ADMIN_NAME` | One-time provisioning only | Name supplied privately to `npm run admin:create`; not a runtime setting. |
| `ADMIN_EMAIL` | One-time provisioning only | Initial Admin email supplied privately to `npm run admin:create`; not a runtime setting. |
| `ADMIN_PASSWORD` | One-time provisioning only | Initial Admin password supplied privately to the provisioning process; not a runtime setting. Never put it in a command-line argument, Git, or logs. Remove it after provisioning. |

There are **no** SMTP or email environment variables in the current application. `STORAGE_ROOT` is the one optional storage-path variable. No optional integrations are configured. See [.env.example](../.env.example) and [PRODUCTION_ENVIRONMENT.md](PRODUCTION_ENVIRONMENT.md) for the source example. `.env.example` contains placeholders only.

If the account has no private environment panel, the app imports `dotenv` and reads `.env` from its current working directory. Only as a fallback, a real `.env` would need to be created in the application root (which must be outside the web root), excluded from Git, protected with owner-only permissions such as `0600`, and verified not to be overwritten during redeploy. Prefer cPanel's environment panel. Never send the file or values to me.

## 5. MySQL and Prisma preparation

The schema uses Prisma's `mysql` provider and the runtime adapter `@prisma/adapter-mariadb`. Prisma 7's official MySQL connector documentation supports self-hosted MySQL 5.6+ and MariaDB 10.0+; those are Prisma compatibility floors, **not** a recommendation to use an obsolete server. Ask Nest Nepal for the exact database product/version and use the provider's currently maintained version. Confirm its compatibility with the locked adapter/driver and migration tooling.

The schema contains 26 Prisma models covering Admin accounts/sessions/rate limits, organization settings, English/Nepali content, team, committee/branches/life members, public media, services/programs/news/gallery/testimonials, contacts, and donation receipts. Relations, uniqueness, indexes, and foreign keys are declared in `prisma/schema.prisma` and the 14 checked-in migrations. There are no seeders. No migration explicitly sets a table/database collation. The owner created the production database with `utf8mb4_unicode_ci`, which is appropriate for Nepali Unicode content; the server-level character set shown by phpMyAdmin is `cp1252`, but it was not changed. Do not alter the server-wide charset or issue `SET NAMES` on pooled application connections.

### Later, after account details and explicit approval

1. In cPanel **MySQL Databases** (or its enabled database feature), create a new database using the account's required name/prefix. Create a dedicated database user with a long, unique password using the provider's private UI. Do not put the password in this guide or a Git-tracked file.
2. Grant the user access to that database. The application needs normal runtime data access; the migration operation needs schema-change privileges. Prefer separate runtime and migration users if cPanel supports them, but the app currently has only one `DATABASE_URL` name, so the migration URL must be supplied privately just for the migration process and then replaced with the runtime URL. Ask the provider what grant set is supported; do not grant global privileges.
3. Record the database name, database host (which may differ from `localhost`), port, version, charset/collation, username, and permitted connections in a private operations record. A `localhost` host assumption is not safe; use the exact host shown by cPanel.
4. Verify the database/user pairing and grants through the provider UI. Do not paste passwords into a shell command or support ticket. Confirm the host permits the app process to connect to MySQL.
5. Before migrating, create and verify a backup of the empty/new target (or existing target if it is not empty). Review all 14 migration SQL files and ensure the database identity shown in the private command environment is the intended production database.
6. With Node 24, the app root and private migration URL selected, run `npx prisma migrate deploy` only after migration approval. This applies checked-in migrations without seeding. Do not run `npm run db:migrate` remotely; that local helper rejects remote hosts. Never run `migrate reset` or `db push` on production.
7. Inspect `npx prisma migrate status`, table names, indexes, foreign keys and database charset; then run an application-level connection/read-write check only after database and deployment approval.
8. The earlier package test run skipped 11 database-backed wrappers because no isolated MySQL test database was available. No application connection or production integration has been verified. Use a separate isolated test/staging database to complete the skipped integration coverage; never point that runner at production.

Back up before schema changes and rehearse restore separately. The app does not contain an export/import command. Organization content and media transfer are a separate owner-approved task; avoid importing a development dump wholesale. See [DATABASE_DEPLOYMENT.md](DATABASE_DEPLOYMENT.md).

## 6. Persistent upload storage

The current code supports one optional `STORAGE_ROOT` absolute path:

- Public CMS images: `<STORAGE_ROOT>/uploads/`, exposed as `/media/<UUID>.png` only when a `MediaAsset` database record references the file.
- Private donation receipts: `<STORAGE_ROOT>/receipts/`, returned only by authenticated Admin routes.

If `STORAGE_ROOT` is unset, the app preserves its previous default paths under `<application-root>/storage/`. For this account, the proposed separate root is `/home1/nahudase/nahuda-sewa-storage`, outside the app root and `public_html`. This is an example based on the reported home directory; confirm it is writable before using it. Do not point storage at `public_html`, make it world-writable, serve raw storage through Apache, or make receipts public.

Create the root and both child directories as the cPanel application user. Start with `0750` for public uploads and `0700` for receipts, subject to the provider's account/ACL requirements; confirm the Node process can create, read, replace and remove files. Then set `STORAGE_ROOT` to the parent directory in the cPanel environment panel. Images are PNG/JPEG/WebP, at most 10 MiB each, decoded maximum 16 megapixels and normalized to PNG under 12 MiB. Gallery submissions can contain up to five images; confirm proxy/request-body and memory limits. Receipts are private and must stay separate.

The production repository ignores application-root uploads. With `STORAGE_ROOT` pointing outside the repository, Git updates will not contain those files. Confirm cPanel redeploy does not remove files outside the app root. Back up MySQL and both storage directories together. Test persistence after an approved restart/redeploy with non-sensitive test media. Details are in [UPLOAD_STORAGE.md](UPLOAD_STORAGE.md).

## 7. Security, HTTPS, logs, and operations

- **Production mode:** cPanel run mode must be Production and runtime `NODE_ENV` must resolve to `production`. This turns on secure session cookies and one-hop proxy trust.
- **HTTPS / domain:** use the owner-confirmed domain, enable provider SSL through its normal process, set matching `PUBLIC_ORIGIN=https://...`, and verify HTTPS and canonical/sitemap host before public promotion. No DNS/SSL setting is changed here.
- **Sessions:** keep `SESSION_SECRET` private and at least 32 bytes. Session cookies are HttpOnly, SameSite Lax, and Secure in production. Confirm cPanel forwards HTTPS correctly through exactly one trusted proxy hop; do not disable Secure cookies or widen proxy trust to make a failed setup pass.
- **Database:** keep the DB user dedicated and least-privilege; keep credentials only in private cPanel environment settings. Confirm the DB is not publicly accessible beyond provider-approved app connections.
- **Permissions:** app files need read access; `<STORAGE_ROOT>/uploads/` needs application-user write access; `<STORAGE_ROOT>/receipts/` must be private and writable only by the app account. Keep both app root and storage outside the web document root.
- **Uploads:** code validates PNG/JPEG/WebP format, signature, size and decoded dimensions and generates random names. Verify cPanel/proxy body limit for a five-image batch; do not raise application limits without a reviewed reason.
- **Errors and logs:** app writes brief startup and generic error messages to stdout/stderr and avoids logging request bodies/database error details. Use cPanel App Logs/Passenger logs if enabled; do not paste logs containing URLs or personal data into public channels. Confirm disk/quota/retention with the provider.
- **Backups:** obtain provider details for MySQL and application-file backup frequency/retention, and independently keep restricted backups of database plus both media directories. Rehearse restoring into separate locations before relying on backups. Never assume a plan's advertised backup frequency covers your app's storage consistently.
- **Dependencies:** the package security report records a High advisory in development/build tooling (`picomatch` through Tailwind/Parcel) and zero findings in the production-only dependency audit. This is not a complete security approval. Recheck before an approved release; no speculative dependency upgrade is made.

## 8. cPanel checklist — confirm before any deployment

Please collect these facts from cPanel/Nest Nepal. No actual passwords or hidden environment values are needed:

- [ ] Which Node app screen is enabled: **Websites & Apps**, **Setup Node.js App**, or **Application Manager**?
- [ ] Does the version selector offer Node 24.x? What exact version?
- [ ] Does it support a custom startup file `src/server.js`, a startup command `npm start`, or both?
- [ ] Can the install command be `npm ci --include=dev` and can the build/prepare command run Prisma generation and `npm run build` without needing a nonexistent `dist/` output?
- [ ] Is `PORT` injected/reserved by the manager, and does it proxy requests to the process listener?
- [ ] What application-root path is available outside `public_html`? Is it stable across code redeploys?
- [ ] Does the account support Node's required native `sharp` runtime, and does Prisma 7's MariaDB adapter work on that server?
- [x] MariaDB version 10.11.20 and database collation `utf8mb4_unicode_ci` are confirmed. Still confirm the app connection host, connection limit, and Node-to-database connectivity before migration.
- [x] A dedicated database user is assigned to the application database. Confirm migration command/privileges by running the approved migration only at the migration stage.
- [ ] Does the app process have persistent writable storage outside the Git checkout? Does redeploy preserve it?
- [ ] What are the per-request body, memory, CPU, process, disk and timeout limits? Is five-image gallery upload feasible?
- [ ] Does the account provide a private environment-variable panel? The creation screen showed an empty environment-variable list and Production mode; confirm how variable changes are applied (restart or redeploy).
- [ ] What HTTPS proxy topology is used, and is the Express one-hop trust setting correct?
- [ ] What are actual backup schedule/retention and restore steps for MySQL and app files?

For provider support, ask for capability information only; do not send them this guide with secrets (it contains none), and do not provide repository write credentials unless an approved deployment process requires it.

## 9. Required actions and current blockers

1. Confirm cPanel's app-specific Node environment/port behavior and whether `npm ci --include=dev`, Prisma 7, and native `sharp` are supported in this account.
2. Database name, user, MariaDB version, and `utf8mb4_unicode_ci` are confirmed. Still confirm the database host and connection limits; migrations have not run.
3. The domain `nahudasewa.com` is selected. Confirm SSL is active and the one-hop proxy behavior before setting `PUBLIC_ORIGIN` or accepting credentials.
4. `STORAGE_ROOT` support is now implemented in the production source. Create the external directories, configure the variable, and verify permissions/persistence before enabling uploads.
5. Confirm upload limits, backup/restore process, and account resource limits.
6. Resolve or explicitly manage the documented High build-tool advisory before declaring complete security approval.
7. After these checks, proceed through repository retrieval, environment configuration, installation/build, and a separately confirmed migration and startup.

The owner created the cPanel Node app entry, database, and database user. No source files, production secrets, migrations, or application start have been applied. The approved `STORAGE_ROOT` code change is limited to the production repository; it has not been pushed to GitHub.

## Reference documentation

- [Nest Nepal Node.js hosting](https://nestnepal.com/nodejs-hosting-in-nepal/) — public plan features; no account-specific Node version guarantee.
- [cPanel: Deploy a Website with Node.js](https://docs.cpanel.net/cpanel/meridian/websites/deploy-a-website-with-nodejs/) — newer Websites hub deployment flow and provider-enabled Node version selection.
- [cPanel: Manage a Node.js App](https://docs.cpanel.net/cpanel/meridian/websites/manage-a-nodejs-app/) — app environment, process, logs, version and optional database management.
- [cPanel: How to install a Node.js application](https://docs.cpanel.net/knowledge-base/web-services/how-to-install-a-node.js-application/) — legacy Passenger setup; enabled packages depend on provider/server OS.
- [Node.js release schedule](https://nodejs.org/en/about/previous-releases) — Node 24/22 support status.
- [Prisma 7 MySQL connector](https://www.prisma.io/docs/orm/v7/core-concepts/supported-databases/mysql) and [Prisma system requirements](https://www.prisma.io/docs/orm/reference/system-requirements) — database and runtime compatibility references.
