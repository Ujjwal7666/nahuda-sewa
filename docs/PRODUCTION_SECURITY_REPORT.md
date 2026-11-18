# Production package security report

**Review date:** 2026-11-18 (Asia/Katmandu)  
**Scope:** Current locked dependency set, package contents, source configuration, and current npm advisory data. No host account, production database, live endpoint, or private `.env` was accessed.  
**Package:** `deployment/production/`; no `node_modules`, database dump, or uploaded media is included.

## Executive status

- The historical security note listed six advisory findings (four moderate and two high) across `@prisma/adapter-mariadb`, `mariadb`, `body-parser`, `fast-uri`, `multer`, and `qs`. The earlier note did not preserve advisory IDs, affected version ranges, or per-package severity mapping.
- A fresh online audit of this exact current lockfile reports **zero production dependency advisories** with `npm audit --omit=dev`. The current installed versions of those six historical package names are listed below; npm no longer reports them as vulnerable in this lockfile. This verifies current advisory status, but it does not identify which version change resolved each historical advisory.
- The full audit still reports **3 High package findings** in the development-only Tailwind build chain. They represent the same underlying `picomatch` ReDoS advisory, not three independent runtime vulnerabilities. This remains a **release/build security sign-off blocker** until an upstream fix is verified or the owner explicitly accepts the risk. It does **not** appear in the production-only dependency tree.
- No Critical finding was reported. No application secret, database dump, or private uploaded media was intentionally copied.

## Current advisory findings

| Package | Installed version | Severity | Dependency path | Fixed version | In production runtime? | Blocker / action |
|---|---:|---|---|---|---:|---|
| `picomatch` | 4.0.7 | High | `@tailwindcss/cli@4.3.5` → `@parcel/watcher@2.6.0` → `picomatch@4.0.7` | **None published as of 2026-11-18**; GitHub Advisory Database lists affected versions `<=4.0.7` and “Patched versions: None.” npm suggested `@tailwindcss/cli@4.3.3`, but that suggestion was inconsistent with prior audit results and did not safely establish a clean tree. | No; development/build tool only | **Yes for release/build security sign-off.** No safe compatible fixed release was verified. Recheck upstream and require the full audit to clear, or obtain explicit risk acceptance before promotion. Do not apply an unverified override. Advisory: [GHSA-fc5q-39xc-vjpf](https://github.com/advisories/GHSA-fc5q-39xc-vjpf). |
| `@parcel/watcher` | 2.6.0 | High (affected package record) | `@tailwindcss/cli@4.3.5` → `@parcel/watcher@2.6.0` → vulnerable `picomatch` | None verified independently; same root advisory above. | No; development/build tool only | Same build/release blocker as above; this is not a separate advisory to fix. |
| `@tailwindcss/cli` | 4.3.5 | High (affected package record) | Direct development dependency → `@parcel/watcher@2.6.0` → vulnerable `picomatch` | Audit suggests CLI 4.3.3, but a rollback did not produce a clean/consistent audit; no safe fixed version is established. | No; development/build tool only | Same build/release blocker as above. Keep exact lockfile and do not silently mark this resolved. |

The full audit's current counts are 3 High package records, 0 Critical, 0 Moderate and 0 Low. The production-only audit reports zero findings across 245 production dependency nodes. The `@tailwindcss/cli` version is in `devDependencies`; `npm prune --omit=dev` removes this tool chain from the running deployment after build/client generation, but the chain remains present in the package lock and build process.

### Advisory source review (2026-11-18)

The current GitHub-reviewed advisory record confirms CVE-2026-112366 / GHSA-fc5q-39xc-vjpf is High severity, affects `picomatch` versions through 4.0.7, and has no patched version listed. The described ReDoS is triggered by crafted repeated extglob patterns. The affected package is reachable through development/build tooling only in this lockfile; the production-only audit is clean. This reduces direct exposure in the deployed runtime but does not resolve risk in the build toolchain or justify full security approval. No upgrade or override is made because no fixed version is available to verify. Recheck the advisory and npm audit before any later approved release.

## Historical six findings rechecked

The prior `docs/SECURITY.md` note named six packages and reported four Moderate plus two High findings in aggregate. It did not map severities to packages or include advisory IDs/ranges. The exact current versions and paths are:

| Historical package | Current locked version | Historical severity | Current path / classification | Current npm audit result | Fixed version / disposition |
|---|---:|---|---|---|---|
| `@prisma/adapter-mariadb` | 7.10.1 | Not mapped per package in prior report (aggregate: 4 Moderate, 2 High) | Direct production dependency | Not reported by current full or production-only audit | Historical affected/fixed version not recorded; current version is unflagged by current audit. |
| `mariadb` | 3.5.4 | Not mapped per package in prior report | Transitive production dependency of `@prisma/adapter-mariadb@7.10.1` | Not reported by current full or production-only audit | Historical affected/fixed version not recorded; current version is unflagged by current audit. |
| `body-parser` | 2.4.0 | Not mapped per package in prior report | Transitive production dependency of `express@5.2.1` | Not reported by current full or production-only audit | Historical affected/fixed version not recorded; current version is unflagged by current audit. |
| `fast-uri` | 3.1.9 | Not mapped per package in prior report | Development path: `prisma@7.10.1` → `@prisma/dev` → `@prisma/streams-local` → `ajv@8.20.0` → `fast-uri` | Not reported by current full audit | Historical affected/fixed version not recorded; current version is unflagged by current audit. |
| `multer` | 2.5.0 | Not mapped per package in prior report | Direct production dependency | Not reported by current full or production-only audit | Historical affected/fixed version not recorded; current version is unflagged by current audit. |
| `qs` | 6.17.1 | Not mapped per package in prior report | Transitive production dependency of `express@5.2.1`/`body-parser@2.4.0` | Not reported by current full or production-only audit | Historical affected/fixed version not recorded; current version is unflagged by current audit. |

Because the earlier documentation omitted individual CVE/GHSA identifiers, installed versions at the historical scan, and severity-to-package mapping, this report does not claim a specific historical CVE was patched by a particular version. The verifiable conclusion is limited to current npm audit results for the locked versions.

## Environment and package-content review

- `deployment/production/.env.example` contains placeholders only. A real `.env`, `.env.local`, private keys, credentials, and host configuration were not copied.
- Required secrets are supplied via cPanel's private environment configuration: `DATABASE_URL` and a random `SESSION_SECRET` of at least 32 bytes. One-time `ADMIN_*` values must be cleared after account provisioning.
- No SMTP integration exists; SMTP placeholders from the development example were not copied as app settings.
- `node_modules/`, parent-project Git metadata, local database exports, private backups, and `storage/` contents are excluded from repository content. The production folder has its own independent `.git/` metadata; only empty `.gitkeep` markers preserve the required upload directories.
- The package has a `.gitignore` that excludes secrets, node_modules, logs, test output, and upload/receipt data.
- Dependency review was performed against the exact package lock with npm audit; package installation/build is separately tested in the package.

## Other production security risks

| ID | Severity | Finding | Action / blocker |
|---|---|---|---|
| PKG-SEC-01 | High | The dev-only Tailwind/picomatch chain still has a High advisory. | Release/build security sign-off blocker as above; production-only dependency set is clean. |
| PKG-SEC-02 | High until confirmed | Nest Nepal's exact cPanel plan has not been verified for Node 24.x, Prisma client/adapter compatibility, application port/proxy behavior, disk persistence, request limits, or connection quotas. | Confirm with the assigned account/provider before deployment. Public provider marketing confirms Node.js/Express/cPanel/MySQL offerings but does not guarantee this account's exact Node version/capabilities. |
| PKG-SEC-03 | Medium | One-hop Express proxy trust assumes a specific TLS/proxy topology. | Verify forwarding chain and Secure-cookie behavior in staging; do not increase trust blindly. |
| PKG-SEC-04 | Medium | Contact/receipt retention and production backup retention require owner policy. | Keep storage private, define retention/access controls, and test backup restoration before launch. |
| PKG-SEC-05 | Medium | Application code stores uploaded media under app-root `storage/`; no configurable persistent path exists. | Preserve the directory through deployments; use a provider-approved persistent mapping only after verifying it. |

## Verification commands and results

Run from the production package root:

- `npm audit --json`: 3 High affected-package records, all from the dev-only Tailwind/picomatch chain; no Moderate/Low/Critical findings.
- `npm audit --omit=dev --json`: 0 findings in the production dependency set, independently rechecked from this package directory.
- `npm ls @prisma/adapter-mariadb mariadb body-parser fast-uri multer qs --all`: current versions and paths listed above.
- `npm ci --include=dev`: succeeded from the included lockfile. npm 11 emitted `allow-scripts` warnings for watcher/Prisma lifecycle scripts in this local environment; explicit `npm run db:generate` succeeded afterward.
- `npm run db:generate`: succeeded, generated Prisma Client 7.10.1 in package-local `node_modules`.
- `npm run db:validate`: succeeded; no database connection was attempted.
- `npm test`: 53 passed, 0 failed, 11 database-backed wrappers skipped. The package's MySQL integration runner was not run because no isolated DB URL was configured in this package; no development or production DB was contacted.
- `npm run build`: succeeded with Tailwind CLI 4.3.5; package CSS output is 99,910 bytes.
- `npm prune --omit=dev` and `npm ls --omit=dev --depth=0`: succeeded; production dependency tree contains required runtime packages only. The generated application Prisma client loaded with the existing MariaDB adapter after pruning.
- Independent package check: 246 relative JavaScript imports, 83 EJS includes, and 14 static asset references resolved; all 58 EJS templates compiled. No unresolved paths were reported.
- Runtime: `npm start` from this package started in production mode with a synthetic local URL/secret; `/robots.txt` and `/assets/css/app.css` returned 200. No database query/connection was made. With no database in test mode, `/`, `/ne`, `/about`, `/ne/about/team`, `/news`, `/gallery`, `/contact`, and `/ne/donate` rendered with 200 responses.
- The temporary package `node_modules/` used for install/build/test will be removed before delivery; the deliverable contains only the lockfile and required source/assets.

Do not run `npm audit fix` blindly. Recheck the full and production-only audit when the upstream watcher/picomatch chain changes; update this report only with an audit against the exact new lockfile and completed regression results.
