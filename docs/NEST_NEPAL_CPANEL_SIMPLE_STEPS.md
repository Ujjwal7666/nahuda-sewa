# Nahuda Sewa: simple cPanel check

## Before you start

This guide is only for checking what your hosting account offers. **Do not create an application or database, save settings, upload files, start an app, change DNS, or deploy anything yet.**

You do not need to tell me any passwords. If you send a screenshot, hide your email, account name, domain if you prefer, and every password or secret value.

## Step 1 — Open cPanel

1. Sign in to your Nest Nepal customer account the way you normally do.
2. Open the hosting service for Nahuda Sewa and choose **Login to cPanel** (the wording may differ).
3. Wait for the cPanel home page.

If you cannot find the cPanel login, stop here and tell me what page you are on. Do not send your login details.

## Step 2 — Find the Node.js tool

1. On the cPanel home page, use the search box near the top.
2. Type `Node`.
3. Look for one of these names:
   - **Setup Node.js App**
   - **Websites** or **Websites & Apps**
   - **Application Manager**
4. Tell me the exact name you see.

If there is more than one, do not choose or create anything yet; tell me the names. If there is no Node.js result, stop and tell me.

## Step 3 — Check whether Node 24 is offered

1. Open the Node.js tool you found.
2. If it shows an existing Nahuda Sewa app, open its details only. Do not press **Restart**, **Redeploy**, **Delete**, or **Save**.
3. Look for a setting or dropdown called **Node.js version** or **Node version**.
4. Tell me which versions are listed, especially whether you can see a version beginning with `24`.

If there is no existing app and you cannot see the version list until you open an **Add/Create Application** form, you may open that form just to look. **Leave every field blank and do not press Create, Save, Add, or Deploy.** If you are unsure whether a button will create something, stop and ask me first.

The application package requires Node 24. If 24 is not listed, tell me the versions you do see. Do not select Node 22 as a substitute.

## Step 4 — Look for startup and environment settings

While still in the Node.js tool, look for these labels. Do not change anything:

- **Startup file**, **Application startup file**, or **Startup command**
- **Environment variables**, **App Env**, or **Environment**
- **Application mode**, **Run mode**, or **Production/Development**

Tell me whether you see them and, if so, what the field labels say. The app's startup file is `src/server.js`; its start command is `npm start`. We are only checking what cPanel allows here.

If you see existing environment values, do not reveal or copy them. Just tell me whether an environment-variable section exists. The hosting tool normally supplies the app's port; do not add a port value yourself.

## Step 5 — Find the domain name (do not change it)

1. Return to the cPanel home page.
2. Search for **Domains** and open the page that lists your domains.
3. Look at the list and tell me which domain you intend to use for Nahuda Sewa.

Do not click **Create**, **Add**, **Redirect**, **Manage**, or change any domain setting. If you do not know which domain to use, say “not sure” and I can help you decide before anything is changed.

## Step 6 — Check which database information is available

We are not creating a database yet.

1. On the cPanel home page, search for **MySQL**.
2. Tell me whether **MySQL Databases** or a database section is available.
3. Look for **phpMyAdmin** only if you already have access to it. If it opens, the database server version may be shown on its first page. You may read the version, but do not select a database or change anything.
4. If you cannot find the version, just say “version not shown.” I will give you a short question to send Nest Nepal support.

Do not send database names, usernames, hostnames, or passwords in a public message. We will obtain and configure those later, privately, after the setup plan is approved.

## Step 7 — Check the file area (do not make folders)

1. Return to cPanel home and search for **File Manager**.
2. Open it and look at the folder list on the left.
3. See whether you can identify **public_html** and your account's home folder (the folder above `public_html`).
4. Tell me whether both are visible. Do not create, move, upload, rename, or delete files.

The application should live outside `public_html`. Its uploaded images currently live in a `storage` folder under the application. We need Nest Nepal to confirm that this folder will remain writable and survive future app updates before we deploy.

## Reply with these answers

Copy this list and fill in what you found. “Not sure” is a perfectly good answer.

```text
1. Node.js tool name I see:
2. Node versions listed (is 24 available?):
3. Startup file/command fields I see:
4. Environment settings section exists? (yes/no; do not include values):
5. Production/Development setting exists? (yes/no):
6. Domain I want to use (or not sure):
7. MySQL section exists? (yes/no):
8. Database server version (or version not shown):
9. File Manager shows public_html and a folder above it? (yes/no/not sure):
```

Please do not include passwords, secret values, database connection strings, or recovery codes in your reply.

## What happens after you reply

I will explain the next step based on what your account actually shows. We will not make hosting changes until you approve them. Before deployment, the hosting plan must support Node 24, the correct startup method, MySQL/Prisma, and storage that persists across updates.

## Project facts for reference

These have been checked in the separate production package:

- Required Node version: `>=24.0.0 <25`
- Startup file: `src/server.js`
- Start command: `npm start`
- Build/preparation commands: `npm ci --include=dev`, then `npm run db:generate`, `npm run db:validate`, and `npm run build`
- Required application settings: `NODE_ENV=production`, hosting-provided `PORT`, `DATABASE_URL`, and `SESSION_SECRET`
- Public site origin: set `PUBLIC_ORIGIN` to the confirmed HTTPS domain before deployment
- Database migration command after a separate approval and backup: `npx prisma migrate deploy`. Do not use `npm run db:migrate` on cPanel; that helper rejects remote database hosts.
- Public CMS uploads and private donation receipts use separate `uploads/` and `receipts/` folders under the optional `STORAGE_ROOT`. If unset, the old app-root `storage/` locations are used.
- No SMTP/email integration is present.

For deeper technical details, see [the full cPanel preparation guide](NEST_NEPAL_CPANEL_SETUP.md), [database deployment guide](DATABASE_DEPLOYMENT.md), and [upload storage guide](UPLOAD_STORAGE.md).
