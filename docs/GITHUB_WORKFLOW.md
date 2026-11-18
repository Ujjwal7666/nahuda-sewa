# GitHub workflow for the production repository

This repository tracks only the approved production package. Clone it into its own working directory, separate from `D:/office/nahuda_sewa` and every clone of the development repository. Do not nest it inside or use it as a replacement for the development checkout.

## Initial clone

After the first approved push has populated the existing private GitHub repository:

```sh
git clone https://github.com/Ujjwal7666/nahuda-sewa.git nahuda-sewa-production
cd nahuda-sewa-production
git switch main
```

If the repository is still empty, the authorized maintainer should first review and approve the initial commit and push from the prepared production folder. Do not force-push or replace pre-existing remote history.

## Routine change

1. Work in the separate production clone and check `git status --short --branch`.
2. Create a focused feature branch when the change is planned:

   ```sh
   git switch -c feature/short-description
   ```

3. Make and verify the change using the commands appropriate to the change (for example `npm ci`, `npm run db:generate`, `npm run build`, and `npm test`). Do not connect tests to production data.
4. Review both staged and unstaged changes:

   ```sh
   git status --short
   git diff
   git diff --cached
   git diff --check
   ```

5. Stage only reviewed files, inspect the staged diff again, then commit:

   ```sh
   git add path/to/reviewed-file
   git diff --cached
   git commit -m "Describe the change"
   ```

6. Push a feature branch for review, or push `main` only when the change has been approved:

   ```sh
   git push -u origin feature/short-description
   ```

   ```sh
   git push origin main
   ```

Never use force-push to resolve divergence. Fetch and review remote changes, then reconcile them with a normal merge or rebase according to the maintainer's policy.

## Urgent fixes

For a verified urgent production fix, create a clearly named branch from the approved current `main`, make the smallest necessary change, run applicable checks, review the diff, and obtain review before merging or pushing. Record the deployed commit and follow the deployment guide's backup and rollback procedure.

## Reverting a problematic change

Prefer a new reviewed revert commit so history remains intact:

```sh
git revert <commit-id>
git push origin main
```

Follow the deployment rollback procedure as well if the change has already been deployed. Do not reset shared history or force-push.

## Prevent sensitive files from entering Git

The repository `.gitignore` excludes real environment files, dependencies, logs, test output, local database files/dumps/backups, editor/OS artifacts, and runtime upload/receipt contents. Before staging, inspect `git status --short --ignored` and review each candidate. Ignore rules do not protect files that were already tracked; never add secrets or private records. Keep only `.env.example` and empty storage `.gitkeep` markers under version control. Do not commit production uploads, donor receipts, database exports, or private backups.

If a secret is accidentally committed, treat it as exposed: revoke/rotate it immediately and notify the repository owner. Removing it in a later commit does not remove it from history.
