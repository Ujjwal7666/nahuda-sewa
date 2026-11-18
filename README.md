# Nahuda Sewa

Nahuda Sewa is a bilingual (English/Nepali) organization website with an administrative content management system for public pages, programs, news, gallery media, testimonials, contact submissions, donation information, and organization settings.

## Technology

- Node.js ESM (`>=24.0.0 <25`)
- Express 5 and EJS
- Tailwind CSS and browser JavaScript
- Prisma 7 with `@prisma/adapter-mariadb`
- MySQL

## Prerequisites

Install a supported Node.js 24.x release and npm. A MySQL database is required for normal application operation. The package's `package.json` is authoritative for engine and scripts.

## Install and configure

From this repository root:

```sh
npm ci
npm run db:generate
cp .env.example .env
```

Set the actual required values in `.env` for local use, or configure them in the hosting platform's private environment settings. Never commit `.env` or paste credentials into repository files. See [Production environment](docs/PRODUCTION_ENVIRONMENT.md) for every application variable and [Deployment guide](docs/PRODUCTION_DEPLOYMENT_GUIDE.md) for cPanel configuration.

## Database

Review [Database deployment](docs/DATABASE_DEPLOYMENT.md) and back up the target database before schema changes. Validate the schema before migration:

```sh
npm run db:validate
```

For local loopback-only development, `npm run db:migrate` uses a helper that rejects remote database hosts. For cPanel production migrations, follow the reviewed procedure in `docs/DATABASE_DEPLOYMENT.md`; do not use that local-only helper. Do not run migrations or seeders against a live database without an approved backup and deployment plan. The exact available scripts are listed in `package.json`.

## Build and start

```sh
npm run build
npm start
```

The application starts from `src/server.js`, uses the hosting-assigned `PORT`, and reads its configuration from environment variables. Do not expose `.env` values in logs or support requests.

## Deployment documentation

- [Deployment guide](docs/PRODUCTION_DEPLOYMENT_GUIDE.md)
- [Environment variables](docs/PRODUCTION_ENVIRONMENT.md)
- [Database deployment](docs/DATABASE_DEPLOYMENT.md)
- [Persistent upload storage](docs/UPLOAD_STORAGE.md)
- [Security and dependency report](docs/PRODUCTION_SECURITY_REPORT.md)
- [Included file inventory](docs/PRODUCTION_FILE_INVENTORY.md)
- [Separate production repository Git workflow](docs/GITHUB_WORKFLOW.md)

## Maintenance

Changes for this repository must be made in its own clone and working directory, separate from the original development project. Review `git status` and the full diff before committing. Use a feature branch for planned work; merge or push to `main` only after review and approval. Never commit credentials, runtime uploads, database exports, or private backups. See [GitHub workflow](docs/GITHUB_WORKFLOW.md).

This repository is a production application package. It is not a copy of the development repository and is not a security approval; the outstanding build-tool advisory is documented in the security report.
