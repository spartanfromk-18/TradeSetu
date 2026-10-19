# TradeSetu Release Runbook

These steps use placeholders for project names and never require secrets to be committed. Run them from the repository root with Node.js 20+.

## Create a release candidate tag

1. Confirm the intended commit is on the release branch and the working tree is clean.
2. Run the required checks:

   ```bash
   npm run typecheck
   npm test
   npm run build:vercel
   npm run build
   git diff --check
   ```

3. Create and push the proposed annotated release-candidate tag only after the intended commit is
   ready:

   ```bash
   git tag -a v2026.10.19-rc1 -m "TradeSetu v2026.10.19-rc1"
   git push origin v2026.10.19-rc1
   ```

## Deploy a Vercel preview

Authenticate, then deploy without the production flag:

```bash
npx vercel login
npx vercel
```

This creates a Vercel preview deployment. Do not use `--prod` for this release gate. Confirm the
build command is `npm run build:vercel`, output directory is `dist`, and record the URL in
[preview-urls.md](./preview-urls.md). Check deployment logs and errors in the Vercel dashboard or
with the deployment details shown by the CLI before running the smoke tests.

## Deploy a Cloudflare Pages preview

Authenticate, build `dist/`, and deploy to a preview branch:

```bash
npx wrangler login
npm run build
npx wrangler pages deploy dist --project-name=<PROJECT_NAME> --branch=<PREVIEW_BRANCH>
```

Use a non-production branch or preview deployment; do not promote it to production as part of this
gate. Record the URL in [preview-urls.md](./preview-urls.md). Check the Pages deployment logs and
build errors in the Cloudflare dashboard before running the smoke tests.

## Roll back

- **Vercel:** In the project deployment history, select the last known-good deployment and use **Promote to Production**. Verify the promoted URL and then repeat the smoke tests.
- **Cloudflare Pages:** In the Pages deployment history, select the last known-good deployment and use the dashboard's rollback/redeploy action. Verify the production URL and then repeat the smoke tests.
- **Optional edge worker:** Do not roll back the frontend and worker independently without checking compatibility. If the worker is involved, deploy the last known-good worker revision with the repository's configured Wrangler command and verify local-only calculation still works when the worker is unavailable.

## Troubleshooting

### Calculator fails

- Check the browser console for normalization or Web Worker errors.
- Confirm the deployed asset URLs return 200 and that the worker module is not blocked by a MIME, CSP, or caching error.
- Reproduce with valid default values, then inspect the failed input and the deployed registry version.
- Verify the preview was built with Node.js 20+ and the correct build command.

### IndexedDB is unavailable

- Check private/browsing mode, browser storage permissions, quota, and storage-blocking extensions.
- Confirm the calculation and display still work without persistence; the cache is optional.
- Check for `tradesetu` open/transaction errors and verify no data is sent to a backend as a workaround.

### Assets fail to load

- Check the browser network panel for incorrect paths, 404s, MIME types, and stale immutable asset references.
- Confirm `dist/` was the deployed output and that the SPA rewrite does not rewrite `/assets/` requests.
- Purge or wait for stale deployment caches only through the hosting provider's documented controls; do not change hashed asset names manually.
