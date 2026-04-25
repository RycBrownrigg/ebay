# eBay

An iOS + web application for creating and publishing eBay listings
without using the eBay website. The iOS client is camera-first, optimized
for listing items in under 60 seconds on mobile; the web client is
form-first, optimized for drafting and bulk publishing at a desk. Drafts
are shared across clients through a self-hosted backend.

**Status:** Planning complete (2026-04-24). Implementation begins at
M0 (repo scaffold + VPS provisioning). The repository currently contains
the three locked planning documents and no source code.

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

Structure materializes during M0:

```
ebay/
├── backend/    Hono API, Drizzle schema, pg-boss workers
├── web/        Next.js static-export web app
├── ios/        Xcode project (EbayApp)
├── shared/     TypeScript types shared between backend and web
└── infra/      Docker Compose, nginx site file, deploy scripts
```

## Milestones

Defined in [`BUILD_PLAN.md`](./BUILD_PLAN.md):

- **M0** — Repo scaffold, VPS prep, and `/api/health` live at
  `https://ebay.rycsprojects.com`. _In progress._
- **M1** — OAuth flow plus publishing a dummy fixed-price listing to
  the eBay sandbox from a minimal web form (the integration de-risk).
- **M2–M6** — Camera flow, drafts, shipping and return profiles, Best
  Offer, auctions, pricing help, push notifications, backups.

## External prerequisites

One-time setup tracked to avoid blocking later milestones:

- [ ] eBay sandbox keyset (App ID / Dev ID / Cert ID)
- [ ] eBay production keyset (gated on the marketplace account deletion
      compliance endpoint, deployed during M0/M1)
- [ ] Dedicated eBay sandbox test seller
- [ ] DNS A record: `ebay.rycsprojects.com` → VPS IP
- [ ] Docker + Docker Compose v2 installed on the VPS
- [x] Apple Developer Program membership (required for TestFlight)
- [x] eBay developer account

## Out of scope for v1

Deferred by design:

- Multi-variation listings, promoted listings, additional marketplaces
- True inventory / SKU tracking (→ v2)
- CSV bulk import (→ v2)
- In-app shipping label purchase (→ Phase 2.5)
- International shipping (→ v1.5+)
- AI-assisted title and description generation (→ v1.5)

Full list in [`SPEC.md § 8`](./SPEC.md).
