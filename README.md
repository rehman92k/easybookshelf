# EasyBookshelf

Production-grade digital book reading and publishing platform.

## Architecture

| App | Package | Port | Description |
|---|---|---|---|
| Reader Web | `@easybookshelf/web-reader` | 3000 | Book discovery, library, reading |
| Publisher Portal | `@easybookshelf/web-publisher` | 3001 | Upload and manage books |
| Admin Portal | `@easybookshelf/web-admin` | 3002 | Platform administration |
| API | `@easybookshelf/api` | 4000 | NestJS backend |

## Prerequisites

- Node.js 20+
- pnpm 9+ (`corepack enable`)
- Docker (for PostgreSQL and Redis)

## Quick Start

```bash
# Install dependencies
corepack pnpm install

# Start local infrastructure
docker compose -f docker/docker-compose.yml up -d

# Copy environment files
cp apps/api/.env.example apps/api/.env

# Run all apps in development
corepack pnpm dev
```

Or run individually:

```bash
corepack pnpm dev:api        # http://localhost:4000  (landing page + /docs)
corepack pnpm dev:reader     # http://localhost:3000
corepack pnpm dev:publisher  # http://localhost:3001
corepack pnpm dev:admin      # http://localhost:3002
```

### API URLs

| URL | Description |
|---|---|
| http://localhost:4000 | API landing page |
| http://localhost:4000/docs | Swagger API documentation |
| http://localhost:4000/api/v1/health | Health check |

> **Note:** Navigation links in the web apps (Browse, Sign in, etc.) are placeholders until auth and catalog modules are built. UI polish is planned for later phases.

## Monorepo Structure

```
easybookshelf/
├── apps/
│   ├── api/              # NestJS API
│   ├── web-reader/       # Next.js reader app
│   ├── web-publisher/    # Next.js publisher portal
│   └── web-admin/        # Next.js admin portal
├── packages/
│   ├── shared-types/     # Shared TypeScript types
│   ├── api-client/       # API client SDK
│   ├── ui/               # Shared UI components
│   ├── database/         # Prisma schema & migrations
│   ├── eslint-config/    # ESLint configs
│   └── tsconfig/         # TypeScript configs
├── docker/               # Docker Compose for local dev
└── infrastructure/       # Terraform (Module M2)
```

## Business Rules (v1.3)

- **Commission:** 15% platform on purchases / 10% on rentals (configurable in admin; per-publisher overrides supported)
- **Subscription:** Ad-free — ₹30/mo, ₹300/yr + member discount on purchases (admin-configurable)
- **Books:** Purchase permanently or rent for 15/30 days
- **Mobile:** Phase 2 (web-first launch)

## Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Start all apps |
| `pnpm build` | Build all packages and apps |
| `pnpm lint` | Lint all packages |
| `pnpm typecheck` | Type-check all packages |
| `pnpm test` | Run tests |

## Development Roadmap

- [x] **M1** — Monorepo setup
- [x] **M2** — Infrastructure (Docker, CI, Terraform stubs)
- [x] **M3** — Database schema & migrations
- [x] **M4** — Authentication (Firebase + JWT)
- [x] **M5** — User management & RBAC
- [x] **M6** — Catalog (books API, browse/detail, sample seed)
- [x] **M7** — Search (API + reader search page)
- [x] **M8** — File upload pipeline (publisher API + portal)
- [x] **M9** — Admin book approval flow (review queue, approve/reject)
- [x] **M10** — Reading experience (preview, EPUB/PDF reader, progress)
- [x] **M11** — Commerce (orders, checkout, entitlements, library)
- [x] **M12** — Wishlist and reading history
- [x] **M13** — Ad-free subscriptions (plans, subscribe/cancel, admin pricing)
- [x] **M14** — Web ads (Google AdSense, hidden for ad-free subscribers)
- [x] **M15** — Publisher settlements (generate, mark paid, earnings dashboard)
- [x] **M16** — UI/UX polish (shared components, admin/publisher shells, mobile reader nav)

See [docs/ADS.md](docs/ADS.md) for AdSense setup. Mobile ads use AdMob in Phase 2.

## Database

```bash
# One-time setup (Docker + migrate + seed)
pnpm setup

# Or step by step:
pnpm docker:up
cp packages/database/.env.example packages/database/.env
cp apps/api/.env.example apps/api/.env
pnpm db:migrate
pnpm db:seed

# Browse data
pnpm db:studio
```

## Production deployment

Firebase Auth + App Hosting + Cloud Run + Cloud SQL + Firebase Storage.

See **[docs/PRODUCTION_DEPLOY.md](docs/PRODUCTION_DEPLOY.md)** for the full guide (local → production, no staging).

## License

Private — All rights reserved.
