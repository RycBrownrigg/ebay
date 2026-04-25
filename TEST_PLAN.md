# eBay Seller App — Test Plan (v0.2, locked)

> Companion to `SPEC.md` (v0.4) and `BUILD_PLAN.md`. Defines testing
> strategy, tools, per-milestone acceptance tests, and manual
> verification checklists for things that can't be automated
> (camera, push notifications, real eBay).

## Changelog
- **v0.2** — §10 questions answered and baked in. Added §1a
  ("Non-negotiable test discipline") — tests and code ship together;
  unit tests run on every push. Dedicated test sandbox seller confirmed.
  Sentry SaaS confirmed for both dev and production (with GlitchTip as
  the lighter self-hosted alternative if SaaS ever becomes insufficient).
  CI strategy in §6 tightened so unit tests gate every push.
- v0.1 — Initial draft.

---

## 1. Testing philosophy

This is a two-person household tool, not a public SaaS. We test enough
to:

1. **Not break things on every change.** Solid unit + integration tests
   on the backend, fewer but high-value E2E tests on the web, minimal
   but real tests on iOS.
2. **Catch eBay integration regressions.** A small, deterministic
   contract test suite runs against the eBay **sandbox** before every
   release.
3. **Verify real-device behavior manually** when automation is more
   expensive than the test itself (camera, push notifications, the
   golden-path production publish).

What we explicitly **don't** do:
- Chase 100% code coverage.
- Write UI snapshot tests that break on every pixel change.
- Mock eBay heavily — our tests would validate our mocks, not eBay.
  Real sandbox calls are cheap.
- Load testing. Two users will never stress this.

## 1a. Non-negotiable test discipline

Two hard rules for this project (and any follow-up work):

1. **Tests ship with the code they cover.** Every change that adds or
   modifies logic includes the unit tests for that logic in the same
   commit / PR. Acceptance tests for a milestone land with the feature
   work, not as a follow-up task. A diff without tests is considered
   incomplete.
2. **Unit tests run on every build cycle.** Locally, Vitest runs in
   watch mode during dev. In CI, unit tests run on every push to any
   branch, and a failing unit test blocks merge. (Heavier tests —
   integration, sandbox contract — can gate merge-to-main instead. See
   §6.)

When a bug escapes to production, write the failing test **before**
the fix (regression-first).

---

## 2. Tools by layer

| Layer | Unit / Integration | E2E | Manual |
|---|---|---|---|
| Backend | Vitest + Testcontainers (Postgres) | — | — |
| Backend ↔ eBay | Vitest hitting sandbox (tagged `@sandbox`) | — | Pre-release prod smoke |
| Web | Vitest + React Testing Library | Playwright | — |
| iOS | XCTest | XCUITest (limited) | Device checklist (§7) |

**Why Vitest over Jest:** faster, ESM-native, better TS. Matches the
Hono + Next.js stacks cleanly.

**Why Testcontainers for Postgres:** real Postgres, no in-memory
impostor. Each test suite gets a fresh schema. No test pollution.

**Why Playwright over Cypress:** faster, multi-browser, better debug
tooling. We'll only write ~10 E2E tests — it's not a big investment
either way.

---

## 3. Test taxonomy

### 3.1 Unit tests (backend)
Pure functions, no I/O. Fast. Run on every file save during dev.

Coverage targets:
- **Trading API XML builders** — golden-file tests: given a draft
  record, assert the XML payload matches an expected file byte-for-byte
  (modulo known-variable fields like UUIDs and timestamps).
- **Trading API response parsers** — feed in captured sandbox responses
  (sanitized fixtures), assert the parsed result has the right shape
  and error-mapped values.
- **Zod schemas** — valid / invalid cases for every draft state
  transition.
- **Shipping profile → eBay field mapping** — flat, calculated, free,
  each maps to the correct `ShippingServiceOptions` / `ShippingDetails`
  XML subset.
- **Category aspect requirement resolver** — given category aspects
  response + user-supplied aspects, assert which aspects are missing.
- **Best Offer auto-decision** — given offer amount + thresholds,
  assert accept / decline / surface-to-inbox.
- **Token encryption** — seal / open round-trip; rejects on wrong key;
  rejects on tampered ciphertext.
- **Idempotency** — second publish with same key returns cached
  response, doesn't re-call eBay.

### 3.2 Integration tests (backend)
Hono + real Postgres via Testcontainers. No external HTTP calls.
Test HTTP handlers against a fresh DB per suite.

Coverage targets:
- Auth: register + login + session cookie + logout + session expiry.
- Draft CRUD: create → patch → get → delete, autosave semantics,
  stale-write detection.
- Image upload pipeline: multipart upload → sharp downscale → EXIF
  strip assertion → record in DB → served via static route.
- Shipping + return profile CRUD.
- Category cache: first request populates, second hits cache, daily
  refresh invalidates.
- OAuth callback: simulated eBay callback with a fake code,
  mock-exchange step, refresh token sealed and stored.
- Token refresh: expired access token triggers refresh, stores new
  cache.

### 3.3 Contract tests (backend ↔ eBay sandbox)
Tagged `@sandbox`. Runs in CI only on merge to main and before
releases — not every PR (keeps the main sandbox account clean).

**Sandbox discipline:**
- Dedicated **test sandbox seller account**, separate from the
  sandbox seller used for manual exploration.
- Every test that creates a listing uses a **title prefix** like
  `[TEST-<uuid>-]` so leftover listings are identifiable.
- A **teardown job** runs after each test suite: `GetMyeBaySelling`
  → end every item with the `[TEST-]` prefix. Belt-and-suspenders
  to prevent drift.
- Auctions use the shortest duration (1 day) for tests that need them
  to end; or `EndItem` immediately after creation for tests that
  don't need resolution.

Coverage targets:
- `AddItem` — fixed-price, auction, auction+BIN, auction-with-reserve.
  Golden path.
- `AddItem` error: missing required aspect → specific error code parsed.
- `AddItem` error: invalid category → specific error code parsed.
- `ReviseItem` — not used in v1 (we end+relist), so skip.
- `RelistItem` — relist a previously-ended item.
- `EndItem` — end with reason `NotAvailable`.
- `GetItem` — status polling round-trip.
- `GetMyeBaySelling` — fetch active listings.
- `RespondToBestOffer` — accept, decline, counter.
- Image URL → EPS ingest: publish with externally-hosted URLs, verify
  eBay returns EPS URLs.
- OAuth refresh token: refresh, use new access token against a cheap
  call (`GeteBayOfficialTime`).

### 3.4 E2E tests (web, Playwright)
Run against a local backend + local Next.js dev server + eBay sandbox.
Slow; ~10 tests total. Run in CI on merge to main.

Coverage targets:
- **Happy path publish:** log in → create draft → pick category → fill
  required aspects → upload 2 images → pick shipping profile → publish
  → see item in "Active" → open eBay sandbox URL in a new page, verify.
- **Validation surfaces:** submit a draft with no title → see inline
  error. Submit with missing required aspect → see eBay error
  translated.
- **Autosave:** fill fields, refresh page, verify fields still there.
- **End + relist:** publish, end it, relist, verify a new eBay item
  ID is stored.
- **Best Offer inbox:** publish with Best Offer on, (simulated) offer
  received, accept → verify state.
- **Draft list sort + filter.**
- **Shipping profile CRUD.**
- **Category picker search.**
- **eBay OAuth first-time flow:** redirect to sandbox → consent →
  callback → status shows connected.

### 3.5 iOS tests
- **Unit (XCTest):** form validation, offline queue logic, upload
  retry backoff, SwiftData model round-trip.
- **UI (XCUITest):** 2–3 tests max — the camera flow is better tested
  on-device. Focus UI tests on non-camera screens: login, draft list,
  form input.
- **Manual checklist:** camera + push + real-device behaviors. See §7.

---

## 4. Per-milestone acceptance tests

Each milestone's acceptance criteria from `BUILD_PLAN.md` §7, expanded
into concrete test cases. These are the gates for "milestone done."

### M0 — Foundation
| # | Case | Type |
|---|---|---|
| M0.1 | Web login page renders; submitting returns 401 for bad creds | E2E |
| M0.2 | `/api/health` returns 200 with build hash | Integration |
| M0.3 | iOS simulator hits `/api/health` and renders response | Manual |
| M0.4 | `https://ebay.rycsprojects.com` serves the web app over TLS | Manual |
| M0.5 | `docker compose up` on a clean VPS brings the stack up in < 60s | Manual |
| M0.6 | GitHub Actions runs typecheck + unit tests on PR | CI check |

### M1 — eBay OAuth + first publish ⭐
| # | Case | Type |
|---|---|---|
| M1.1 | OAuth start endpoint redirects to eBay sandbox consent URL | Integration |
| M1.2 | OAuth callback with valid code stores sealed refresh token | Integration |
| M1.3 | OAuth callback with invalid code returns a readable error | Integration |
| M1.4 | Access token cache hit skips refresh call | Unit |
| M1.5 | Access token expired triggers refresh, new cache stored | Integration |
| M1.6 | `AddItem` XML builder produces exact expected output for minimal fixed-price draft | Unit (golden) |
| M1.7 | `AddItem` sandbox call with 4-field draft creates a real sandbox listing | Contract (`@sandbox`) |
| M1.8 | Publish with bad category surfaces the eBay error | Contract (`@sandbox`) |
| M1.9 | Publish stores `ebay_item_id` on the draft | Integration |
| M1.10 | Idempotent publish: same key → same item_id, no second listing on eBay | Contract (`@sandbox`) |
| M1.11 | From web form, real human click creates a real sandbox listing | Manual |

### M2 — Full listing creation on web (fixed-price)
| # | Case | Type |
|---|---|---|
| M2.1 | Category tree endpoint returns cached result on second call | Integration |
| M2.2 | Category aspects endpoint returns normalized required + recommended | Integration |
| M2.3 | Image upload: HEIC → JPEG, ≤ 1600px, EXIF GPS removed | Integration |
| M2.4 | Image upload rejects PDF / unsupported MIME types | Integration |
| M2.5 | Image reorder persists | Integration |
| M2.6 | Draft autosave debounces writes to 500ms | Unit |
| M2.7 | Missing required aspect → error banner identifies which aspect | E2E |
| M2.8 | Publish with 3 images: listing on sandbox has 3 images in correct order | Contract (`@sandbox`) |
| M2.9 | Shipping profile CRUD from UI | E2E |
| M2.10 | First-run seeding creates the 6 starter shipping profiles and 2 return profiles | Integration |
| M2.11 | Per-listing shipping override does not mutate the profile | Integration |
| M2.12 | End-and-relist creates a new draft pre-filled from the ended listing | Integration |
| M2.13 | End-and-relist against sandbox: old item ends, new item goes live | Contract (`@sandbox`) |

### M3 — Auctions + Best Offer + production switch
| # | Case | Type |
|---|---|---|
| M3.1 | Auction XML builder: starting bid + duration + reserve correctly placed | Unit (golden) |
| M3.2 | Auction + BIN XML: both prices present | Unit (golden) |
| M3.3 | Auction without reserve: no `ReservePrice` element in XML | Unit (golden) |
| M3.4 | Publish auction with reserve to sandbox succeeds | Contract (`@sandbox`) |
| M3.5 | Best Offer auto-accept: offer ≥ threshold → accepted response sent | Unit |
| M3.6 | Best Offer auto-decline: offer ≤ threshold → declined response sent | Unit |
| M3.7 | Best Offer mid-range: surfaces in inbox, no auto-response | Unit |
| M3.8 | `RespondToBestOffer` sandbox call: accept | Contract (`@sandbox`) |
| M3.9 | Listing-status polling updates draft status from Active → Sold | Integration |
| M3.10 | Production credential smoke: publish a $0.99 "test sale" listing, end immediately | Manual |

### M4 — iOS app
| # | Case | Type |
|---|---|---|
| M4.1 | Login against backend from iOS, session persists across app restart | XCUITest |
| M4.2 | Camera capture flow: 3 photos captured, all appear in draft | Manual (device) |
| M4.3 | Form validation matches backend Zod rules | Unit |
| M4.4 | Offline: draft saved locally, images queued, upload fires on reconnect | Manual (device + Airplane Mode) |
| M4.5 | Publish from iOS produces the same sandbox listing as web does | Contract + Manual |
| M4.6 | APNs token registered with backend on first launch after login | Integration (backend side) |
| M4.7 | TestFlight build installable on both household devices | Manual |

### M5 — Lifecycle, notifications, polish
| # | Case | Type |
|---|---|---|
| M5.1 | Active / Sold / Ended views each query the correct subset | Integration |
| M5.2 | Best Offer received → push notification lands on device | Manual (device) |
| M5.3 | Auction ending-in-1-hour → push notification | Manual (device) |
| M5.4 | Auction ended → push notification | Manual (device + short-duration auction) |
| M5.5 | Item sold → push notification | Manual (device + simulated buyer on sandbox) |
| M5.6 | Pricing comparables: Browse API returns ≥ 1 result for a common query | Contract (`@sandbox`) |
| M5.7 | Nightly backup job produces `pg_dump` + images tarball at the configured destination | Manual (run once, verify) |
| M5.8 | Restore-from-backup walkthrough works on a clean VPS | Manual (annual rehearsal) |

### M6 — Hardening + handoff
| # | Case | Type |
|---|---|---|
| M6.1 | Sentry captures a deliberately thrown error on backend, web, and iOS | Manual |
| M6.2 | fail2ban jail: 10 bad logins in 60s → IP banned for 10 min | Manual |
| M6.3 | README dev setup works on a fresh machine | Manual |
| M6.4 | Runbook covers: rotate eBay token, rotate APNs key, restore from backup, add iOS tester | Docs review |

---

## 5. Test data management

- **Unit test fixtures** live in `backend/src/ebay/__fixtures__/` —
  canonical eBay XML request/response samples, sanitized of real IDs.
- **Sandbox seller account** for tests: separate from the seller used
  for manual exploration. Credentials in GitHub Actions secrets as
  `EBAY_SANDBOX_TEST_*`.
- **Sandbox cleanup** runs after every `@sandbox` test suite: end any
  listing with the `[TEST-]` title prefix. Also runs as a scheduled
  daily GitHub Action to catch drift from failed test teardowns.
- **Seeded data** for E2E: test runs against a fresh DB via
  Testcontainers, then seeds a known user + profiles via a helper
  (`backend/test-utils/seed.ts`).

---

## 6. CI strategy

Per §1a, unit tests are the required gate on every push — not just on
merge.

| Trigger | Runs | Gates |
|---|---|---|
| Push to any branch | Typecheck + lint + **unit tests (all layers)** | **Blocks merge if any fail** |
| PR to main | Above + integration tests (Testcontainers Postgres) + E2E tests (local stack, OAuth / sandbox calls stubbed) | Blocks merge |
| Merge to main | Above + `@sandbox` contract tests against real eBay sandbox | Alerts on failure; rollback or hotfix |
| Manual release trigger | Above + production-publish smoke test checklist (§7.2) | Human sign-off |
| Nightly | Sandbox cleanup job (ends leftover `[TEST-]` listings) | — |

Rationale for keeping `@sandbox` tests off PR-level runs: eBay sandbox
rate limits + occasional flakiness would make PR flakes frustrating.
Merge-to-main is a strong enough gate. Unit tests still run on every
push and block merge, so PRs never sit in a "untested" state.

---

## 7. Manual test checklists

### 7.1 iOS device checklist (per TestFlight build)

Run on a real iPhone (not the simulator). Both your device and your
wife's if possible.

- [ ] Launch app, log in with email + password
- [ ] Tap **+ New listing**, camera opens within 1s
- [ ] Capture 4 photos, each preview appears
- [ ] Swap to photo library, pick 1 image, import works
- [ ] Fill all required fields, tap Save Draft — draft appears in
  draft list within 2s
- [ ] Enable Airplane Mode, tap + New listing, take 2 photos, fill
  fields, tap Save Draft — draft appears with "Pending upload" badge
- [ ] Disable Airplane Mode — "Pending upload" clears within 10s
- [ ] Open a draft on the web while iOS app is closed, edit a field,
  save; open the iOS app, pull to refresh draft list, verify edit
  appears
- [ ] Publish a draft → listing appears in Active view within 5s
- [ ] Receive a simulated Best Offer on a fixed-price listing — push
  notification arrives
- [ ] Tap notification → opens listing detail with offer visible
- [ ] Tap Accept → offer state updates
- [ ] Publish a 1-day auction with reserve → listing appears
- [ ] Wait for auction to end without bids (or end manually) → push
  notification arrives
- [ ] Tap "Relist" → new draft appears pre-filled
- [ ] Kill the app during an image upload → re-open → upload resumes

### 7.2 Pre-release production smoke test

Before every production deploy, run this on a **real seller account**:

- [ ] Back up the database (just in case)
- [ ] Create a $0.99 listing of a nothing-item (category: Everything
  Else → Everything Else → Weird Stuff; or similar) via the app
- [ ] Verify on eBay.com that the listing is live and the images are
  correct
- [ ] End the listing via the app
- [ ] Verify on eBay.com that it's ended
- [ ] Check Sentry / logs for any errors during the above

This takes ~5 minutes and catches credential mix-ups, XML regressions,
and EPS ingest breakage. Non-negotiable before each production
release.

### 7.3 Pre-release web + backend smoke test

- [ ] Log in on web on a clean browser profile
- [ ] Connect eBay via OAuth (if not already); verify status shows
  connected
- [ ] Create a draft, add 2 images, publish to sandbox
- [ ] End + relist that draft on sandbox
- [ ] Edit a shipping profile, verify the change
- [ ] Delete a draft
- [ ] Log out; session cookie cleared

### 7.4 Quarterly chaos checklist

Run once a quarter to catch bit-rot:

- [ ] Rotate the eBay refresh token (revoke + re-OAuth), verify
  subsequent listings publish
- [ ] Rotate the APNs `.p8` key, verify push still arrives
- [ ] Restore from last night's backup into a scratch VPS / local
  Postgres, verify data integrity
- [ ] Renew TLS cert via certbot (automated but verify)

---

## 8. Coverage targets (loose)

No hard coverage thresholds. Directional goals:

| Area | Target |
|---|---|
| Trading API builders + parsers | ≥ 90% — these are pure, worth covering thoroughly |
| Backend route handlers | ≥ 70% happy path + key errors |
| Web components | ≥ 40% — focus on forms, skip layout |
| iOS | ≥ 40% on non-UI logic; UI mostly manual |

If a bug escapes to production, **add a test that catches it before
fixing it** — this is the cheapest way to grow the test suite
meaningfully.

---

## 9. Tests not yet scoped (revisit per phase)

- **Phase 1.5:** AI description generation — test the prompt + output
  shape against a fixture model response; the real LLM call is a
  contract test.
- **Phase 2:** post-sale flows — add contract tests for
  `GetOrders`, `CompleteSale` (mark shipped), `GetMyMessages`, and
  feedback APIs.
- **Phase 2.5:** shipping labels — carrier API contract tests depend
  on which provider (eBay vs EasyPost vs Pirate Ship).
- **Phase 3:** bulk CSV import — import-round-trip golden tests.

---

## 10. Decisions (closed)

| # | Question | Decision |
|---|---|---|
| 1 | Sandbox seller account | **Dedicated test sandbox seller**, separate from the exploration sandbox. Credentials live in CI as `EBAY_SANDBOX_TEST_*`. |
| 2 | Sentry: SaaS or self-hosted on the VPS | **SaaS (free tier) for both dev and production.** Self-hosted Sentry is an 8GB+ RAM beast (Kafka + Redis + ClickHouse + Postgres) — wildly overkill for a 2-user app. If the SaaS free tier ever becomes insufficient or a data-residency concern arises, migrate to **GlitchTip** (Sentry-wire-compatible, ~1GB RAM) on the VPS rather than self-hosted Sentry. |
| 3 | When do tests get written | **With the code, every time.** See §1a — tests and code land in the same change; unit tests run on every push. |

---

## 11. Sentry setup plan

Quick concrete steps for Q2 above:

- Create one Sentry org, three projects: `ebay-backend`, `ebay-web`,
  `ebay-ios`.
- DSNs go into env vars: `SENTRY_DSN_BACKEND`, `NEXT_PUBLIC_SENTRY_DSN`,
  and the iOS config file.
- Same Sentry org for dev and production; use Sentry's **environment**
  tag (`dev` / `production`) to separate them. No need for separate orgs
  or projects per environment.
- Source maps uploaded from CI on production builds so stack traces
  are readable.
- Release tracking: tag every production deploy with the git SHA.
- Alert rules (start minimal): email on any new issue in `production`
  environment; weekly digest of non-production.

Revisit annually: if SaaS quota is ever exceeded or a privacy concern
arises, stand up GlitchTip on the VPS as an additional compose service
and repoint DSNs.
