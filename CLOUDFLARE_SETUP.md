# Karamel Calculator — Cloudflare Workers

Karamel Studio reads and updates the existing Notion databases for Karamel. It does not create copies of ingredient and recipe data.

## Deploy on your existing Cloudflare account

1. Open **Cloudflare Dashboard → Workers & Pages → Create → Import a repository** (Workers).
2. Connect the GitHub repository **Nabih21/Karamel-calculator** and choose the **main** branch.
3. Use the Worker configuration in `wrangler.jsonc` (or specify `npx wrangler deploy` as the deploy command if the setup screen requests one).
4. In the Worker **Settings → Variables and Secrets**, add two encrypted **secrets**:
   - `NOTION_TOKEN` — a Notion internal integration token with read/update/insert content permissions, granted access to the existing **Bases techniques** data sources.
   - `APP_PASSWORD` — a unique non-empty password (a long password is strongly recommended), separate from your Notion password. Users enter this into the Karamel login prompt.
5. Redeploy the Worker and open its `*.workers.dev` address. Visit `/health` and confirm `configured: true` without exposing your token.
6. In the Notion page **04 · Interface web Karamel**, type `/embed` and paste the HTTPS Worker URL. If an embedded login does not work on iPad, use the same URL directly in Safari.

**Important:** The GitHub repository is currently public. Do not put tokens or passwords into GitHub or a `.env` file. If the site is for invited coworkers only, add proper user accounts or Cloudflare Access before real business use; the included shared password is an initial simple access gate, not individual user authorization.

## Local development

```bash
npm install
npx wrangler dev
```

Add the two secrets to a local `.dev.vars` file (gitignored) only for local testing.

## Files

- `src/worker.mjs`: Worker API and Notion data operations
- `public/index.html`: responsive app UI
- `wrangler.jsonc`: Workers build and static assets configuration
- `server.mjs`: older Node.js option (not used on Cloudflare)

## Reliability and validation

- Running **Deploy Karamel to Cloudflare Workers** executes `npm test` first. If a test fails, deployment stops.
- The app reloads all six Notion collections after a successful edit; this may take a few seconds.
- Recipes with incomplete purchase prices or quantities are marked for review, and incomplete overall batch costs are not shown as zero.
- The current app has one shared password, no per-person access permissions, and no login throttling. For stronger security, use Cloudflare Access and a strong password.
- **Not yet independently reconciled:** final prices should be cross-checked against the original Excel workbook or the corresponding Notion formulas before commercial use.
- Deployment is manual via GitHub Actions; commits do not immediately change the live Worker.
