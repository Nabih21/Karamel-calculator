# Database architecture and D1 migration

The HTTP entry point (`src/worker.mjs`) delegates to the application service
(`src/services/recipes.mjs`). Domain validation (`src/domain/recipes.mjs`) and
pure pricing (`public/pricing.mjs`, shared with Node tests) contain no database
calls. Composition (`src/composition.mjs`) chooses a repository. Each repository
implements `list(entity)`, `create(entity, data)`, and `update(entity, data)` using
the same plain records. SQL and Notion properties stay inside their adapters.
The Node entry point also uses the shared Worker handler. D1 development uses
Wrangler because the Node entry point cannot supply a D1 binding.

Notion remains the default. Setting DATA_BACKEND=d1 requires a DB binding;
there is no automatic fallback or dual write. Missing bindings fail closed.
Pricing behavior is preserved in this first migration stage; the previously
identified missing-value display issues still need a separate fix. New writes
reject target cost ratios above 1.

## Local workflow (Node 22.13+)

Use Wrangler 4 (the onboarding installation is at
/workspace/karamel-tools/node_modules/.bin/wrangler).

```
wrangler d1 migrations apply karamel-local --local --config wrangler.local.json
wrangler dev --local --config wrangler.local.json
npm test
npm run check
```

Provide APP_PASSWORD through an ignored `.dev.vars` for authenticated local
requests. Do not commit it. Local config uses a deliberately local-only database
identifier and must not be deployed. Production wrangler.jsonc is unchanged.

## Migration procedure

1. Pause edits in the old app before the final export. Keep Notion as a backup.
2. Supply NOTION_TOKEN securely in the shell environment, then run:
   `node scripts/export-notion.mjs /secure/path/notion-export.json`.
   This reads all pages in all six collections without a row cap. Output uses
   exclusive creation and restrictive permissions; it contains business data.
3. Review source schemas first: the adapter supports number/numeric formula
   fields and single relations. Rollups and multiple relations require explicit
   mapping before migration. Export is the application's normalized view, not a
   full archival backup of Notion; preserve a separate full Notion export.
4. Run `node scripts/import-sql.mjs /secure/path/notion-export.json /secure/path/import.sql`.
   It validates against the SQLite schema and foreign keys before generating SQL.
   Null/incomplete fields remain null. Invalid values (including ratio >1) or
   dangling references stop generation; correct the source rather than silently
   dropping records. Never commit exports or generated SQL.
5. Rehearse import into an empty local database using
   `wrangler d1 execute karamel-local --local --config wrangler.local.json --file /secure/path/import.sql`.
   Inserts preserve IDs and reject duplicates; this is deliberately not an upsert.
6. Create the production database with `wrangler d1 create karamel`, then add its
   returned ID and `binding: "DB"`, `database_name: "karamel"`, and
   `migrations_dir: "migrations"` to wrangler.jsonc's d1_databases array.
7. Apply schema with `wrangler d1 migrations apply karamel --remote`, then import
   into the empty database with `wrangler d1 execute karamel --remote --file /secure/path/import.sql`.
   Keep traffic on Notion. If import fails partway, inspect the target; do not
   blindly rerun or delete data. Rehearse again in a fresh database.
8. Compare all IDs, counts, values, relationships, and recipe calculations with
   the frozen export; test authenticated read/create/update on a staging Worker.
9. Set production vars.DATA_BACKEND to d1 and deploy only after reconciliation.
   Keep APP_PASSWORD. The existing deployment workflow still requires/publishes
   NOTION_TOKEN during this transition; remove those steps after cutover is verified.
10. Verify production reads, edits, and backup/export procedures before reopening
    editing. Switching back to Notion is safe only before new D1 writes; otherwise
    reconcile those writes first. There is no reverse sync.

Live export, remote database creation, reconciliation, and cutover have not been
performed. They require authorized access to the real data and Cloudflare account.

## GitHub Actions (existing repository secrets)

Run **Validate and import Notion into D1** in Actions. Start with `validate`;
it exports and checks data without creating a database. For `import`, pause all
recipe edits and check `edits_paused`. The workflow creates a fresh database,
imports, compares every field of all six collections, and records the ID in the
run summary. Source data is not uploaded as an artifact; temporary export files
are deleted. Keep a separate Notion backup. A failed import can leave a new,
partially populated database; it never overwrites a previous database. Reruns
with the same run ID may conflict on database name; start a new run after diagnosis.

Download the non-secret `d1-deployment-config` artifact after successful import.
For cutover, review and replace wrangler.jsonc with this configuration in a new
commit, then run the existing deployment workflow. Persisting the binding and
DATA_BACKEND in Git prevents subsequent deployments from reverting to Notion.
Do not cut over from an old snapshot if edits resumed after export: perform a
fresh final import first. Existing deployment continues requiring NOTION_TOKEN
until the transition is complete. APP_PASSWORD remains the existing Worker secret.

## Production status

D1 import run 43743855274 reconciled all six collections. Cutover run
43743943634 deployed the committed D1 binding and passed live health, UI,
and authenticated data-read checks. Notion is retained as a historical source;
new app writes target D1 and are not synchronized back. Production deployment
no longer requires a Notion token. The migration workflow still uses the token
for explicitly requested future source exports.

Backups: retain the Notion source and use Cloudflare D1 Time Travel for recovery
within the account plan's retention window. For an independent export, run
`wrangler d1 export <database_name from wrangler.jsonc> --remote --output /secure/path/karamel.sql`.
Keep exports outside Git. Restore procedures and live write smoke tests have not
yet been independently exercised.

## Standard overhead

Production overhead is now a shared per-batch list in standardOverhead, exposed
as overhead in the repository contract. Migration 0002 consolidates identical
named historical amounts and fails on conflicting amounts. The old overhead
table is retained as historical data, not used for current pricing. Deployment
runs this idempotent migration before serving the updated application. Changes
on the Standard overhead page immediately apply to all recipes. Live diagnostics
read the new table. The original Notion adapter and initial import scripts are
legacy source-migration tools, not a standard-overhead synchronization mechanism.
