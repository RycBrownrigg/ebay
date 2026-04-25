# eBay Seller App — Build Plan (v0.1)

> Companion to `SPEC.md` (locked at v0.4). This document sequences the work,
> locks in the tech stack, lists setup tasks, and defines milestones with
> acceptance criteria.

## Guiding principles

1. **De-risk the eBay integration first.** The camera UI is fun but not
   risky. OAuth + Trading API XML is unpleasant and unknown. Milestone 1
   is literally "publish a hardcoded listing to eBay sandbox from a
   barebones web form." Only after that works do we build nice UIs.
2. **Sandbox-only until M3.** Every milestone runs against eBay sandbox.
   Production credentials get wired in at M3 acceptance — not before.
3. **One user, one account, one seller.** Don't over-engineer for
   multi-tenancy, roles, or org models.
4. **Small vertical slices.** Each milestone ends with something you can
   demo end-to-end, not with a finished layer.

---

## 1. Tech stack (locked unless flagged)

### Backend
- **Language:** TypeScript, Node 22 LTS
- **HTTP framework:** Hono
- **Database:** Postgres 16
- **ORM / migrations:** Drizzle (lighter than Prisma, SQL-native,
  TypeScript-first)
- **Auth (app-level):** `lucia-auth` or roll a minimal JWT-in-cookie
  setup. Given single-user scope, rolling it is ~50 lines and one fewer
  dependency. **Proposal: roll it.**
- **eBay XML:** `fast-xml-parser` for reading, hand-built XML for
  writing (Trading API payloads are small and well-specified).
- **Image processing:** `sharp` (downscaling, EXIF strip).
- **Secrets at rest:** libsodium (`@noble/ciphers`) sealing the eBay
  refresh token; key from env.
- **Background jobs:** `pg-boss` (Postgres-backed, no Redis needed).
- **Push notifications:** `node-apn` directly to APNs. iOS-only, so no
  need for Firebase.
- **Logging:** `pino` with JSON output.
- **Error tracking:** Sentry SaaS free tier (or self-hosted later).

### Web
- **Framework:** Next.js 15 with static export — matches the existing
  `inktix.rycsprojects.com` pattern on your VPS. All dynamic behavior
  goes through the backend API; the web app is a pure SPA served as
  static files by nginx.
- **UI:** Tailwind CSS, shadcn/ui component primitives.
- **Forms / validation:** React Hook Form + Zod (shared schemas with
  backend).
- **State / data:** TanStack Query for server state; no global store
  needed.

### iOS
- **Language/UI:** Swift 6, SwiftUI, iOS 17+.
- **Networking:** `URLSession` + a thin typed client generated from
  the backend's OpenAPI spec (or hand-written — the API is small).
- **Local persistence:** SwiftData (for offline draft cache).
- **Camera:** `AVFoundation` for custom capture, falling back to
  `PHPickerViewController` for library.
- **Push:** APNs directly, no third-party wrapper.

### Infra
- **Runtime host:** your existing VPS (Ubuntu 24.04).
- **Containerization:** Docker + Docker Compose v2.
- **Reverse proxy:** existing nginx + certbot (new site file for
  `ebay.rycsprojects.com`).
- **CI:** GitHub Actions (build + test on PR; manual deploy to VPS).
- **Deploy:** `docker compose pull && docker compose up -d` over SSH
  from CI, or manually in v1. Kept simple.
- **Backups:** nightly `pg_dump` + images tarball, destination
  configurable (user-chosen: VPS-provider offering or local NAS).

---

## 2. Repo layout

Monorepo. One Git repo, one issue tracker, shared types between
backend and web.

```
ebay/
├── backend/           # Hono API server
│   ├── src/
│   │   ├── routes/    # Route handlers grouped by resource
│   │   ├── ebay/      # Trading API client, OAuth, XML builders
│   │   ├── db/        # Drizzle schema + migrations
│   │   ├── jobs/      # pg-boss worker handlers
│   │   └── index.ts
│   ├── drizzle/       # Generated migration SQL
│   └── package.json
├── web/               # Next.js static-export web app
│   ├── app/           # Next.js app router
│   ├── components/
│   ├── lib/           # API client, shared types import
│   └── package.json
├── ios/               # Xcode project
│   └── EbayApp/
├── shared/            # TypeScript types shared between backend + web
│   └── schemas/       # Zod schemas for validation
├── infra/
│   ├── docker-compose.yml
│   ├── nginx/
│   │   └── ebay.rycsprojects.com.conf
│   ├── Dockerfile.api
│   └── Dockerfile.web
├── SPEC.md
├── BUILD_PLAN.md
└── README.md
```

---

## 3. Environments

| Env | eBay side | Backend | Web | iOS |
|---|---|---|---|---|
| Local dev | Sandbox creds | Localhost via Docker Compose | `npm run dev` | Xcode simulator → localhost |
| Staging | Sandbox creds | `ebay.rycsprojects.com` on VPS (if useful) or skipped | Same host | TestFlight internal |
| Production | Production creds | `ebay.rycsprojects.com` on VPS | Same host | TestFlight external |

**Recommendation:** no formal staging for v1. Sandbox creds on local dev
→ production creds on the VPS. One less thing to maintain. Add staging
if it becomes painful.

---

## 4. Setup checklist (one-time, before Milestone 1)

Things that are already done (crossed out):
- ~~Apple Developer Program enrollment~~ — done
- ~~VPS with nginx + certbot + fail2ban~~ — done
- ~~eBay developer account~~ — done (per §V in decisions log)

Still to do:

### eBay Developer
- [ ] Register a new app in eBay Developer Program
  - Capture **App ID**, **Cert ID**, **Dev ID** for both **sandbox** and
    **production** keysets
  - Set up **RuName** (eBay's redirect URL alias for OAuth) pointing at
    `https://ebay.rycsprojects.com/auth/ebay/callback`
  - Subscribe to required scopes: `sell.inventory`, `sell.account`,
    `sell.fulfillment`, `sell.marketing` (for Best Offer), plus
    `commerce.taxonomy.readonly` and `buy.browse`
- [ ] Create an eBay **sandbox seller account** (separate from your real
  seller account) for development/testing

### DNS
- [ ] Add A record `ebay.rycsprojects.com → <VPS IP>`

### VPS (one-time, SSH in)
- [ ] Install Docker + Docker Compose v2 (`apt install docker.io
      docker-compose-v2`)
- [ ] Create `/var/www/projects/ebay/` with `ryc` ownership (matches
      inktix pattern)
- [ ] Create nginx site `/etc/nginx/sites-available/ebay.rycsprojects.com`,
      symlink to `sites-enabled`
- [ ] Run `certbot --nginx -d ebay.rycsprojects.com`
- [ ] Verify TLS works: `curl https://ebay.rycsprojects.com`

### Apple
- [ ] Create an **App ID** in Apple Developer portal for
      `com.rycsprojects.ebay` (or your preferred bundle ID)
- [ ] Generate an **APNs auth key** (`.p8`) for push notifications
- [ ] Add TestFlight internal testers (you + your wife's Apple IDs)

### GitHub / CI
- [ ] Create private GitHub repo
- [ ] Add repo secrets: `EBAY_SANDBOX_*`, `EBAY_PROD_*`, `VPS_SSH_KEY`,
      `DATABASE_URL`, `APP_SECRET`, `APNS_KEY_*`
- [ ] Enable GitHub Actions

### Local machine
- [ ] Node 22 LTS, pnpm (or npm), Xcode 16+
- [ ] `.env.local` with sandbox eBay creds, local Postgres URL, APNs
      creds for sandbox

---

## 5. Data model (initial)

Tables (Drizzle schema goes in `backend/src/db/schema.ts`):

```
users
  id uuid pk
  email text unique
  password_hash text
  created_at timestamptz

ebay_auth
  id uuid pk
  user_id uuid fk → users
  refresh_token_sealed bytea            -- libsodium-sealed
  access_token_cache text nullable
  access_token_expires_at timestamptz nullable
  ebay_user_id text                     -- eBay-side seller id
  scopes text[]

drafts
  id uuid pk
  user_id uuid fk → users
  format enum('fixed','auction','auction_bin')
  title text
  description_md text
  category_id text                      -- eBay leaf category id
  aspects jsonb                         -- { "Brand": ["Nike"], ... }
  condition text
  price_cents int nullable              -- fixed price or BIN
  starting_bid_cents int nullable       -- auction
  reserve_cents int nullable            -- auction
  duration_days smallint nullable       -- auction
  best_offer_enabled bool
  best_offer_auto_accept_cents int nullable
  best_offer_auto_decline_cents int nullable
  quantity int default 1
  shipping_profile_id uuid fk → shipping_profiles nullable
  shipping_override jsonb nullable      -- per-listing custom
  return_profile_id uuid fk → return_profiles nullable
  return_override jsonb nullable
  sku text nullable
  item_location jsonb                   -- city, state, zip
  status enum('draft','publishing','published','publish_failed','ended')
  ebay_item_id text nullable            -- set after publish
  ebay_listing_url text nullable
  last_publish_error text nullable
  idempotency_key uuid nullable
  created_at timestamptz
  updated_at timestamptz

draft_images
  id uuid pk
  draft_id uuid fk → drafts
  storage_path text                     -- relative to /var/www/projects/ebay/images/
  eps_url text nullable                 -- set after eBay EPS ingest
  mime_type text
  sort_order int
  created_at timestamptz

shipping_profiles
  id uuid pk
  user_id uuid fk → users
  name text
  carrier text
  service_code text                     -- eBay service code
  cost_mode enum('free','flat','calculated')
  flat_rate_cents int nullable
  handling_days smallint
  weight_oz int nullable                -- for calculated
  dims jsonb nullable                   -- { length, width, height }
  created_at timestamptz
  updated_at timestamptz

return_profiles
  id uuid pk
  user_id uuid fk → users
  name text
  accepted bool
  window_days smallint
  who_pays enum('buyer','seller')
  restocking_fee jsonb                  -- { type: 'none'|'percent'|'flat', value? }
  created_at timestamptz
  updated_at timestamptz

category_cache
  ebay_category_id text pk
  parent_id text nullable
  name text
  is_leaf bool
  path text[]                           -- ancestor names for display
  cached_at timestamptz

category_aspects_cache
  ebay_category_id text pk
  aspects jsonb                         -- normalized aspect definitions
  cached_at timestamptz

listing_events
  id bigserial pk
  draft_id uuid fk → drafts
  event_type text                       -- 'published','best_offer_received','bid','sold','ended'
  payload jsonb
  occurred_at timestamptz

device_tokens
  id uuid pk
  user_id uuid fk → users
  apns_token text
  platform enum('ios')
  created_at timestamptz
```

This is the v1 shape. v2 inventory tracking adds an `items` table
(SKU-level) that drafts link to.

---

## 6. API surface (initial)

All routes under `/api`. JSON in / JSON out. Cookie-based session for
auth.

```
Auth (app)
  POST   /api/auth/login                 { email, password } → session
  POST   /api/auth/logout
  GET    /api/auth/me

eBay OAuth
  GET    /api/auth/ebay/start            → redirect to eBay consent
  GET    /api/auth/ebay/callback         ← redirect from eBay
  GET    /api/auth/ebay/status           → { connected, ebay_user_id }
  DELETE /api/auth/ebay                  → revoke

Drafts
  GET    /api/drafts
  POST   /api/drafts
  GET    /api/drafts/:id
  PATCH  /api/drafts/:id                 (autosave)
  DELETE /api/drafts/:id
  POST   /api/drafts/:id/images          (multipart upload, returns image rec)
  DELETE /api/drafts/:id/images/:imageId
  PATCH  /api/drafts/:id/images/:imageId (reorder)
  POST   /api/drafts/:id/publish         (idempotent via header)

Listings (published)
  GET    /api/listings?status=active|sold|ended
  GET    /api/listings/:id
  POST   /api/listings/:id/end-and-relist
  GET    /api/listings/:id/offers
  POST   /api/listings/:id/offers/:offerId/:action  (accept|decline|counter)

Profiles
  GET/POST              /api/shipping-profiles
  GET/PATCH/DELETE      /api/shipping-profiles/:id
  GET/POST              /api/return-profiles
  GET/PATCH/DELETE      /api/return-profiles/:id

Taxonomy
  GET    /api/categories/tree?parent=
  GET    /api/categories/:id/aspects

Pricing help
  GET    /api/pricing/comparables?q=&category=

Devices (push)
  POST   /api/devices                    (register APNs token)
  DELETE /api/devices/:id
```

---

## 7. Milestones

Effort estimates are **focused-work weeks**, not calendar weeks. Adjust
for your actual pace.

### M0 — Foundation (1 week)
Get the skeleton running end-to-end before touching eBay.

- Monorepo scaffolded per §2
- Backend: Hono + Postgres (via Docker Compose) + health check endpoint
- Web: Next.js skeleton with a login page
- iOS: empty Xcode project that compiles and fetches `/api/health`
  from a dev backend
- Deploy: first deploy to VPS, TLS working on
  `https://ebay.rycsprojects.com`
- CI: GitHub Actions builds + typechecks on PR

**Acceptance:** you can log in on the web from your browser, and the iOS
simulator hits the backend's health endpoint. Nothing talks to eBay yet.

---

### M1 — eBay OAuth + first publish (2 weeks) ⭐ the risky one
The critical de-risking slice. Nothing pretty. One goal: a real listing
appears on eBay sandbox.

- eBay OAuth flow wired end-to-end (`/api/auth/ebay/start` →
  consent → `/callback` → refresh token stored encrypted)
- Trading API client in `backend/src/ebay/`: XML request builder,
  response parser, auth header, error mapping
- `POST /api/drafts/:id/publish` takes a minimal draft (hardcoded
  shipping and category if needed) and calls `AddItem` on sandbox
- Bare-bones web form to create that minimal draft and hit publish
- Verify the listing appears in the sandbox seller account

**Acceptance:** from your browser, fill a 4-field form, click Publish,
see a new item in your eBay sandbox account. Go back and verify the
draft's `ebay_item_id` was stored. Error cases (bad category, missing
aspect) surface a readable error.

**Why this matters:** if this takes 3 weeks instead of 2, we find out
now — not after we've built the iOS camera UI.

---

### M2 — Full listing creation on web (fixed-price only) (2 weeks)

- Category picker UI (Taxonomy API, server-cached tree)
- Aspect input rendering driven by `getItemAspectsForCategory`
- Image upload pipeline: multipart → sharp (downscale, strip EXIF) →
  local storage → draft association
- EPS ingest step: on publish, eBay pulls hosted URLs → we attach
  returned EPS URLs to the `AddItem` call
- Shipping/return profile management UI (CRUD)
- Seed starter profiles (§5.7 of spec) on first run
- Draft list + autosave + end-and-relist

**Acceptance:** create a fixed-price draft from the web with 3 photos,
pick a category with required aspects, pick a shipping profile, publish
to sandbox, see it live with images. End-and-relist works.

---

### M3 — Auctions + Best Offer + production switchover (1.5 weeks)

- Auction fields in draft form (format, starting bid, reserve, duration)
- Best Offer configuration (on/off, auto-accept, auto-decline)
- Best Offer inbox (listing detail): list offers, accept/decline/counter
  via Trading API (`RespondToBestOffer`)
- Listing status polling job (`GetMyeBaySelling` → update local state)
- **Flip to production eBay creds.** First real listing goes live.

**Acceptance:** publish an auction with a reserve to production. Publish
a fixed-price item with Best Offer on. Receive an offer (buyer stub or
real), accept it via the app.

---

### M4 — iOS app (3 weeks)

- Auth flow against backend
- SwiftData models mirroring draft schema
- Camera-first "new listing" flow (AVFoundation)
- Form screens for all fields (reuse Zod schemas via hand-translation)
- Draft sync (pull on focus, push on edit)
- Image upload with background task
- Publish flow with error handling
- APNs push registration + device token upload
- TestFlight submission to you + wife

**Acceptance:** both of you install via TestFlight. Take photos of an
item, fill the form, publish to production. Works offline to draft-save.

---

### M5 — Lifecycle, notifications, polish (1.5 weeks)

- Active / Sold / Ended views on both platforms
- Push notifications: Best Offer received, auction ending (last hour),
  auction ended, item sold
- Background poll job: checks eBay for status changes every ~5 min,
  fans out push notifications + listing-event rows
- Pricing help: "Recent comparables" panel using Browse API
- Nightly backup job: `pg_dump` + images tarball, upload to
  user-configured destination (S3-compatible interface; user provides
  endpoint + creds in env)

**Acceptance:** sell something, get notified, see it move from Active to
Sold on both platforms. Pricing comparables work. Backups run and land
at the configured destination.

---

### M6 — Hardening + handoff (1 week)

- Error tracking (Sentry) wired on backend, web, iOS
- fail2ban jail for the API's 401 responses
- Documentation: README with dev setup, runbook for the VPS
- Known-issue backlog groomed
- Handoff / sign-off

**Acceptance:** we declare v1 done.

---

## 8. Total estimate

**≈ 12 focused-work weeks** end to end for v1. If you're putting in ~10
hours/week, plan on roughly 6 months calendar; at 20 hours/week, 3
months.

The biggest risks to this estimate are:
1. **Trading API surprises** — sandbox behavior differs from production
   in small annoying ways. Hence M1 being its own milestone.
2. **Category / aspect UX** — the hierarchy picker is simple in
   principle but has long-tail edge cases (variations-only categories,
   restricted categories, required images per category).
3. **iOS camera UX polish** — custom capture with good defaults takes
   longer than "just use `PHPicker`." Worth it for the spec's goal of
   60-second mobile listings.

---

## 9. What to build first — concrete next steps

If you want to start tomorrow, the sequence is:

1. **Setup checklist** (§4). An evening's work, mostly waiting on DNS
   propagation and eBay app registration.
2. **M0 repo scaffold**. I can write the initial commit: `backend/`,
   `web/`, `ios/`, `infra/` skeletons, Docker Compose, nginx site
   config, one health-check endpoint.
3. **M1 eBay OAuth**. The first "real" code, and the one that matters
   most. I can write it against sandbox as soon as you have the
   sandbox keyset.

Say the word on which of these you'd like me to actually start writing.
