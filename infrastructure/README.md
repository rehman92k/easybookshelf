# Production infrastructure (Google Cloud + Firebase)

Recommended stack for EasyBookshelf:

| Service | GCP / Firebase product |
|---------|------------------------|
| Reader, Publisher, Admin | **Firebase App Hosting** |
| API (NestJS) | **Cloud Run** |
| Database | **Cloud SQL (PostgreSQL)** |
| Book files | **Firebase Storage** |
| Auth | **Firebase Auth** |

## Quick start

Full step-by-step guide: **[docs/PRODUCTION_DEPLOY.md](../docs/PRODUCTION_DEPLOY.md)**

```bash
# API Docker image (local test)
docker build -t easybookshelf-api .
docker run -p 8080:8080 --env-file apps/api/.env easybookshelf-api

# Deploy API via Cloud Build
gcloud builds submit --config cloudbuild.yaml .

# DB migrations (production)
pnpm db:migrate:deploy
```

## Config files

| File | Purpose |
|------|---------|
| `Dockerfile` | Cloud Run API container |
| `cloudbuild.yaml` | Build + push + deploy API |
| `apps/*/apphosting.yaml` | Firebase App Hosting per web app |
| `apps/api/.env.production.example` | Production API env template |
| `.firebaserc.example` | Firebase project ID |

## Region

Use **`asia-south1` (Mumbai)** for API, Cloud SQL, and App Hosting backends.

## Legacy AWS Terraform

The `terraform/` folder contains an older AWS plan (ECS/RDS/S3). The current recommendation is Firebase + GCP above. AWS Terraform is kept for reference only.

## Local development

Use Docker Compose (unchanged):

```bash
pnpm docker:up
```

Local dev uses filesystem storage (`STORAGE_DRIVER=local`). Production uses `STORAGE_DRIVER=firebase`.
