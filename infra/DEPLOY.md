# Deploy runbook — ebay.rycsprojects.com

Operational reference for the production stack on the VPS. Pair-read
with `infra/docker-compose.yml`, `infra/Dockerfile.api`, and
`infra/nginx/ebay.rycsprojects.com.conf`.

The first-time setup happened on **2026-04-26** — see git log around
commit `92c6542` (M0 step 6.3) for the canonical bootstrap sequence.
This doc covers steady-state operations from that point on.

---

## Topology

```
public internet
       │
       ▼ (443/80)
┌────────────────────────────────────────────────┐
│  VPS — Ubuntu 24.04, 135.148.61.99             │
│                                                │
│  host nginx ── TLS terminate, serve static,    │
│                proxy /api/* → 127.0.0.1:3001   │
│       │                                        │
│       │ /var/www/projects/ebay/web/out/        │
│       │ (static SPA)                           │
│       │                                        │
│       └──── /api/* ─────► docker compose       │
│                            ┌──────────┐        │
│                            │   api    │ :3001  │
│                            └────┬─────┘        │
│                                 │ ebay-internal│
│                            ┌────▼─────┐        │
│                            │   db     │ :5432  │
│                            └──────────┘        │
└────────────────────────────────────────────────┘
```

**Key paths:**

| What              | Where                                            |
| ----------------- | ------------------------------------------------ |
| Repo checkout     | `/var/www/projects/ebay`                         |
| Static web build  | `/var/www/projects/ebay/web/out`                 |
| Compose stack     | `/var/www/projects/ebay/infra`                   |
| Secrets file      | `/var/www/projects/ebay/infra/.env` (chmod 600)  |
| nginx site config | `/etc/nginx/sites-enabled/ebay.rycsprojects.com` |
| TLS cert          | `/etc/letsencrypt/live/ebay.rycsprojects.com/`   |

---

## Routine deploy (every release after the first)

Run from your local machine, then SSH in:

```bash
# Local — push the release commit
git push origin main
```

Then on the VPS:

```bash
cd /var/www/projects/ebay

# Pull the new code
git pull origin main

# Refresh dependencies (skips if nothing changed)
pnpm install --frozen-lockfile

# Rebuild static web → /var/www/projects/ebay/web/out
pnpm --filter @ebay/web run build

# Rebuild api image and restart api+db (db only restarts if its
# image changed; data persists in the named volume)
cd infra
docker compose up -d --build

# Smoke test
curl -s https://ebay.rycsprojects.com/api/health | jq .
```

If the smoke test returns a fresh `HealthResponse` with the new
`version` (or expected uptime drop after the api restart), the deploy
landed. If it returns the previous version, the api container didn't
restart — `docker compose ps` will show why.

---

## Operations

### Tail logs

```bash
cd /var/www/projects/ebay/infra

docker compose logs -f api          # tail api only
docker compose logs -f db           # tail db only
docker compose logs -f --tail 100   # both, last 100 lines + follow
```

### Container status

```bash
docker compose ps
```

`db` should show `(healthy)`. `api` should show `Up <duration>`. If
either says `Restarting`, tail the logs immediately to find why.

### Restart api without rebuilding

Use after toggling an env var in `infra/.env` or to recover from a
hung process:

```bash
cd /var/www/projects/ebay/infra
docker compose restart api
```

### Postgres shell

```bash
cd /var/www/projects/ebay/infra
docker compose exec db psql -U ebay -d ebay
```

### nginx reload after editing the site config

```bash
sudo nginx -t                       # validate syntax first
sudo systemctl reload nginx         # apply
```

If `nginx -t` fails, do **not** reload — fix the syntax first or you
may break the existing inktix/isa/dtm sites that share the same nginx
process.

---

## Secrets & config

`infra/.env` is the only secrets file. It's `chmod 600` (only `ryc`
can read), gitignored, and committed nowhere.

Documented in `infra/.env.example`. To add a new variable:

1. Add the line to `infra/.env.example` (committed, with a comment
   and any generator recipe).
2. Add the line to `infra/.env` on the VPS with the real value.
3. Reference the var in `infra/docker-compose.yml` under the api
   service's `environment:` block (or `env_file:` already pulls it
   in transparently).
4. `docker compose up -d` to apply.

### Rotating `POSTGRES_PASSWORD`

Postgres reads `POSTGRES_PASSWORD` only on first init of the volume.
Changing it later requires a manual `ALTER USER` to keep the volume:

```bash
cd /var/www/projects/ebay/infra
NEW_PW=$(openssl rand -base64 32 | tr -d '/+=' | cut -c1-32)

# Apply inside the running db container
docker compose exec db psql -U ebay -d ebay \
  -c "ALTER USER ebay WITH PASSWORD '${NEW_PW}';"

# Update infra/.env to match
sed -i.bak "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=${NEW_PW}|" .env
rm .env.bak

# Restart api so it picks up the new DATABASE_URL
docker compose restart api
```

Save the new value to your password manager.

### Rotating `EBAY_ACCOUNT_DELETION_VERIFICATION_TOKEN`

This value is shared with eBay. Rotation = update both sides:

1. Generate new token: `openssl rand -base64 60 | tr -d '/+=' | cut -c1-64`
2. Update `infra/.env` on the VPS with the new value.
3. `docker compose restart api`.
4. In the eBay developer console (Application Keys → Notifications
   → Marketplace Account Deletion), update the verification token
   field with the new value and re-save. eBay will re-verify by
   sending a fresh challenge to our endpoint.

---

## Rollback

If a release breaks production:

```bash
cd /var/www/projects/ebay

# Find the last-known-good commit
git log --oneline -10

# Roll the working tree back (does NOT touch origin/main)
git checkout <good-sha>

# Rebuild and restart
pnpm install --frozen-lockfile
pnpm --filter @ebay/web run build
cd infra && docker compose up -d --build

# Smoke test
curl -s https://ebay.rycsprojects.com/api/health | jq .
```

To return to the latest after diagnosing/fixing:

```bash
cd /var/www/projects/ebay
git checkout main && git pull
# … same rebuild steps
```

The Postgres volume (`ebay_db-data`) is **not** touched by rollback.
If a release introduced a destructive migration, rollback alone
won't undo schema changes — restore the relevant table from a
nightly `pg_dump` backup (M0 doesn't have the backup job yet —
landing in v1 per `SPEC.md` §7).

---

## TLS cert renewal

certbot installed a systemd timer for auto-renewal at install time.
No action needed under normal operation.

```bash
# Inspect the auto-renewal timer
sudo systemctl status certbot.timer

# Dry-run a renewal (safe; no rate-limit impact)
sudo certbot renew --dry-run

# Force renewal NOW (only if you know why — counts against
# Let's Encrypt's rate limits)
sudo certbot renew --force-renewal --cert-name ebay.rycsprojects.com
```

Certificate expiry is in `sudo certbot certificates`. As of
2026-04-26 the cert expires 2026-07-25.

---

## Troubleshooting

### `curl /api/health` returns `502 Bad Gateway`

The api container isn't responding. Check:

```bash
cd /var/www/projects/ebay/infra
docker compose ps
docker compose logs --tail 50 api
```

Most common causes:

- Container crashed on startup (env var missing, bad code) — logs
  will show it.
- Container is `Up` but Hono is hung — `docker compose restart api`.
- nginx upstream pointing at the wrong port (sanity-check
  `infra/nginx/ebay.rycsprojects.com.conf` line for `proxy_pass
http://127.0.0.1:3001`).

### `curl /api/health` returns wrong `version` after a deploy

The api container didn't actually rebuild from the new image.
`docker compose up -d --build` should rebuild, but Docker's layer
cache occasionally gets confused. Force-rebuild:

```bash
cd /var/www/projects/ebay/infra
docker compose build --no-cache api
docker compose up -d
```

### `curl /api/ebay/account-deletion?challenge_code=test` returns `503`

Env vars not reaching the api container. Check:

```bash
cd /var/www/projects/ebay/infra
cat .env                                # verify both vars are set
docker compose exec api env | grep EBAY # verify they reached the container
```

If the file is right but the container env is wrong, `docker compose
up -d` (without `--build`) re-loads env vars without rebuilding.

### Browser shows `DNS_PROBE_FINISHED_NXDOMAIN`

Local-side DNS issue, not a server problem. From the affected
machine:

```bash
dig +short ebay.rycsprojects.com @1.1.1.1   # bypass local resolver
```

If `@1.1.1.1` resolves but the system default doesn't, your local
DNS resolver is broken. Set the Mac's DNS to `1.1.1.1` / `1.0.0.1`
in System Settings → Network → DNS, then flush:

```bash
sudo dscacheutil -flushcache && sudo killall -HUP mDNSResponder
```

### certbot `No such authorization` error

Stale ACME challenge state. Fix:

```bash
sudo certbot delete --cert-name ebay.rycsprojects.com
sudo rm -rf /var/lib/letsencrypt/*
sudo certbot --nginx -d ebay.rycsprojects.com
```

The `--cert-name` arg keeps the other rycsprojects.com certs
(inktix, isa, dtm) intact — only ebay's stale state is wiped.

### `nginx -t` fails after editing the site config

Don't `systemctl reload` — that would propagate the bad config to
the whole nginx process and break the other sites. Fix the syntax
first:

```bash
# Diff against the canonical version in git
diff /etc/nginx/sites-enabled/ebay.rycsprojects.com \
     /var/www/projects/ebay/infra/nginx/ebay.rycsprojects.com.conf
```

Likely an unintended edit to the certbot-managed lines (cert paths
or the 443 server block). If lost, the canonical pre-certbot
version is in the repo; reapply, then re-run certbot to add 443
back.

---

## First-time setup (reference only)

Already done 2026-04-26. The full sequence is:

1. DNS A record `ebay.rycsprojects.com → 135.148.61.99` (at registrar).
2. `sudo mkdir -p /var/www/projects/ebay && sudo chown -R $USER:$USER /var/www/projects/ebay`
3. `git clone https://github.com/RycBrownrigg/ebay.git /var/www/projects/ebay`
4. nvm + Node 22 + corepack pnpm 9.15.0.
5. `pnpm install --frozen-lockfile && pnpm --filter @ebay/web run build`.
6. Create `infra/.env` from `.env.example`, populate, `chmod 600`.
7. `sudo cp infra/nginx/ebay.rycsprojects.com.conf /etc/nginx/sites-available/`
   `sudo ln -s /etc/nginx/sites-available/ebay.rycsprojects.com /etc/nginx/sites-enabled/`
   `sudo nginx -t && sudo systemctl reload nginx`.
8. `cd infra && docker compose up -d --build`.
9. `sudo certbot --nginx -d ebay.rycsprojects.com` → option 2 (Redirect).
10. Subscribe to MARKETPLACE_ACCOUNT_DELETION in eBay developer
    console (Application Keys → Notifications) with our endpoint URL
    and verification token from `infra/.env`.

Reproducing on another VPS would follow the same sequence with the
host-specific values (IP, hostname) substituted.
