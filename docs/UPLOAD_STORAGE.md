# Persistent media and upload storage

## Actual paths and URL handling

The application resolves directories relative to its installed source, not from environment variables:

- Public CMS image files: `<application-root>/storage/uploads/` (`src/services/organization-settings.js` exports `uploadRoot`).
- Private donor receipt files: `<application-root>/storage/receipts/` (`src/services/donation-receipts.js` exports `receiptRoot`).
- Public image URL: `/media/<UUID>.png`. Express looks up the UUID key in `MediaAsset` and sends only a referenced file from the uploads root. Upload files are not served by `express.static`.
- Receipt URL: authenticated Admin route only; receipt files are outside the public MediaAsset route and must remain private.

There is currently no `UPLOAD_DIR`, `MEDIA_DIR`, or receipt-path environment setting. The package preserves the existing relative layout under `storage/`; no app source or upload behavior was changed.

## Create directories and set access

Create both directories under the stable cPanel application root before the first upload. Make the Node application account the owner. Use restrictive permissions compatible with the cPanel process; a starting point is `0750` for `storage/uploads/` and `0700` for `storage/receipts/`, with files readable/writable by the application owner. Confirm that the process can create, read, replace and remove files. Do not make either folder `public_html`, a symlink into a web-served static directory, or world-writable. Confirm actual behavior under the assigned account; shared-host ACL/umask was not tested.

The app process serves public media through its database-backed handler. Protect receipt files at the OS level as well as through Admin authorization. Verify that backup operators are separately authorized.

## Accepted media and processing

- Source upload types: PNG, JPEG/JPG, and WebP; file extension, MIME and image signature must agree.
- Per-file source limit: 10 MiB. Decoded image limit: 16 megapixels; animated/multipage images are rejected.
- Images are decoded and normalized to PNG, metadata is removed by re-encoding, and random UUID filenames are created exclusively. Normalized output is bounded to 12 MiB.
- Favicon output is limited to 256px; other ordinary CMS images are resized within 2400px. Donation QR and receipt images are not resized to preserve scan/read quality.
- Gallery batch upload allows up to five photos per request, each up to 10 MiB. Check host/proxy body size, memory and timeout limits for the combined request plus fields before enabling batch use.
- Receipts use a separate store and are visible to authorized Admin only. Do not place receipt copies in the uploads folder.

## Persistence across releases

The application currently expects the `storage/` directory under the app root. Therefore:

1. Prefer a stable application root and deploy/update source in place while preserving `storage/`.
2. If releases are replaceable directories, ask the host whether a persistent directory outside the release can be mounted or symlinked to `<application-root>/storage`; verify Node's filesystem access and cPanel security rules first. No path override exists in application configuration.
3. If the host does not support a safe persistent mapping, retain `storage/` during every deployment and explicitly exclude it from clean/replacement steps. A new checkout/package copy must not overwrite it.
4. Before deploying, take a database plus media backup. After deployment, compare media file counts and database references and test one public image and a private receipt access denial as authorized.

The two `.gitkeep` markers in this package preserve empty folders. `.gitignore` excludes content files under both paths. Do not copy local development uploads, receipts, or backups into this package.

## Backup and restoration

Back up `storage/uploads/` with the MySQL `MediaAsset` rows and their owner records. Back up `storage/receipts/` with receipt submission records as private personal data. Use a restricted durable/offsite location outside the app root, encrypt where supported, and apply the owner-approved retention policy. Keep database and file snapshot timestamps/identifiers together.

To restore, stop writes or follow the provider's consistency-safe process, restore the matching database and directory snapshots, set owner and restrictive directory permissions, then verify expected UUID files exist, a representative public `/media/<key>` works, and receipt routes remain authenticated. Do not expose a raw receipt filesystem path or make receipt files static. Rehearse restore in a separate environment before relying on it.
