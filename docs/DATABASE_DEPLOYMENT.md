# Database deployment and content transfer

## Architecture

The application uses Prisma 7 with the MySQL datasource and `@prisma/adapter-mariadb`. Prisma models are in `prisma/schema.prisma`; `prisma.config.ts` supplies `DATABASE_URL`; history is in `prisma/migrations/` with MySQL migration lock. There are no seeders and no sample-content seed command. The application uses relational records with foreign keys, unique constraints, checks, and indexes; inspect the schema and migration SQL before any production change.

The current package contains 14 ordered migrations:

1. `202609300001_phase_2_auth`
2. `202609300002_organization_settings`
3. `202610010001_donation_receipts`
4. `202610010002_phase_4_content`
5. `202610010003_about_improvements`
6. `202610020001_phase_5_media`
7. `202610020002_gallery_improvements`
8. `202610020003_dynamic_services`
9. `202610020004_contact_feedback`
10. `202610270001_committee_branches`
11. `202611020001_activity_detail`
12. `202611020002_programs`
13. `202611040001_program_images_information`
14. `202611170001_life_members`

The schema currently declares its models in `prisma/schema.prisma`. `npm run db:validate` validates schema syntax without connecting to or changing a database. `npm run db:generate` builds the client required at runtime.

## A. Schema preparation

1. Create the intended empty MySQL database and user through cPanel. Record the host, version, charset/collation, database name and granted privileges in the private operations record; do not put credentials in this package.
2. Before any migration against a database with existing data, take a consistent backup and verify that it can be read/restored to an isolated database.
3. Install dependencies from this directory with Node 24.x using `npm ci --include=dev`; then run `npm run db:generate` and `npm run db:validate`.
4. Review each pending migration against the production schema and the current migration table. The app's `scripts/migrate-local.js` and `scripts/check-database.js` intentionally call `requireLocalDatabaseUrl()` and reject remote hosts; never use `npm run db:migrate` for cPanel.
5. When approved, run the production Prisma command from the application root with the intended production `DATABASE_URL` supplied privately:

   ```text
   npx prisma migrate deploy
   ```

   This applies checked-in pending migrations and does not seed content. Do not use `prisma migrate reset`, `prisma db push`, or an automatic destructive synchronization. Do not run this command during package preparation.
6. Inspect `npx prisma migrate status` and the provider database after deployment. Do not connect this package verification to a development or production database.
7. If using separate migration and runtime DB users, provide migration credentials only to the migration process, then restore the least-privilege runtime `DATABASE_URL`. The app currently has only one variable name, `DATABASE_URL`; it does not implement a separate migration URL.

The migration command and privileges must be confirmed against Nest Nepal's installed Prisma/Node environment. No migration was executed while preparing this package.

## B. Transfer of organization content and records

Schema installation is separate from copying organization content. This package contains no database dump and no private message, donation-receipt, account, session, or rate-limit data.

The project has no content export/import command. For a new production site, the safest current process is to create the first Admin and enter owner-approved organization settings, bilingual About/Vision/Mission, team, committee/branches/Life Members, programs, services/categories, published news, gallery, testimonials and donation details through the existing CMS. Upload approved public media through the CMS so `MediaAsset` records, image owners, references and files are created consistently.

If a later owner-approved transfer of existing content is required:

1. Agree in writing on an allowlist of public organization-content tables/records and associated media. Exclude Admin accounts (provision them separately), Admin sessions, rate-limit rows, contact submissions and donation receipts unless a separate approved retention/legal process explicitly requires transfer.
2. Back up the source and target first; rehearse the exact allowlisted export/import on an isolated database with no live personal data.
3. Preserve primary keys or build an explicit source-to-target ID mapping, paired `_en`/`_ne` values, status/order/slug/date fields, foreign-key relations and media owner references. Never import a partial relational subset that leaves broken foreign keys or MediaAsset references.
4. Transfer only approved public media from the matching source records, through a controlled manifest, into `storage/uploads/`. Do not copy `storage/receipts/` as ordinary CMS media.
5. Verify record counts, bilingual field presence, active/published states, indexes/FKs, slugs, image keys and public pages in staging. Keep a rollback backup and record checksums for the approved media set.
6. Import to production only in a separately approved maintenance step. This package-preparation task did not export or import any database content.

Do not use a full development dump as a shortcut: it can carry personal submissions, receipt metadata, development accounts, sessions and test data into production.

## C. Initial administrator provisioning

After schema migration, use the included `scripts/create-admin.js` through `npm run admin:create`. Supply `ADMIN_NAME`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD` privately for that one process. The script hashes the password, clears `ADMIN_PASSWORD` from its process environment before database creation, prints no credential, and uses create-only semantics (no upsert). It requires the runtime `DATABASE_URL` and does not migrate the schema. Remove temporary provisioning values afterward, sign in, and verify password change and logout.

Never seed a default username/password or copy development Admin accounts.

## Backup, export, restore

- Back up MySQL and `storage/uploads/` plus `storage/receipts/` together. The database references media keys, so a database-only restore may produce missing images; media-only restore may produce unreferenced files. Receipts contain private donor information and must have stricter access controls.
- Use the provider's cPanel backup/export tool or an approved MySQL utility with credentials prompted privately (not in shell history). Example full database backup, run only after an approved backup window and with placeholder values replaced:

  ```text
  mysqldump --host=DB_HOST --port=3306 --user=DB_USER --password --single-transaction --default-character-set=utf8mb4 --routines --triggers --events DB_NAME > /restricted/backup/path/nahuda-sewa.sql
  ```

  `--password` with no value prompts interactively; never add the password after that flag. Store encrypted backups outside the web root and outside the app package, with least privilege and owner-defined retention. Do not put dumps in this repository.
- Rehearsal restore into a separately created empty test database (never the live target) can use:

  ```text
  mysql --host=TEST_DB_HOST --port=3306 --user=TEST_DB_USER --password TEST_DB_NAME < /restricted/backup/path/nahuda-sewa.sql
  ```

  Use the provider's supported UI if shell tools are unavailable. Confirm source/target names before running; do not substitute production values during package preparation.
- Before a release migration, record the database backup identifier/time and the media snapshot. Verify nonzero size, successful completion, and a restore rehearsal into a separate database and separate directories.
- For recovery, stop writes or use an approved consistency window, restore the database and paired media snapshot, restore restrictive filesystem permissions, regenerate Prisma only if dependency installation changed, and test page/media/Admin behavior privately before returning service.
- Retain the old compatible application files for code rollback. A code rollback alone cannot undo already-applied schema changes; any schema/data rollback needs a reviewed recovery procedure and a verified backup.

## Verification checklist

- [ ] Database name/host/version/charset recorded; credentials stay private.
- [ ] `npm run db:validate` succeeds; client generated with `npm run db:generate`.
- [ ] Migration history matches the 14 packaged migrations and `migrate status` is clean after approved deployment.
- [ ] Foreign keys and indexes match `prisma/schema.prisma`; migration run produced no unexpected table/record changes.
- [ ] Organization content is owner-approved and all paired English/Nepali fields render in the intended language; untranslated optional values follow existing app fallback behavior.
- [ ] Related rows are intact: branch/member, category/service, parent/images, settings/MediaAsset and receipt relationships.
- [ ] Admin account was provisioned separately; no development credentials/data imported.
- [ ] Database and media backups are paired, access-restricted, and restoration has been rehearsed outside production.
