# Production deployment guide

## Package overview

This package is a separate copy of the current Nahuda Sewa application. Stack: Node.js ESM, Express 5, EJS, Tailwind CSS, vanilla browser JavaScript, Prisma 7 with `@prisma/adapter-mariadb`, MySQL, and filesystem media storage. No alternative framework, database, or mail system is added.

The server entry is `src/server.js`; it creates the Express app in `src/app.js`. The application root is the directory containing `package.json`, `prisma.config.ts`, `src/`, `public/`, and `prisma/`. The package requires Node `>=24.0.0 <25` as declared by its actual `package.json`; local verification used Node 24.19.0 and npm 11.17.0.

Nest Nepal publicly advertises Node.js/Express hosting, cPanel and MySQL for its Node hosting plans ([Nest Nepal Node.js hosting](https://nestnepal.com/nodejs-hosting-in-nepal/)). The owner has confirmed Node 24.22.3 and MariaDB 10.11.20 in the account and created the empty production database and user. Prisma/native `sharp` compatibility, process/memory limits, and persistent-storage behavior still need verification. This guide was not based on direct account access by the reviewer.

## Installation and local package commands

Run commands from the package root:

```text
npm ci --include=dev
npm run db:generate
npm run db:validate
npm test
npm run build
```

`npm ci` uses the included lockfile. `--include=dev` is required for Prisma CLI, Tailwind CLI, build and tests. The checked-in compiled stylesheet is also included at `public/assets/css/app.css`. The current `npm run db:migrate` script calls a helper that deliberately permits loopback MySQL only; **do not use it for the remote cPanel database**.

## cPanel application setup

1. Confirm that the selected Nest Nepal plan's cPanel has “Setup Node.js App” or its equivalent and supports Node 24.x. The provider's public marketing information is not a per-account version guarantee.
2. Create the application with the root pointed at this package directory, the actual domain/subdomain, Node 24.x, and production mode. Use startup file `src/server.js`; the npm start command is `npm start` (`node src/server.js`). Do not run `src/app.js` directly.
   Do not expose the entire application root through `public_html`; cPanel should route the application URL to the Node process. The app itself serves only its registered assets and media routes.
3. Use the port assigned by the cPanel application manager as `PORT`. The server listens on `config.port`. In production it does not bind to `HOST`; the value is still validated by `readConfig` if set, and only loopback values are accepted. Leave `HOST` unset unless cPanel explicitly requires a valid accepted value.
4. Set the variables listed in [PRODUCTION_ENVIRONMENT.md](PRODUCTION_ENVIRONMENT.md) through cPanel's private environment configuration. Required runtime values are `NODE_ENV=production`, `PORT`, `DATABASE_URL`, and `SESSION_SECRET`; set the real HTTPS `PUBLIC_ORIGIN` for canonical URLs and sitemap output.
5. Create an empty MySQL database and a least-privilege user in cPanel. Use the actual database host cPanel supplies; the running app's `DATABASE_URL` parser permits remote hosts. The local-only helper scripts intentionally reject remote hosts.
6. Install/build/generate Prisma as described below, apply reviewed migrations only after a recoverable database backup, provision the first administrator, then start/restart the application.
7. Verify cPanel reports the process as running and check the application logs for startup/configuration errors. The app writes short startup and generic error messages to stdout/stderr; it does not log raw request bodies or database error messages.

The exact Passenger/process-manager behavior, Node 24 availability, port injection, HTTPS proxy hop count, request-size limit, MySQL version, account connection limits, filesystem persistence, and restart semantics remain unverified with the provider. Confirm these before production use. In particular, the gallery batch accepts up to five source images of up to 10 MiB each plus fields; check the host's request-body limit against that maximum.

## Prisma client and build sequence

The package includes the Prisma schema and migration history. The generated Prisma client is build/install output under `node_modules`; it is not included in this package. With the private production database settings available to the cPanel shell:

```text
npm ci --include=dev
npm run db:generate
npm run db:validate
npm run build
```

Use the migration instructions in [DATABASE_DEPLOYMENT.md](DATABASE_DEPLOYMENT.md). Do not run `npm run db:migrate` remotely; it enforces local-only MySQL. If the host requires production-only dependencies for the running process, generate Prisma and build first, then use `npm prune --omit=dev` and verify startup. Do not rely on cPanel's automatic install mode until its treatment of dev dependencies and Prisma postinstall scripts is confirmed.

After a successful release installation, `npm start` is the production start command. The server handles `SIGINT` and `SIGTERM` by stopping the listener and disconnecting Prisma. Do not run multiple app processes against shared media or rate/session data unless the hosting process model has been confirmed.

## First administrator

After migrations succeed, privately provide `ADMIN_NAME`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD` to the `npm run admin:create` process, then remove those temporary values. Never put the password in a command argument, ticket, GitHub file, or deployment log. The command hashes the password, does not print it, and will not overwrite an existing email. Change the password after the first sign-in if the owner requires that policy.

## HTTPS, proxy and cookies

Production config sets Express `trust proxy` to one hop. Admin, contact, and donation cookies are Secure in production, HttpOnly, and SameSite Lax. This assumes one trusted reverse proxy forwards protocol/client metadata. Verify the actual cPanel/Nest topology; do not increase proxy trust blindly. Enable SSL for the mapped domain through the provider's supported process and verify HTTPS before accepting credentials or forms.

## SMTP and email

No SMTP integration exists in the current application. Contact messages and donation receipts are persisted for Admin review; do not configure SMTP variables or advertise email notifications as an existing feature.

## Production verification checklist

- Confirm `NODE_ENV=production`, cPanel-assigned port, HTTPS `PUBLIC_ORIGIN`, valid database connection settings, and a private 32-byte-or-longer session secret.
- Confirm Node 24.x is available, `npm ci` succeeds from the included lockfile, Prisma client generation works, CSS build works, and the production-only dependency set installs.
- Confirm all migrations are applied to the intended database only after backup; verify migration status without using a reset or schema push.
- Confirm first Admin provisioning, login, logout, password change, authenticated Admin route protection, and session persistence.
- Check `/`, `/ne`, public modules, localized switching, `/robots.txt`, `/sitemap.xml`, static CSS/JS/fonts/logo, `/media/<key>`, Contact and Donate behavior.
- Verify media storage writes persist through app restart and release update; verify receipt files remain private and Admin-protected.
- Verify HTTPS cookies, proxy/client IP behavior, 404/500 responses, logs, file upload limits, database connection limits, and backup/restore procedure.
- Verify the approved English/Nepali content, organization profile/social links, donation details and admin contact workflow with the owner.

Tests executed on the isolated local package and exact boundaries are recorded in [PRODUCTION_SECURITY_REPORT.md](PRODUCTION_SECURITY_REPORT.md) and the closing QA notes in this folder. No live deployment, production database migration, DNS, or SSL action was performed.

## Backup and rollback

Before every schema or content deployment, back up MySQL and both `STORAGE_ROOT/uploads/` and `STORAGE_ROOT/receipts/` directories (or the default app-root `storage/` when unset) to a restricted, durable location. Verify the backup exists and that a restoration rehearsal works in a separate database/directory. Keep the prior application version available. A code rollback does not reverse a migration; restore a database only under an approved recovery plan after assessing writes since the backup. Preserve the configured external storage root across code replacements. Details: [DATABASE_DEPLOYMENT.md](DATABASE_DEPLOYMENT.md) and [UPLOAD_STORAGE.md](UPLOAD_STORAGE.md).

## Common failures

| Symptom | Likely check |
|---|---|
| Startup exits with configuration error | Confirm `NODE_ENV`, `PORT`, `DATABASE_URL`, and `SESSION_SECRET`; ensure any configured `HOST` is loopback-only. |
| cPanel shows no listener / proxy error | Confirm its assigned `PORT`, startup file `src/server.js`, application root, and restart action. |
| Prisma client initialization error | Run `npm ci --include=dev` and `npm run db:generate` using Node 24.x before pruning dev dependencies. |
| MySQL access denied / timeout | Verify cPanel database host, database/user naming, grants, URL-encoded credentials, and connection restrictions. Do not use the loopback-only local migration helper. |
| Upload fails or disappears | Verify `STORAGE_ROOT`, its `uploads/` and `receipts/` children, directory ownership/permissions, quota, request size limit, and backup/restore alignment. |
| Secure cookie missing | Access via HTTPS and confirm the documented one-hop proxy behavior. |
| CSS missing after checkout | Confirm `public/assets/css/app.css` is present; it is generated and included in this package. |
