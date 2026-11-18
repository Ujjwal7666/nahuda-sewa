# Persistent media and upload storage

## Current implementation

`STORAGE_ROOT` is an optional absolute filesystem path. When configured, the app stores:

- Public CMS image files in `<STORAGE_ROOT>/uploads/`.
- Private donation receipt files in `<STORAGE_ROOT>/receipts/`.

If `STORAGE_ROOT` is unset, the app keeps the previous locations under `<application-root>/storage/`. The app validates a configured path as absolute. Existing function-level directory overrides remain available for isolated tests.

The production cPanel account home path reported by the owner is `/home1/nahudase`; the app root is `/home1/nahudase/nahuda-sewa-app`. The proposed external storage root is `/home1/nahudase/nahuda-sewa-storage`, outside both `public_html` and the Git checkout. Verify this path is accepted and writable in the account before configuring it. No cPanel directory has been created yet.

## URLs and privacy

- Public images retain their existing `/media/<UUID>.png` URLs. Express looks up each media key in the database and serves only referenced files from the uploads directory. Raw storage is not mounted as a static directory.
- Donation receipts remain in a separate directory and are returned only by authenticated Admin routes. Never point the receipts directory at `public_html`, expose it with `express.static`, or make it world-readable.
- Changing `STORAGE_ROOT` does not change database media keys or public URLs.

## Create the directories in cPanel

After the app files are installed and before enabling uploads:

1. Create the chosen root outside the application root and `public_html`.
2. Inside it, create `uploads/` and `receipts/`.
3. Ensure the Node application account owns them and can create, read, replace, and remove files.
4. Start with `0750` for `uploads/` and `0700` for `receipts/`, if supported by cPanel. Do not use `0777`; follow the provider's ACL/permission requirements if they differ.
5. Set the cPanel app environment variable `STORAGE_ROOT` to the absolute path of the parent directory only (not the `uploads` or `receipts` child). For the proposed account path, the value would be `/home1/nahudase/nahuda-sewa-storage`.
6. Apply the environment change using cPanel's supported restart/redeploy action only after the app package is present and configured. Verify the app logs and a later approved test upload.

Do not set `STORAGE_ROOT` to a relative path. Do not create these directories inside the repository and then set the root to the app path if the goal is separation from replaceable code.

## Accepted media and processing

- Source upload types: PNG, JPEG/JPG, and WebP; file extension, MIME type, and image signature must agree.
- Per-file source limit: 10 MiB. Decoded image limit: 16 megapixels; animated/multipage images are rejected.
- Images are decoded and normalized to PNG, metadata is removed by re-encoding, and random UUID filenames are created exclusively. Normalized output is bounded to 12 MiB.
- Favicon output is limited to 256px; other ordinary CMS images are resized within 2400px. Donation QR and receipt images are not resized to preserve scan/read quality.
- Gallery batch upload allows up to five photos per request. Confirm host/proxy request-size, memory, and timeout limits before enabling batch use.
- Receipts use their own private directory and are visible only to authorized Admin users.

## Persistence and Git updates

Keep the external storage root out of the Git repository. Git updates should replace application files without deleting `/home1/nahudase/nahuda-sewa-storage`. Before the first upload, confirm that cPanel's chosen Git retrieval/redeploy method does not clean files outside the repository and that the app process can write to the external path.

Back up the database and both storage subdirectories together. The database references media keys; restoring only one side can cause missing or orphaned files. Receipt backups contain private donor information and need restricted access and retention. Rehearse restoration into separate database and filesystem paths before relying on a backup.
