# Production environment variables

All names below were verified in `src/config/env.js` or `scripts/create-admin.js`. Configure runtime values in the cPanel Node.js application's environment-variable panel. Do not commit a real `.env` file. The `.env.example` in this package uses placeholders only.

## Application configuration

| Name | Purpose | Required? | Safe example / notes |
|---|---|---:|---|
| `NODE_ENV` | Selects production behavior, Secure cookies and one trusted proxy hop. | Yes | `production` |
| `PORT` | Listening port. The code defaults to 3000, but cPanel must supply its assigned port. | Yes on cPanel | `3000` is an example only; replace it with the exact port supplied by the Node.js application manager. |
| `HOST` | Validated by configuration; allowed values are `127.0.0.1`, `localhost`, or `::1`. In production, `src/server.js` omits the host argument to `listen()` so Node binds to its default unspecified interface. | Optional | `127.0.0.1`; do not set it to `0.0.0.0`, which current validation rejects. Normally omit it in cPanel. |
| `PUBLIC_ORIGIN` | Absolute origin used for canonical/hreflang metadata, sitemap and social image URLs. | Optional in code; strongly recommended for production | `https://example.invalid`; origin only, no path, credentials, query or fragment. Use the actual HTTPS domain. |
| `DATABASE_URL` | Prisma/MariaDB adapter connection to MySQL. Required at production startup. | Yes | `mysql://DB_USER:URL_ENCODED_PASSWORD@DB_HOST:3306/DB_NAME`; use the host value supplied by cPanel and URL-encode special characters in credentials. |
| `SESSION_SECRET` | Signs Admin/contact/donation session cookies and derives rate-limit keys. | Yes | Replace the placeholder with at least 32 random bytes. Never reuse the example or commit the real value. |
| `SESSION_LIFETIME_MINUTES` | Admin session lifetime; accepted range 5–1440. | Optional | `480` (default). |
| `LOGIN_WINDOW_MINUTES` | Admin login rate-limit window; accepted range 1–60. | Optional | `15` (default). |
| `LOGIN_IP_MAX` | Maximum login attempts per IP in the window; range 1–100. | Optional | `20` (default). |
| `LOGIN_ACCOUNT_MAX` | Maximum login attempts per account in the window; range 1–100. | Optional | `10` (default). |
| `RECEIPT_WINDOW_MINUTES` | Public donation-receipt rate-limit window; range 1–1440. | Optional | `60` (default). |
| `RECEIPT_IP_MAX` | Receipt attempts per IP; range 1–100. | Optional | `10` (default). |
| `RECEIPT_EMAIL_MAX` | Receipt attempts per normalized email; range 1–100. | Optional | `5` (default). |
| `CONTACT_WINDOW_MINUTES` | Contact/Feedback rate-limit window; range 1–1440. | Optional | `60` (default). |
| `CONTACT_IP_MAX` | Contact attempts per IP; range 1–100. | Optional | `10` (default). |
| `CONTACT_EMAIL_MAX` | Contact attempts per normalized email; range 1–100. | Optional | `5` (default). |

## One-time administrator provisioning variables

These three names are read only by `scripts/create-admin.js`, not by the web server. Set them privately only while creating the first authorized account, run `npm run admin:create`, and remove them from the shell/panel afterward.

| Name | Purpose | Required? | Safe example / notes |
|---|---|---:|---|
| `ADMIN_NAME` | Display name for the new account. | Required for provisioning | A non-secret name placeholder; 1–100 characters. |
| `ADMIN_EMAIL` | Login email for the new account. | Required for provisioning | `admin@example.invalid`; use the owner's real approved address only in private configuration. |
| `ADMIN_PASSWORD` | Password for the new account; hashed before database insert. | Required for provisioning | Leave blank in `.env.example`; enter privately without putting it in shell history, source, or command arguments. |

The provisioning command refuses an existing email instead of overwriting that account. Password policy is enforced by the existing script/service.

## Values that are not application variables

- SMTP variables in the root development `.env.example` are reserved for a future feature. The current application does not send email, so no SMTP values are included here.
- There is no upload-root environment variable. The application uses paths relative to its own source under `storage/uploads/` and `storage/receipts/`.
- There are no separate `DB_HOST`, `DB_USER`, or `DB_PASSWORD` variables; the runtime reads only `DATABASE_URL`.
- `ACTIVITY_MIGRATION_DATABASE_URL`, `COMMITTEE_MIGRATION_DATABASE_URL`, and `AUTH_TEST_DATABASE_URL` are test-only variables. They are not production configuration.

## cPanel setup

Set `NODE_ENV`, assigned `PORT`, `DATABASE_URL`, `SESSION_SECRET`, and `PUBLIC_ORIGIN` in the Node.js application environment. Set optional limits only if the owner has chosen different limits. Never paste credentials into GitHub, deployment docs, application logs, or a publicly served folder. Configure HTTPS and confirm that cPanel's proxy topology matches the application's one-hop trust setting before enabling public traffic.
