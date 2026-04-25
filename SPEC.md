# eBay Seller App — Product Specification (v0.4, locked)

> Status: **Locked.** All scope and architectural decisions are committed.
> This is the spec of record for v1. Next artifact is the **build plan**
> (repo layout, milestones, dependencies, the first implementable slice).

## Changelog
- **v0.4** — All open questions closed. Shipping starter set narrowed to
  USPS Priority Flat Rate ("If It Fits, It Ships") with UPS Ground as the
  alternative for items that don't fit. No local pickup in v1. iOS
  distribution via TestFlight. User manages DNS and will create the eBay
  `ebay.rycsprojects.com` A record. Backup destination is user-selected
  (VPS provider offering or local NAS) — spec only locks in *that* nightly
  backups happen and what they contain; the destination is a runtime
  config value. Business Policies: v1 inlines shipping/return on each
  publish; Phase 1.5 pushes profiles up to eBay once you opt in. §5.8
  renumbered into proper sequence.
- v0.3 — Reserve price + pricing-help ("recent comparables") into v1.
  Shipping profiles designed. Concrete VPS deployment plan.
- v0.2 — Auctions + Best Offer into v1. API routing decided.
- v0.1 — Initial draft.

---

## 1. Overview

A personal eBay selling app that lets you and your wife create and publish
eBay listings from an iPhone (camera-first) or desktop browser
(form-first), without needing to touch eBay's own website. The iOS app is
optimized for "I just picked up this item, let me list it in 60 seconds
while holding it." The web app is optimized for "I'm at my desk polishing
drafts and bulk publishing."

### Primary goal
Reduce the time between "I have an item to sell" and "it's live on eBay"
to under 2 minutes on mobile and under 5 minutes on web, without
compromising listing quality.

### Non-goals (v1)
- Multi-tenant SaaS. Single household only.
- Non-US eBay marketplaces.
- Multi-variation listings (size/color variants on one SKU).
- Promoted Listings / advertising management.
- Analytics beyond a basic active/sold view.
- Other marketplaces (Mercari, Poshmark, Facebook Marketplace).
- True inventory tracking (SKUs with stock). Revisit in v2.
- CSV / bulk import. Revisit in v2.
- In-app shipping label purchase. Revisit in Phase 2.5.
- Local-pickup shipping option. Can be added later if needed.

---

## 2. Users & personas

**Users:** you and your wife, selling household items from a single shared
eBay seller account. Goal is to avoid the eBay website entirely.

- One shared app account tied to one eBay seller account.
- Multi-device: 2 iPhones + desktop browser(s), all signed in to the same
  account, all seeing the same drafts and listings.
- No per-user attribution on drafts in v1.
- Concurrent editing unlikely — "last write wins" with a stale-data
  banner.
- **Forward-looking:** this may become a business. v1 ships as
  casual-seller but the data model doesn't preclude business workflows.

---

## 3. Platforms

| Platform | Scope |
|---|---|
| iOS | Native Swift / SwiftUI. iPhone-first, iPad "works but not optimized." iOS 17+. Distributed via **TestFlight**. |
| Web | Responsive, desktop-first. Modern Chrome / Safari / Firefox. |
| Backend | TypeScript + Hono on your VPS (Ubuntu 24.04). See §6.2 and §6.6. |

---

## 4. Core user flows

### 4.1 iOS — "Quick list from camera"
1. Open app → tap **+ New listing** (primary button, always visible).
2. Camera opens. Take 1–N photos. Swap to photo library if needed.
3. Photos upload in background while the form is filled.
4. Select **format**: fixed-price, auction, or auction + Buy It Now.
5. Fill form fields (§5.2) — title, description, price/auction settings,
   condition, category, shipping profile.
6. (v1.5) Tap "Generate description" → AI-assisted draft.
7. Preview.
8. Tap **Publish** (live on eBay) or **Save draft** (shared with web).

### 4.2 Web — "Polish and publish"
1. Dashboard: active listings, drafts, sold, (Phase 2) orders awaiting
   action.
2. Open a draft → edit form with full-size image editor (reorder, crop,
   rotate, delete).
3. Create new listing from scratch: drag/drop images, fill form, publish.
4. Bulk actions on drafts: select N → publish all.

### 4.3 Shared drafts across devices
Drafts live on the backend, so you can save on one device and come back
to edit on another. No real-time sync is needed.

- Draft created on iOS appears on web on next open.
- Edits reflect on the other device on next open (pull-on-focus).
- Last write wins with a stale-data banner when the local copy is known
  to be stale.

### 4.4 Best Offer management (fixed-price listings)
1. When a listing with Best Offer enabled receives an offer, iOS push
   notification + web banner fire.
2. From the listing detail, offers list with Accept / Counter / Decline.
3. Optional per-listing auto-accept (≥ $X) and auto-decline (≤ $Y)
   thresholds handle common cases without a tap.
4. **Default:** Best Offer is **on** for new fixed-price listings.

### 4.5 Auction lifecycle
1. After publish, user sees current bid, bid count, time remaining
   (pull to refresh).
2. If auction ends without meeting reserve or without bids, push
   notification + one-tap "Relist" action.
3. Auto-relist is **manual only**.
4. **Default auction duration:** 7 days. Reserve price supported.

---

## 5. Functional requirements

### 5.1 Authentication
Two separate auth concerns:

1. **App account** — email + password (or passkey) login to our own app.
   A single shared household account. Sessions persist on each device.
2. **eBay seller account** — uses **eBay OAuth 2.0 (User Access Token)**.
   App ID / Cert ID / Dev ID from our registered eBay developer app
   initiates the flow. User consents via eBay's OAuth screen once from
   the web app; refresh token stored encrypted server-side and used to
   mint access tokens. One-time setup.

### 5.2 Listing fields

| Field | Required | Notes |
|---|---|---|
| Format | yes | Fixed price / Auction / Auction + BIN |
| Title | yes | ≤ 80 chars (eBay limit) |
| Description | yes | Rich text or Markdown → HTML for eBay |
| Photos | yes | 1–24 per listing (eBay max) |
| Category | yes | Hierarchical picker (§6.3) |
| Item aspects | varies | Brand, Size, Color — required set depends on category |
| Condition | yes | eBay enumerated values |
| Price (fixed-price) | if format=fixed | |
| Starting bid (auction) | if format=auction | |
| Reserve price (auction) | no | **v1.** eBay charges a fee when set. |
| Auction duration | if format=auction | 1 / 3 / 5 / 7 / 10 days; default 7 |
| Best Offer enabled | no | Fixed-price only. Default ON. Optional auto-accept / auto-decline per listing. |
| Quantity | yes | Default 1. Auctions always qty 1. |
| Shipping profile | yes | Select from profiles (§5.7) or override with custom |
| Return profile | yes | Select from profiles (§5.7) or override |
| SKU | no | Auto-generated if omitted |
| Item location | yes | Defaults to seller's registered address |

### 5.3 Image handling
- iOS: capture full resolution, downscale client-side to ≤ 1600px long
  edge before upload.
- Images stored on the VPS (nginx-served). URLs passed to eBay, which
  ingests into **eBay Picture Services (EPS)** and returns hosted URLs
  attached to the listing.
- Per-image operations: reorder, delete, crop, rotate (web). iOS v1:
  reorder + delete. Crop/rotate deferred to v1.5.
- EXIF / GPS metadata stripped before upload.

### 5.4 Publishing
- All listings published via the **Trading API** (§6.5).
- Success: eBay item ID, URL, and status stored locally.
- Failure: surface eBay's error verbatim plus plain-English translation.
  Draft remains editable so user can fix and retry.
- **Idempotency:** every publish uses a client-generated idempotency key
  so a retry after a flaky network doesn't duplicate on eBay.

### 5.5 Drafts
- Autosave every field change.
- Draft list sortable by updated / created.
- Drafts never touch eBay until explicitly published.

### 5.6 Listing lifecycle after publish
- **Active / Sold / Ended / Ended Without Bids** views in both apps.
- Pull-to-refresh updates statuses.
- No in-place edit of a live listing. To change price or terms: **end +
  relist** (one-tap; we duplicate the draft, user adjusts, republishes).
- Auctions that end without bids show a "Relist" suggestion; manual
  confirmation required.

### 5.7 Shipping & return profiles

Rather than retyping shipping/return info on every listing, v1 supports
reusable **profiles**. The user picks one per listing; for unusual items,
"custom" overrides shipping on that listing without affecting the
profile.

**Shipping profile fields**
- Name
- Carrier & service
- Cost mode: Free (seller pays) / Flat rate $X / Calculated by weight
  & dimensions
- Handling time (1, 2, or 3 business days)
- Weight & dimensions (for calculated)
- Domestic only (v1 — international deferred)

**Return profile fields**
- Name
- Returns accepted: Yes / No
- Return window: 30 / 60 days
- Who pays return shipping: buyer / seller
- Restocking fee: none / % / flat

**Starter set of shipping profiles** (pre-created on first run):
1. *USPS Priority Flat Rate Envelope* — "If It Fits, It Ships," buyer
   pays flat
2. *USPS Priority Flat Rate — Small Box* — buyer pays flat
3. *USPS Priority Flat Rate — Medium Box* — buyer pays flat
4. *USPS Priority Flat Rate — Large Box* — buyer pays flat
5. *UPS Ground (calculated)* — weight & dimensions per listing, for
   items that don't fit a flat-rate box
6. *Free shipping — USPS Priority* — seller pays, for items where you
   want "free shipping" badge

All profiles editable. Add / rename / delete at any time. No local
pickup option in v1.

**Starter set of return profiles** (pre-created on first run):
1. *30 days, buyer pays return shipping*
2. *No returns*

**Upgrade path to real eBay Business Policies:** profile schema is
designed to map 1:1 onto eBay Business Policies via the **Sell Account
API** (`createShippingFulfillmentPolicy`, `createReturnPolicy`,
`createPaymentPolicy`). When you opt into the Business Policies program
on eBay (Phase 1.5), we push profiles up and reference them by policy
ID on each listing. Until then, v1 inlines the fields on each publish
call.

**Payment:** eBay Managed Payments is automatic — no per-listing choice.

### 5.8 Pricing help — "Recent comparables"
While setting a price, the user taps **"See recent comparables"** and we
call the eBay Browse API to surface recently sold similar items (by
title keywords + category). Shows a small list with thumbnail, title,
sold date, and sold price. Pure reference — doesn't auto-fill price.

---

## 6. Architecture

### 6.1 Components
```
┌────────────┐        ┌──────────────┐        ┌──────────┐
│  iOS app   │───────▶│   Backend    │───────▶│  eBay    │
└────────────┘        │  API + DB +  │        │  APIs    │
┌────────────┐        │  image store │        └──────────┘
│  Web app   │───────▶│  on VPS      │
└────────────┘        └──────────────┘
```

### 6.2 Backend
- **Language / framework:** TypeScript + Hono.
- **Database:** Postgres.
- **Image storage:** local filesystem on the VPS, served by nginx.
  Nightly backup (see §7).
- **Deploy:** Docker Compose on the VPS. Services: `api` (Hono),
  `db` (Postgres), `web` (static build served by nginx directly).
- **Secrets:** eBay refresh token encrypted at rest; keys loaded from
  environment / secrets file, never committed.

### 6.3 Category & aspect selection
Manual navigation of eBay's category hierarchy.

- Hierarchical picker — drill-down on iOS, searchable tree on web.
- Category tree fetched from eBay's **Taxonomy API** (`getCategoryTree`),
  cached server-side, refreshed daily.
- "Recently used" shortcut at the top.
- On leaf selection, `getItemAspectsForCategory` populates required +
  recommended aspect inputs inline.

### 6.4 Shared draft schema
Draft stored server-side as a single JSON document. Same schema rendered
by iOS and web.

### 6.5 eBay API routing
**Trading API everywhere** in v1 — single code path for fixed-price and
auctions.

Other eBay APIs we'll touch:
- **Browse API** — similar-sold lookup for pricing help (§5.8).
- **Taxonomy API** — category tree + aspects (§6.3).
- **Account API** — Phase 1.5 when opting into Business Policies.
- **Fulfillment API** — orders, shipping status (Phase 2).

### 6.6 Deployment on the VPS

VPS state (confirmed): Ubuntu 24.04.4 LTS, nginx + certbot + fail2ban
running, `/var/www/projects/<app>/` convention, no Docker yet.

- **Prereqs to install once:** Docker + Docker Compose v2.
- **Project path:** `/var/www/projects/ebay/` (mirrors `inktix`).
- **Hostname:** `ebay.rycsprojects.com`.
  - DNS: A record pointing at the VPS IP — user-managed.
  - TLS: certbot `--nginx -d ebay.rycsprojects.com`, same pattern as
    the existing `inktix.rycsprojects.com` site.
- **nginx config:** new site file at
  `/etc/nginx/sites-available/ebay.rycsprojects.com`, symlinked into
  `sites-enabled/`. Proxies `/api` to the Hono container on
  `127.0.0.1:<port>`, serves `/images/` from a mounted volume, serves
  the static web build for everything else.
- **Exposed ports:** only 80/443. API container binds to localhost.
- **fail2ban:** add a jail for repeated 401s on the API once login is
  in place.
- **Backups:** nightly `pg_dump` + tarball of images dir, shipped to a
  user-configured destination (§7). Destination is a runtime config
  value; user will set this up (VPS provider offering or a local NAS).

---

## 7. Non-functional requirements

- **Offline (iOS):** can draft a listing (including photos) offline;
  upload + publish when the device reconnects.
- **Performance:** first photo-to-draft-saved in under 3s on a good
  connection.
- **Reliability:** idempotency keys on publish; drafts preserved on
  every failure path.
- **Privacy:** EXIF GPS stripped from photos; API keys / tokens never
  logged.
- **Observability:** structured logs + error tracking (Sentry or
  self-hosted equivalent).
- **Backup:** nightly `pg_dump` + image-directory tarball. Destination
  configurable — user will point at their chosen target (VPS
  provider's offering or a local NAS reachable via VPN). The backup
  job itself is part of v1.

---

## 8. Out of scope (v1)
- Multi-variation listings
- Promoted Listings / advertising
- Analytics beyond active/sold
- Other marketplaces
- Multi-user / team features
- True inventory tracking (→ v2)
- CSV bulk import (→ v2)
- In-app shipping label purchase (→ Phase 2.5)
- International shipping (→ v1.5 or later)
- Local pickup shipping option (can be added later)

---

## 9. Phase plan

**Phase 1 — MVP (core selling loop):**
- Backend on VPS + eBay OAuth (one-time user setup)
- iOS: camera → form → publish (fixed-price + auction + Best Offer)
- Web: drafts, edit, publish, bulk publish
- Manual category picker with recently-used shortcut
- Shipping + return profiles with per-listing custom override
- Active / Sold / Ended views (read-only)
- Best Offer Accept / Decline / Counter with per-listing thresholds
- Auction: reserve price, manual relist on end-without-bids
- Pricing help ("recent comparables" lookup)
- Push notifications (Best Offer / auction ending / auction ended /
  item sold)
- Nightly backups to a user-configured off-VPS destination

**Phase 1.5 — Quality-of-life:**
- AI-assisted title + description generation
- AI-assisted category suggestion
- iOS image editing (crop / rotate)
- Push shipping/return profiles up to eBay as real Business Policies
  (once user opts in)
- International shipping support (if needed)

**Phase 2 — Post-sale:**
- Sold-items list with order detail
- Mark-as-shipped + tracking number + auto-send "shipped" message
- Buyer messaging inbox with reply
- Feedback (leave for buyers, view received)

**Phase 2.5 — Post-sale extras:**
- In-app shipping label purchase (eBay labels or EasyPost/Pirate Ship)
- Return request management

**Phase 3 — Growth:**
- True inventory / SKU tracking
- CSV bulk import
- Multi-marketplace cross-listing

---

## 10. Decisions log (complete)

### v0.1 → v0.2
| # | Question | Decision |
|---|---|---|
| 1 | Single user vs multi-user | Single household |
| 2 | Marketplaces | eBay US only |
| 3 | AI description | v1.5 |
| 4 | iOS tech | Native Swift / SwiftUI |
| 5 | Business policies | None yet; app-level profiles in v1 |
| 6 | Auction support | v1 |
| 7 | Edit after publish | End + relist |
| 8 | Hosting | Your VPS |
| 9 | Inventory tracking | v1 = one-offs; v2 = inventory |
| 10 | Bulk import | v1 = single; v2 = CSV |

### v0.2 → v0.3
| # | Question | Decision |
|---|---|---|
| A | Business policies in v1 | Build app-level profiles; push to eBay policies later |
| B | Default auction duration | 7 days |
| C | Reserve price | v1 |
| D | Auto-relist on no-bid | Manual only |
| E | Best Offer default | ON for new fixed-price listings |
| F | Best Offer thresholds | Per-listing, with global defaults |
| G | Post-sale Phase 2 | Orders + mark-shipped + messages + feedback |
| H | eBay API choice | Trading API everywhere |
| I | Backend stack | TypeScript + Hono + Postgres |
| J | Image storage | Local VPS volume |
| K | Deploy | Docker Compose |
| L | Pricing help | v1 |
| M | Push notifications | Best Offer / auction ending / auction ended / sold |
| N | AI assist | v1.5 |
| O | VPS OS | Ubuntu 24.04 LTS |
| P | Reverse proxy | Existing nginx, new site for `ebay.rycsprojects.com` |
| Q | Hostname | `ebay.rycsprojects.com` |
| R | Docker on VPS | Will install |

### v0.3 → v0.4
| # | Question | Decision |
|---|---|---|
| S | Off-VPS backup destination | User-selected at runtime (VPS provider offering or local NAS); backup job itself is in v1 |
| T | Opt into eBay Business Policies | Later (Phase 1.5) |
| U | Shipping starter set | USPS Priority Flat Rate (envelope + S/M/L box) + UPS Ground calculated + Free-shipping USPS Priority. **No local pickup in v1.** |
| V | eBay dev account | User has dev account; will provision sandbox + production app credentials |
| W | iOS distribution | TestFlight (Apple Developer Program $99/yr) |
| X | DNS management | User manages `rycsprojects.com` DNS; will add the `ebay.` A record |

---

## 11. Post-sale workflow (Phase 2 scope, locked)

Phase 2 will build:

- **Order management:** sold-items list with buyer, sold date, amount,
  shipping status; mark-as-shipped with tracking number; auto-send
  "shipped" message to buyer.
- **Buyer messaging inbox:** all buyer messages + questions, reply from
  app, push notifications.
- **Feedback:** one-tap leave-positive for buyers; view received feedback.

Deferred to Phase 2.5:
- In-app shipping label purchase
- Return request management

---

## 12. Acceptance

All open questions are closed. Everything above is the contract for v1.
Anything not in v1 scope lives in one of: Phase 1.5, Phase 2, Phase 2.5,
Phase 3, or out of scope.

**Next artifact:** the **build plan**, which will cover:
- Repo layout (monorepo vs. per-platform; proposing monorepo with
  `/backend`, `/web`, `/ios`, `/infra`)
- Tech stack lock-in (exact framework versions, libraries, CI)
- Development vs. sandbox vs. production environments on eBay
- Milestones and a first implementable slice — likely
  **"end-to-end OAuth + publish a dummy fixed-price listing to eBay
  sandbox from a minimal web form"** — before we build the polished
  iOS camera flow, to de-risk the eBay integration first.
- Account setup checklist (eBay developer app keys, Apple Developer
  Program enrollment, DNS record, VPS Docker install).

Say the word and I'll draft the build plan.
