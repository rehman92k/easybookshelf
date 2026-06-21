# Production deployment (Firebase + Google Cloud)

**Stack:** Firebase Auth · App Hosting (3 Next.js apps) · Cloud Run (API) · Cloud SQL (PostgreSQL) · Firebase Storage

**Environments:** Local dev + Production only (no staging).

Region recommendation: **`asia-south1` (Mumbai)** for India users.

---

## Architecture

```
easybookshelf.com              → App Hosting (reader)
publisher.easybookshelf.com    → App Hosting (publisher)
admin.easybookshelf.com        → App Hosting (admin)
api.easybookshelf.com          → Cloud Run (NestJS API)
                                 ↓
                    Cloud SQL PostgreSQL (same region)
                    Firebase Storage (books + covers)
                    Firebase Auth
```

---

## Prerequisites

1. [Google Cloud / Firebase project](https://console.firebase.google.com) on **Blaze** plan
2. [gcloud CLI](https://cloud.google.com/sdk/docs/install) logged in
3. [Firebase CLI](https://firebase.google.com/docs/cli): `npm install -g firebase-tools`
4. GitHub repo connected to Firebase App Hosting
5. Domain(s) for custom URLs

---

## Step 1 — Firebase project

```bash
firebase login
cp .firebaserc.example .firebaserc
# Edit .firebaserc with your project ID
```

In Firebase Console:

- Enable **Authentication** (Email/Password, Google if needed)
- Create **Storage** bucket (default bucket name → use as `FIREBASE_STORAGE_BUCKET`)
- Add production domains under **Authentication → Settings → Authorized domains**

---

## Step 2 — Cloud SQL (PostgreSQL)

1. GCP Console → **SQL** → Create instance  
   - Engine: **PostgreSQL 16**  
   - Region: **asia-south1**  
   - Machine: **db-f1-micro** (start small) or **db-g1-small**  
   - Database: `easybookshelf`  
   - User + strong password  

2. Note the **connection name**: `PROJECT_ID:asia-south1:INSTANCE_NAME`

3. **DATABASE_URL** for Cloud Run (Unix socket):

```bash
postgresql://DB_USER:DB_PASSWORD@/easybookshelf?host=/cloudsql/PROJECT_ID:asia-south1:INSTANCE_NAME
```

4. Run migrations **once** (from your machine with Cloud SQL Auth Proxy, or from a one-off Cloud Run job):

```bash
# Local with proxy:
cloud-sql-proxy PROJECT_ID:asia-south1:INSTANCE_NAME &
DATABASE_URL="postgresql://..." pnpm db:migrate:deploy
```

5. Seed **catalog data** (categories, languages, platform defaults — required for publisher upload):

```bash
DATABASE_URL="postgresql://..." pnpm db:seed:catalog
```

6. Bootstrap super admin (production email + phone):

```bash
pnpm dev:create-super-admin -- --email=admin@yourdomain.com --password=... --phone=...
```

---

## Step 3 — Deploy API to Cloud Run

### One-time GCP setup

```bash
export PROJECT_ID=your-project-id
export REGION=asia-south1

gcloud config set project $PROJECT_ID
gcloud services enable run.googleapis.com sqladmin.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com

gcloud artifacts repositories create easybookshelf \
  --repository-format=docker \
  --location=$REGION
```

### Build & deploy

```bash
# From repo root
gcloud builds submit --config cloudbuild.yaml .
```

Or manually:

```bash
docker build -t $REGION-docker.pkg.dev/$PROJECT_ID/easybookshelf/easybookshelf-api:latest .
docker push $REGION-docker.pkg.dev/$PROJECT_ID/easybookshelf/easybookshelf-api:latest

gcloud run deploy easybookshelf-api \
  --image $REGION-docker.pkg.dev/$PROJECT_ID/easybookshelf/easybookshelf-api:latest \
  --region $REGION \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --min-instances 1 \
  --add-cloudsql-instances PROJECT_ID:asia-south1:INSTANCE_NAME \
  --set-env-vars "NODE_ENV=production,CORS_ORIGINS=https://easybookshelf.com,https://publisher.easybookshelf.com,https://admin.easybookshelf.com" \
  --set-secrets "DATABASE_URL=database-url:latest,JWT_SECRET=jwt-secret:latest,FIREBASE_PRIVATE_KEY=firebase-private-key:latest"
```

Use **Secret Manager** for secrets (recommended). For Firebase Admin on Cloud Run, prefer env vars:

- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY` (with `\n` for newlines)

Or mount the service account JSON via secrets.

### Production API env vars

See `apps/api/.env.production.example`. Key settings:

| Variable | Production value |
|----------|------------------|
| `PORT` | `8080` (Cloud Run default) |
| `STORAGE_DRIVER` | `firebase` |
| `FIREBASE_STORAGE_BUCKET` | your bucket, e.g. `your-project.appspot.com` |
| `PHONE_OTP_DEV_MODE` | `false` |
| `ALLOW_MOCK_PAYMENTS` | `false` |
| `CORS_ORIGINS` | your 3 web app URLs |

Health check: `https://api.easybookshelf.com/api/v1/health`

---

## Step 4 — App Hosting (3 web apps)

Create **three backends** in Firebase Console → **App Hosting** (or CLI):

```bash
firebase apphosting:backends:create
```

| Backend | Root directory | Custom domain |
|---------|----------------|---------------|
| reader | `apps/web-reader` | `easybookshelf.com` |
| publisher | `apps/web-publisher` | `publisher.easybookshelf.com` |
| admin | `apps/web-admin` | `admin.easybookshelf.com` |

Each app has `apphosting.yaml` in its folder. Connect your GitHub repo; pushes to `main` trigger deploys.

### Web app env vars (Firebase Console → App Hosting → Environment)

Set for **BUILD** and **RUNTIME**:

**Reader** (`apps/web-reader/.env.production.example`):

```
NEXT_PUBLIC_API_URL=https://api.easybookshelf.com/api/v1
NEXT_PUBLIC_PUBLISHER_URL=https://publisher.easybookshelf.com
NEXT_PUBLIC_FIREBASE_*= (from Firebase console)
```

**Publisher** and **Admin** — same pattern; see their `.env.production.example` files.

---

## Step 5 — Firebase Storage rules

Lock book files to API-only access (clients use signed URLs or API streaming):

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}
```

The API uses Firebase Admin SDK (full access). Public cover images can use a separate `covers/` path with read rules if needed later.

---

## Step 6 — DNS

| Record | Points to |
|--------|-----------|
| `easybookshelf.com` | App Hosting reader backend |
| `publisher.easybookshelf.com` | App Hosting publisher |
| `admin.easybookshelf.com` | App Hosting admin |
| `api.easybookshelf.com` | Cloud Run service URL / mapping |

Firebase and Cloud Run provide SSL automatically.

---

## Local → production workflow

1. Develop locally (`pnpm docker:up`, `corepack pnpm dev`)
2. Before deploy:
   ```bash
   corepack pnpm lint && corepack pnpm typecheck && corepack pnpm build
   ```
3. **Backup** Cloud SQL
4. Deploy API → run `pnpm db:migrate:deploy` if schema changed
5. Deploy web apps (Git push or manual rollout)
6. Smoke test: sign-in, OTP, browse, one admin action

---

## Cost controls

- Set **billing budget alert** at ₹5,000/month in GCP Console
- Cloud Run: `--min-instances 1` avoids cold starts (~₹500–1500/mo extra) — recommended for production
- Cloud SQL: start **db-f1-micro**, upgrade when slow
- App Hosting: 3 backends share Blaze free tiers at low traffic

Estimated early production: **₹3,500–15,000/month** (see prior cost discussion).

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| App Hosting build fails | Check `apphosting.yaml` paths; verify standalone: `pnpm --filter @easybookshelf/web-reader build && find apps/web-reader/.next/standalone -name server.js` |
| API can't reach DB | Cloud SQL connector on Cloud Run; check `DATABASE_URL` socket path |
| CORS errors | Update `CORS_ORIGINS` on API with exact production URLs |
| Storage upload fails | Set `STORAGE_DRIVER=firebase` + bucket; ensure Cloud Run SA has **Storage Admin** |
| OTP not sent | Set `PHONE_OTP_DEV_MODE=false`; configure SMS provider |

---

## Files added for this stack

| File | Purpose |
|------|---------|
| `Dockerfile` | Cloud Run API image |
| `cloudbuild.yaml` | GCP Cloud Build pipeline |
| `.dockerignore` | Slim Docker context |
| `apps/*/apphosting.yaml` | Firebase App Hosting per app |
| `apps/api/.env.production.example` | Production API env template |

See also: [docs/FIREBASE_SETUP.md](./FIREBASE_SETUP.md), [docs/ADMIN_SETUP.md](./ADMIN_SETUP.md)
