# eBay

An iOS + web application for creating and publishing eBay listings
without using the eBay website. The iOS client is camera-first, optimized
for listing items in under 60 seconds on mobile; the web client is
form-first, optimized for drafting and bulk publishing at a desk. Drafts
are shared across clients through a self-hosted backend.

**Status:** M0 in progress (planning locked 2026-04-24). The pnpm
workspace, three TypeScript packages, and the iOS Xcode project are
all scaffolded with `/api/health` working end-to-end across the Hono
backend, the Next.js static-export web client, and the SwiftUI iOS
app. 12 tests passing across the four contract points (shared schema,
backend, web, iOS). Remaining M0 work: `infra/` (docker-compose +
nginx site file + marketplace account-deletion compliance endpoint)
and the VPS deploy.

## Design principles

- **De-risk the eBay integration first.** M1 publishes a hardcoded
  listing to the eBay sandbox from a minimal web form. Polished UIs
  follow only once end-to-end publish works.
- **Sandbox-only through M2.** Production credentials are wired in at
  M3 acceptance.
- **Small vertical slices.** Each milestone ends with a demoable
  end-to-end capability, not a completed layer.
- **Single marketplace (eBay US).** No multi-region complexity in v1.

## Planning documents

All three documents are locked. Scope, stack, and milestone acceptance
criteria are committed; changes require an explicit version bump.

| Document                           | Version | Purpose                                                        |
| ---------------------------------- | ------- | -------------------------------------------------------------- |
| [`SPEC.md`](./SPEC.md)             | v0.4    | Product scope, user flows, functional requirements, phase plan |
| [`BUILD_PLAN.md`](./BUILD_PLAN.md) | v0.1    | Tech stack, repo layout, milestones M0–M6, dependencies        |
| [`TEST_PLAN.md`](./TEST_PLAN.md)   | v0.2    | Per-milestone acceptance tests and manual checklists           |

## Technology stack

- **Backend:** TypeScript on Node 22, Hono HTTP framework, Postgres 16
  via Drizzle ORM, `pg-boss` for background jobs, `sharp` for image
  processing, `node-apn` for push delivery.
- **Web:** Next.js 15 with static export, Tailwind CSS, shadcn/ui,
  React Hook Form + Zod, TanStack Query.
- **iOS:** Swift 6, SwiftUI, iOS 17+, SwiftData, AVFoundation.
  Distribution via TestFlight.
- **Infrastructure:** Docker Compose on Ubuntu 24.04, fronted by nginx
  with certbot. CI via GitHub Actions.
- **eBay APIs:** Trading (publish), Browse (pricing comparables),
  Taxonomy (category tree + aspects), Account (Phase 1.5, Business
  Policies).

## Repository layout

```
ebay/
├── shared/     @ebay/shared — Zod schemas + inferred TS types (HealthResponseSchema today)
├── backend/    @ebay/backend — Hono API on Node 22 (GET /api/health today)
├── web/        @ebay/web — Next.js 15 static export, Tailwind v4, TanStack Query
├── ios/        EbayApp.xcodeproj — SwiftUI app, iOS 17+, Swift 6
└── infra/      Docker Compose, nginx site file, deploy scripts (pending — M0 step 6)
```

`shared/`, `backend/`, and `web/` are pnpm workspace packages.
`ios/` and `infra/` sit outside the workspace (Xcode and Docker
worlds; not npm packages).

## Milestones

Defined in [`BUILD_PLAN.md`](./BUILD_PLAN.md):

- **M0** — Repo scaffold, VPS prep, and `/api/health` live at
  `https://ebay.rycsprojects.com`. _In progress (5/7 internal steps
  done — monorepo, shared, backend, web, iOS scaffolds all ✅;
  infra + VPS deploy remain)._
- **M1** — OAuth flow plus publishing a dummy fixed-price listing to
  the eBay sandbox from a minimal web form (the integration de-risk).
- **M2–M6** — Camera flow, drafts, shipping and return profiles, Best
  Offer, auctions, pricing help, push notifications, backups.

## External prerequisites

One-time setup tracked to avoid blocking later milestones:

- [x] eBay developer account
- [x] eBay sandbox keyset (App ID / Dev ID / Cert ID)
- [x] Dedicated eBay sandbox test seller
- [x] DNS A record: `ebay.rycsprojects.com` → VPS IP
- [x] Docker + Docker Compose v2 installed on the VPS
- [x] Apple Developer Program membership (required for TestFlight)
- [ ] eBay production keyset (gated on the marketplace account deletion
      compliance endpoint, deployed during M0 step 6)

## Local development

Prerequisites: **Node 22** (`.nvmrc`), **pnpm 9**, **Xcode 16+** (for
the iOS app).

```bash
# Install all workspace dependencies
pnpm install

# Run backend + web together (two terminals)
pnpm --filter @ebay/backend run dev   # Hono on :3001
pnpm --filter @ebay/web     run dev   # Next.js on :3000

# Open http://localhost:3000 — the home page fetches /api/health
# from the backend (proxied via Next.js dev rewrites)

# Run the iOS app:
#   open ios/EbayApp/EbayApp.xcodeproj   then ⌘R in Xcode
# (the simulator hits http://localhost:3001 directly via an ATS
# exception in Info.plist; backend must be running)
```

Repo-wide checks (run from the repo root):

```bash
pnpm typecheck      # tsc --noEmit across all workspace packages
pnpm test           # Vitest across shared, backend, web (12 tests)
pnpm format         # Prettier write
pnpm format:check   # Prettier check (CI gate)
```

iOS tests run separately via Xcode (`⌘U`) or `xcodebuild test`.

## Out of scope for v1

Deferred by design:

- Multi-variation listings, promoted listings, additional marketplaces
- True inventory / SKU tracking (→ v2)
- CSV bulk import (→ v2)
- In-app shipping label purchase (→ Phase 2.5)
- International shipping (→ v1.5+)
- AI-assisted title and description generation (→ v1.5)

Full list in [`SPEC.md § 8`](./SPEC.md).
