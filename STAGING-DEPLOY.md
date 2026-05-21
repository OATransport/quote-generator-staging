# Private Vercel Staging Deployment Package

**Quote Generator** — live-link-first staging on Vercel with Neon PostgreSQL.

> **Do not deploy automatically from this document.** Follow each section manually. Keep `GHL_SYNC_BACK_ENABLED=false` and `GHL_AUTO_SYNC_BACK_ENABLED=false` until the controlled manual sync section (after smoke tests pass).

---

## Standing safety rules (first deploy)

| Rule | Value |
|------|-------|
| Real GHL writes | **Off** |
| `GHL_SYNC_BACK_ENABLED` | `false` |
| `GHL_AUTO_SYNC_BACK_ENABLED` | `false` |
| Create GHL custom fields | **No** |
| PDF generation on Vercel | **Deferred** (optional smoke test only) |
| Customer delivery | **Live quote links** (`/accept/{token}`) |

---

## 1. Exact Vercel project setup

### Project name (recommendation)

```
quote-generator-staging
```

Alternative: `oat-keener-quote-staging` if you prefer account names in the Vercel dashboard.

### Framework / build settings

Vercel auto-detects Next.js. Confirm these in **Project → Settings → General**:

| Setting | Value |
|---------|-------|
| **Framework Preset** | Next.js |
| **Root Directory** | `.` (repo root) |
| **Build Command** | `npm run build` (default) |
| **Install Command** | `npm install` (default) |
| **Output Directory** | *(leave default — Next.js App Router)* |
| **Development Command** | `npm run dev` |

The build script runs `prisma generate && next build`. Prisma Client is generated on every build.

### Node.js version

Recommend **Node.js 20.x** (Active LTS).

In Vercel: **Project → Settings → General → Node.js Version** → `20.x`

Optional: add to `package.json` later:

```json
"engines": { "node": ">=20" }
```

### Region (recommendation)

**Washington, D.C., USA (`iad1`)**

Rationale: GHL API and typical Neon US regions align well with `iad1`. If your Neon database is in `aws-us-east-1`, co-locating the Vercel region reduces latency.

### Domain (recommendation)

```
staging-app.shipwithoat.com
```

**DNS (at your DNS provider):**

| Type | Name | Value |
|------|------|-------|
| CNAME | `staging-app` | `cname.vercel-dns.com` |

Then in Vercel: **Project → Settings → Domains** → Add `staging-app.shipwithoat.com`.

Set `NEXT_PUBLIC_APP_URL` to `https://staging-app.shipwithoat.com` **before** the first production deploy (or redeploy after adding the domain).

### Deployment protection (required)

Internal routes (`/`, `/quotes`, `/import`, `/dashboard/*`, `/settings/*`) have **no app-level authentication**. Staging **must** be restricted.

**Recommended (Vercel Pro or higher):**

1. **Project → Settings → Deployment Protection**
2. Enable **Vercel Authentication** (team members only) **or** **Password Protection** for Preview + Production
3. Optionally enable **Trusted IPs** if your team uses a fixed VPN egress

**Minimum acceptable:** Password protection on all deployments until app-level auth exists.

**Do not** expose staging on a public URL without protection.

---

## 2. Exact Vercel environment variables

Add in **Project → Settings → Environment Variables**. Apply to **Production** (and Preview if you use preview URLs).

### Required — core

```bash
DATABASE_URL=postgresql://USER:PASSWORD@HOST/quote_generator_staging?sslmode=require

NEXT_PUBLIC_APP_URL=https://staging-app.shipwithoat.com

GHL_API_BASE_URL=https://services.leadconnectorhq.com
GHL_API_VERSION=2021-07-28
```

### Required — Organized Auto Transport (OAT)

```bash
OAT_GHL_PRIVATE_INTEGRATION_TOKEN=<from .env.oat-verified — never commit>
OAT_GHL_LOCATION_ID=iisYmOgIc6Ef6uoJ2sVx
OAT_GHL_QUOTE_PIPELINE_ID=WkvcCTqhaUHt0SqKp5gu
OAT_GHL_DEFAULT_STAGE_ID=f1f24ff4-aff1-4c47-a4bf-653b867de803
```

### Required — Keener Logistics

```bash
KEENER_GHL_PRIVATE_INTEGRATION_TOKEN=<from .env.keener-verified — never commit>
KEENER_GHL_LOCATION_ID=secdHfMuJKMfpDpHFMHw
KEENER_GHL_QUOTE_PIPELINE_ID=KmHta53HYQ3U8yLuDN1v
KEENER_GHL_DEFAULT_STAGE_ID=c53a4512-4f37-44e6-88f4-d0296cf115ca
```

### Required — PDF Blob storage (storage ready; rendering deferred)

```bash
BLOB_READ_WRITE_TOKEN=<from Vercel Blob store → Settings → Tokens>
```

Create the Blob store in the same Vercel project: **Storage → Create Database → Blob**.

### Required — sync safety (first deploy)

```bash
GHL_SYNC_BACK_ENABLED=false
GHL_AUTO_SYNC_BACK_ENABLED=false
```

Use literal string `false` (not empty).

### Optional — legacy single-account fallback

Only needed for local dev or if you intentionally run one account via unprefixed keys. **Not required for staging** when both `OAT_GHL_*` and `KEENER_GHL_*` are set.

```bash
GHL_PRIVATE_INTEGRATION_TOKEN=
GHL_LOCATION_ID=
GHL_QUOTE_PIPELINE_ID=
GHL_DEFAULT_STAGE_ID=
```

### Variables that must NOT be set on Vercel

- Do not upload `.env`, `.env.oat-verified`, or `.env.keener-verified` files
- Do not expose tokens in `NEXT_PUBLIC_*` variables

---

## 3. Neon staging database steps

### Separate project vs branch

| Approach | When to use |
|----------|-------------|
| **Separate Neon project** (recommended) | First staging deploy; clean isolation from any future production DB |
| **Neon branch** | You already have a Neon production project and want a copy/branch for staging |

For this deploy, use a **dedicated Neon project** named e.g. `quote-generator-staging`.

### Steps

1. Create Neon project `quote-generator-staging` (region: **AWS US East 1** to match Vercel `iad1`).
2. Copy the **pooled** connection string (`?sslmode=require`).
3. Paste into Vercel as `DATABASE_URL` (Production environment).
4. **Run migrations from your local machine** (not during Vercel build — see section 5):

```bash
DATABASE_URL="postgresql://..." npx prisma migrate deploy
```

5. **Seed staging data** (companies, field mappings, sample quote):

```bash
DATABASE_URL="postgresql://..." \
NEXT_PUBLIC_APP_URL="https://staging-app.shipwithoat.com" \
npm run prisma:seed
```

6. **Import or recreate test quotes** on staging:
   - Seed creates `Q-SAMPLE-00001` with token `test-accept-token`
   - For full OAT/Keener smoke tests, import approved test opportunities from GHL after deploy (see section 6)

> **Reminder:** Always use the **staging** `DATABASE_URL`. Never point staging env vars at a production database.

### Re-seed branding after deploy

Seed upserts company logo paths (`/branding/oat-logo.jpg`, etc.). Branding files must be committed in `public/branding/` (see preflight).

---

## 4. Git / deployment preflight

Run locally before connecting Vercel to GitHub.

### Checklist

| Item | Expected | How to verify |
|------|----------|---------------|
| `public/branding/` committed | **Yes** — 4 files | `oat-logo.jpg`, `oat-icon.png`, `keener-logo.png`, `keener-icon.png` |
| `.env` committed | **No** | Listed in `.gitignore` |
| `.env.oat-verified` / `.env.keener-verified` committed | **No** | Listed in `.gitignore` |
| `public/generated/` committed | **No** | Listed in `.gitignore` |
| `@vercel/blob` in lockfile | **Yes** | `grep "@vercel/blob" package-lock.json` |
| Local build passes | **Yes** | `npm run build` |
| Git repository initialized | **Required** | `git init` if not yet a repo; push to GitHub |

### Branding files (must be in repo)

```
public/branding/oat-logo.jpg
public/branding/oat-icon.png
public/branding/keener-logo.png
public/branding/keener-icon.png
```

### Preflight commands

```bash
npm run build
grep "@vercel/blob" package-lock.json
git check-ignore -v .env public/generated   # should show .gitignore rules
ls public/branding/
```

**Note:** This workspace may not yet be a git repository. Initialize git, commit application code + branding assets, and push to GitHub before Vercel import.

---

## 5. Vercel deploy steps

### Step-by-step

1. **Push code to GitHub** (include `public/branding/`, exclude `.env*` and `public/generated/`).

2. **Vercel → Add New Project** → Import the GitHub repository.

3. **Configure project** (section 1): Node 20, region `iad1`, project name `quote-generator-staging`.

4. **Add all environment variables** (section 2) for **Production**. Do not deploy until `DATABASE_URL` and `NEXT_PUBLIC_APP_URL` are set.

5. **Run migrations manually** against staging Neon **before** first deploy:

   ```bash
   DATABASE_URL="<staging-url>" npx prisma migrate deploy
   DATABASE_URL="<staging-url>" NEXT_PUBLIC_APP_URL="https://staging-app.shipwithoat.com" npm run prisma:seed
   ```

6. **Enable Deployment Protection** (section 1).

7. **Deploy** (Production). Watch build logs for:
   - `prisma generate` success
   - `next build` compiled successfully
   - No TypeScript or ESLint **errors** (warnings are OK)

8. **Add domain** `staging-app.shipwithoat.com` → wait for DNS → verify HTTPS.

9. **Redeploy** if you changed `NEXT_PUBLIC_APP_URL` after the first deploy (acceptance URLs are built from this value).

### Migrations: Vercel build vs manual

| Approach | Recommendation |
|----------|----------------|
| **Manual `prisma migrate deploy` before deploy** | **Yes — use this for first staging deploy** |
| **Add migrate to Vercel build command** | Optional later (`prisma migrate deploy && npm run build`) — requires careful CI discipline |
| **`prisma migrate dev` on Vercel** | **Never** — dev-only, interactive |

Current `package.json` build script: `prisma generate && next build` — **does not run migrations**. Run `migrate deploy` yourself against staging Neon before the app serves traffic.

### Post-deploy log checks

In Vercel deployment logs, confirm:

- [ ] `✔ Generated Prisma Client`
- [ ] `Compiled successfully`
- [ ] Route list includes `/accept/[token]`, `/import`, `/quotes/[id]/edit`
- [ ] No build failure on `playwright` import (Playwright is a dependency but PDF generation is not invoked at build time)

---

## 6. Required post-deploy smoke test

Use **PASS / FAIL** for each item. All **Required** items must **PASS** before staging is considered ready.

**Approved test references (from local verification scripts):**

| Account | Test opportunity ID | Test quote (if imported) |
|---------|----------------------|--------------------------|
| OAT | `orlebrOtaE52Uyy9WLjz` | `Q-2026-00003` |
| Keener | `RFpzzOpWqlH2BDNC7kGj` | `Q-2026-00004` |

Import test opportunities via `/import` or `/dashboard/import-ghl` if not already in staging DB.

### Access & dashboard

| # | Test | PASS / FAIL |
|---|------|-------------|
| 1 | Staging URL requires deployment protection (not publicly browsable) | |
| 2 | Dashboard `/` loads | |
| 3 | Import page `/import` loads | |
| 4 | Account selector shows **Organized Auto Transport** and **Keener Logistics** | |

### GHL import / search (read-only)

| # | Test | PASS / FAIL |
|---|------|-------------|
| 5 | OAT search finds approved test opportunity (`orlebrOtaE52Uyy9WLjz`) | |
| 6 | Keener search finds approved test opportunity (`RFpzzOpWqlH2BDNC7kGj`) | |
| 7 | Import creates/edits quote without requiring PDF | |

### Internal quote workflow

| # | Test | PASS / FAIL |
|---|------|-------------|
| 8 | OAT quote edit page loads | |
| 9 | Keener quote edit page loads | |
| 10 | **Live quote link** visible, copyable, opens in new tab | |
| 11 | Helper text: live link primary, PDF optional | |
| 12 | Customer Activity section visible on edit page | |

### Public live quote pages (no PDF required)

| # | Test | PASS / FAIL |
|---|------|-------------|
| 13 | OAT public quote link loads (`/accept/{token}`) | |
| 14 | Keener public quote link loads | |
| 15 | Public pages look complete **without** PDF section when no PDF exists | |
| 16 | OAT and Keener branding (logo) displays correctly | |

### Customer actions

| # | Test | PASS / FAIL |
|---|------|-------------|
| 17 | **Accept** works (use a disposable test quote or re-import) | |
| 18 | **Decline** works | |
| 19 | **Ask Question** works | |
| 20 | Notifications appear on dashboard | |
| 21 | Customer Activity updates on edit page after customer action | |

### GHL sync-back safety (must stay off)

| # | Test | PASS / FAIL |
|---|------|-------------|
| 22 | Manual **Sync to GHL** logs status **SKIPPED** | |
| 23 | Automatic triggers (accept/decline/question/PDF) log **SKIPPED** | |
| 24 | No new `APP_TO_GHL` logs with status other than **SKIPPED** | |
| 25 | **No real GHL opportunity fields updated** (spot-check in GHL UI if unsure) | |

**Verify sync logs in DB or edit page GHL Sync section:**

```sql
SELECT status, "createdAt", "requestPayload"->>'trigger' AS trigger
FROM "GhlSyncLog"
WHERE direction = 'APP_TO_GHL'
ORDER BY "createdAt" DESC
LIMIT 10;
```

All rows during first deploy should show `SKIPPED`.

---

## 7. Optional / deferred smoke tests

These are **not blockers** for private staging go-live.

| # | Test | Notes |
|---|------|-------|
| O1 | Generate PDF (optional button on edit page) | May **fail** on Vercel — Playwright/Chromium not configured for serverless |
| O2 | Open PDF | Depends on O1 |
| O3 | Confirm Blob URL stored in `quote.quotePdfUrl` | Requires O1 + `BLOB_READ_WRITE_TOKEN` |
| O4 | Confirm PDF logos | Requires O1 |

Mark as **DEFERRED** until Vercel-compatible PDF rendering is implemented.

---

## 8. Controlled manual sync test (later — not first deploy)

**Do not run on first deploy.**

When smoke tests pass and you explicitly approve one-quote GHL writes:

1. Set **`GHL_SYNC_BACK_ENABLED=true`** in Vercel (Production).
2. Keep **`GHL_AUTO_SYNC_BACK_ENABLED=false`**.
3. Redeploy or wait for env reload.
4. On edit page, click **Sync to GHL** for **one approved OAT quote** (`Q-2026-00003` or freshly imported).
5. Verify in GHL: Public Acceptance URL updated; Quote PDF URL only if PDF exists.
6. Repeat for **one approved Keener quote** (`Q-2026-00004`).
7. Set **`GHL_SYNC_BACK_ENABLED=false`** again and redeploy.
8. Confirm manual sync returns to **SKIPPED**.

**Never** enable `GHL_AUTO_SYNC_BACK_ENABLED=true` until you want accept/decline/question/PDF events to write automatically.

**Do not** run `scripts/create-*-quote-result-fields.ts` or create custom fields without explicit approval.

---

## 9. Final go / no-go recommendation

### Go — private Vercel staging

**Yes — ready for private Vercel staging** when:

- [ ] GitHub repo includes branding assets and excludes secrets/generated PDFs
- [ ] Neon staging DB migrated and seeded
- [ ] Vercel env vars set (section 2)
- [ ] Deployment protection enabled
- [ ] Domain `staging-app.shipwithoat.com` configured
- [ ] Section 6 required smoke tests pass
- [ ] Sync flags remain `false`

### Exact restrictions (staging)

1. **Network:** Deployment protection required; no public internet access without auth.
2. **GHL writes:** All sync-back **SKIPPED** until controlled manual test (section 8).
3. **PDF:** Live quote links are primary; PDF generation optional and likely broken on Vercel until renderer added.
4. **Custom fields:** Do not create GHL custom fields from staging scripts.
5. **Data:** Use staging Neon only; do not share production DB connection strings.
6. **Tokens:** GHL and Blob tokens in Vercel env only — never in git or client bundles.

### Not ready for production until

- App-level authentication for internal routes
- Production Neon project + backup strategy
- GHL sync-back rollout plan (manual then optional auto)
- Vercel-compatible PDF rendering (if PDF delivery required in prod)
- Production domain and monitoring
- Error tracking / alerting
- Explicit production go-live checklist

---

## Quick reference — commands

```bash
# Local preflight
npm run build

# Staging DB (run locally against Neon staging URL)
DATABASE_URL="..." npx prisma migrate deploy
DATABASE_URL="..." NEXT_PUBLIC_APP_URL="https://staging-app.shipwithoat.com" npm run prisma:seed

# Optional local verification (dev server required)
npx tsx scripts/verify-live-quote-workflow.ts
npx tsx scripts/verify-import-account-search.ts
npx tsx scripts/verify-sync-back-safety.ts
```

---

*Last updated: live-link-first platform, PDF optional, sync-back safety flags default off.*
