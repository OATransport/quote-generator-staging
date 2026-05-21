# Quote Generator Add-on

Production-ready Next.js App Router shell for adding quote generation on top of the existing GoHighLevel lead intake for Organized Auto Transport LLC and Keener Logistics.

The app does not replace the lead form. It imports existing GHL pipeline opportunities, reads mapped contact/opportunity/custom-field data, creates draft quotes, and sends customers a **live quote link** where they can review pricing and accept, decline, or ask questions. **PDFs are optional** supporting documents when generated.

## Customer delivery model

- **Primary:** Public live quote link (`/accept/{token}`) — available as soon as a quote is created or imported. No PDF required.
- **Optional:** PDF copy via **Generate PDF (optional)** — stored locally in dev or in Vercel Blob when configured.
- **GHL sync-back:** Public Acceptance URL is a core synced field. Quote PDF URL is included only when a PDF exists.

## Stack

- Next.js App Router + TypeScript
- Tailwind CSS + shadcn/ui-style components
- Prisma + PostgreSQL
- Zod validation
- Playwright PDF generation (optional)

## Setup

1. Copy environment variables:

```bash
cp .env.example .env
```

2. Set `DATABASE_URL`, `NEXT_PUBLIC_APP_URL`, and GoHighLevel credentials in `.env`.

### GHL credentials

**Production (both accounts):** set the prefixed variables so each quote uses credentials by `ghlLocationId`:

- `OAT_GHL_PRIVATE_INTEGRATION_TOKEN`, `OAT_GHL_LOCATION_ID`, `OAT_GHL_QUOTE_PIPELINE_ID`, `OAT_GHL_DEFAULT_STAGE_ID`
- `KEENER_GHL_PRIVATE_INTEGRATION_TOKEN`, `KEENER_GHL_LOCATION_ID`, `KEENER_GHL_QUOTE_PIPELINE_ID`, `KEENER_GHL_DEFAULT_STAGE_ID`

**Local single-account fallback:** the legacy unprefixed `GHL_*` variables still work when `GHL_LOCATION_ID` matches the account you are testing.

**Import/search account selector:** `/import` and `/dashboard/import-ghl` include a GHL account dropdown (Organized Auto Transport / Keener Logistics). Only the safe account key (`oat` or `keener`) is sent to the server; tokens are resolved server-side from `OAT_GHL_*` or `KEENER_GHL_*`.

Never commit real tokens. Verified backups live in gitignored `.env.oat-verified` and `.env.keener-verified`.

### GHL sync-back safety flags

Real writes to GoHighLevel opportunity custom fields are gated by two env flags (both default to off):

| Flag | Default | Effect |
|------|---------|--------|
| `GHL_SYNC_BACK_ENABLED` | off | Master switch. When not `true`, **all** sync-back attempts log `SKIPPED`. |
| `GHL_AUTO_SYNC_BACK_ENABLED` | off | Automatic trigger switch. When not `true`, automatic triggers never perform real writes even if the master switch is on. |

**Rules:**

- `GHL_SYNC_BACK_ENABLED=false` → every sync-back attempt is `SKIPPED` (manual and automatic).
- `GHL_SYNC_BACK_ENABLED=true` + **Manual Sync to GHL** button (`MANUAL` trigger) → real write allowed.
- `GHL_SYNC_BACK_ENABLED=true` + automatic triggers (`PDF_GENERATED`, `CUSTOMER_ACCEPTED`, `CUSTOMER_DECLINED`, `CUSTOMER_QUESTION`) → real write only if `GHL_AUTO_SYNC_BACK_ENABLED=true`; otherwise `SKIPPED` with *"Automatic real sync is disabled; use manual sync."*

For staging/production rollout, keep `GHL_AUTO_SYNC_BACK_ENABLED=false` until you explicitly want PDF/accept/decline/question events to write back to GHL without using the manual button.

Each `GhlSyncLog` entry records the trigger, whether it was manual or automatic, whether a real write was allowed, and the skip reason when applicable.

### Local GHL account files

- `.env` is the **active** runtime config.
- `.env.oat-verified` stores verified Organized Auto Transport GHL settings (location, pipeline, stage, token).
- `.env.keener-verified` stores verified Keener Logistics GHL settings (location, pipeline, stage, token).

To test one account locally with the legacy fallback, copy the GHL variables from the matching verified file into the unprefixed `GHL_*` keys in `.env` (keep shared values like `DATABASE_URL` and `NEXT_PUBLIC_APP_URL` unchanged).

3. Create the database and run migrations:

```bash
npm run prisma:migrate
```

4. Seed company data and default GHL mapping:

```bash
npm run prisma:seed
```

5. Install Playwright browser binaries if your machine does not already have them:

```bash
npx playwright install chromium
```

6. Start the app:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Workflow

1. Configure `/settings/ghl` with the GHL pipeline and custom-field keys.
2. Use `/import` or `/dashboard/import-ghl` to search/import an existing GHL pipeline lead (choose OAT or Keener account first).
3. Review and price the quote on the edit page.
4. **Send the live quote link** to the customer (primary delivery — no PDF required).
5. Customer accepts, declines, or asks a question on the live quote page.
6. Optionally generate a PDF copy for the customer or records.
7. When approved, sync quote results back to GHL (Public Acceptance URL always; PDF URL only if generated).

## Staging Deployment Notes

**Full private staging package:** see **[STAGING-DEPLOY.md](./STAGING-DEPLOY.md)** (Vercel project setup, env vars, Neon steps, deploy procedure, PASS/FAIL smoke checklist, go/no-go).

Use this checklist before deploying to a private staging environment. **Do not deploy to a public URL without network restriction** — internal routes have no app-level authentication yet.

### Initial sync flags (required)

Keep both flags **false** on first staging deploy:

```bash
GHL_SYNC_BACK_ENABLED=false
GHL_AUTO_SYNC_BACK_ENABLED=false
```

Manual **Sync to GHL** will log `SKIPPED` until you deliberately enable the master flag. Automatic triggers (PDF, accept, decline, question) stay skipped until `GHL_AUTO_SYNC_BACK_ENABLED=true`.

### Staging environment variables

```bash
# Required
DATABASE_URL=
NEXT_PUBLIC_APP_URL=                    # e.g. https://quotes-staging.example.com

# GHL API
GHL_API_BASE_URL=https://services.leadconnectorhq.com
GHL_API_VERSION=2021-07-28

# Organized Auto Transport
OAT_GHL_PRIVATE_INTEGRATION_TOKEN=
OAT_GHL_LOCATION_ID=iisYmOgIc6Ef6uoJ2sVx
OAT_GHL_QUOTE_PIPELINE_ID=WkvcCTqhaUHt0SqKp5gu
OAT_GHL_DEFAULT_STAGE_ID=f1f24ff4-aff1-4c47-a4bf-653b867de803

# Keener Logistics
KEENER_GHL_PRIVATE_INTEGRATION_TOKEN=
KEENER_GHL_LOCATION_ID=secdHfMuJKMfpDpHFMHw
KEENER_GHL_QUOTE_PIPELINE_ID=KmHta53HYQ3U8yLuDN1v
KEENER_GHL_DEFAULT_STAGE_ID=c53a4512-4f37-44e6-88f4-d0296cf115ca

# Safety — keep false until manually approved
GHL_SYNC_BACK_ENABLED=false
GHL_AUTO_SYNC_BACK_ENABLED=false

# Durable PDF storage on Vercel (from Blob store → Read-Write token)
BLOB_READ_WRITE_TOKEN=

# Optional legacy single-account fallback (local dev only)
GHL_PRIVATE_INTEGRATION_TOKEN=
GHL_LOCATION_ID=
GHL_QUOTE_PIPELINE_ID=
GHL_DEFAULT_STAGE_ID=
```

Never commit real tokens. Copy from gitignored `.env.oat-verified` / `.env.keener-verified` as needed.

### PDF generation and storage (optional)

PDF generation is **not required** for staging, customer acceptance, or quote delivery.

- **Primary customer output:** live quote link on `/accept/{token}`.
- PDFs are generated with **Playwright headless Chromium** loading the print preview page (`/quotes/{id}/preview?print=1`).
- **Vercel staging/production:** set `BLOB_READ_WRITE_TOKEN` (from Vercel Blob store → Settings → Tokens). Generated PDFs upload to Blob at `quotes/{quoteNumber}.pdf` and the public Blob URL is saved to `quote.quotePdfUrl`. The token is server-only.
- **Local development:** if `BLOB_READ_WRITE_TOKEN` is unset, PDFs write to **`public/generated/quotes/`** (gitignored, dev-only).
- **Vercel-compatible Chromium rendering is deferred** — Blob storage is ready, but PDF generation may not work on Vercel serverless until a compatible renderer is added. Staging is **not blocked** by PDF; test live links first.

### Staging smoke tests

**Required (must pass before relying on staging):**

- GHL import/search (OAT + Keener)
- Quote edit and pricing save
- Public live quote page loads
- Accept / Decline / Ask Question
- Notifications and Customer Activity
- Manual Sync to GHL logs **SKIPPED** while flags are false
- No real GHL writes

**Optional (known deferred on Vercel):**

- Generate PDF
- Open PDF / Blob URL
- PDF branding verification

### Network restriction (required until auth exists)

Internal routes (`/`, `/quotes`, `/import`, `/dashboard/*`, `/settings/*`) are **not authenticated**. Only `/accept/[token]` is intended for customers.

Until app-level auth is added, staging must be:

- Behind VPN, IP allowlist, or reverse-proxy **basic auth**, or
- On a non-public URL shared only with the team.

Do not expose staging to the open internet.

### Local dev: avoid stale cache 500s

- **Do not run `npm run build` while `npm run dev` is active** — concurrent build/dev can corrupt the `.next` cache and cause random 500s.
- If pages start returning 500 after a build, restart cleanly:

```bash
# stop dev server, then:
rm -rf .next
npm run dev
```

For production/staging, use `npm run build && npm run start` (not dev + build at the same time).

## Quote Modes

- `OAT_DIRECT`
- `KEENER_LOGISTICS`
- `OAT_IF_BROKERED`

## Notes

When `GHL_PRIVATE_INTEGRATION_TOKEN` is empty (and no prefixed tokens), `/import` uses sample opportunities for local testing without touching GHL.

See **Staging Deployment Notes** above for live-link-first delivery, optional PDF storage, sync flags, and network restriction requirements.
