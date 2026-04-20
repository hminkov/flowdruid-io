# DEPLOY.md

Runbook for the first production deploy of Flowdruid to a VPS.
Lives in git so every deploy follows the same steps.

> **Before you start.** Phase A of the implementation plan must be
> green: tests pass in CI, migrations exist, structured logging and
> Sentry are wired. See `flowdruid-implementation-plan.md` Part D for
> the full prep list (that file is local-only; ask the maintainer if
> you don't have it).

---

## 0. Pre-flight on the dev machine

- [ ] `pnpm -r build` is clean.
- [ ] `pnpm -r test` passes.
- [ ] Bump `apps/api/package.json` and `apps/web/package.json` version
      if this is a re-deploy (the sidebar version footer reads from the
      running API's `process.env.npm_package_version`).
- [ ] Tag and push: `git tag v0.1.0 && git push --tags`.

## 1. Provision the VPS

- [ ] Hetzner CX22 (€4/mo) or equivalent DigitalOcean basic droplet —
      Ubuntu 24.04 LTS, swap enabled, SSH key-only login.
- [ ] `ufw allow 22/tcp 80/tcp 443/tcp` — everything else closed.
- [ ] `apt update && apt install -y docker.io docker-compose-plugin git`.
- [ ] `useradd -m -s /bin/bash flowdruid && usermod -aG docker flowdruid`.
- [ ] `sudo -iu flowdruid` — rest of the steps run as the app user.

## 2. Clone + env

- [ ] `git clone <repo> && cd flowdruid-io`.
- [ ] `cp apps/api/.env.example .env.prod`.
- [ ] Fill `.env.prod` with **fresh** secrets:

    ```bash
    JWT_SECRET=$(openssl rand -hex 48)
    REFRESH_TOKEN_SECRET=$(openssl rand -hex 48)
    ENCRYPTION_KEY=$(openssl rand -hex 32)
    POSTGRES_PASSWORD=$(openssl rand -hex 24)
    DATABASE_URL=postgresql://flowdruid:${POSTGRES_PASSWORD}@postgres:5432/flowdruid
    REDIS_URL=redis://redis:6379
    FRONTEND_URL=https://<your-domain>
    NODE_ENV=production
    SENTRY_DSN=<api-dsn-if-using-sentry>
    VITE_API_URL=https://<your-domain>
    VITE_SENTRY_DSN=<spa-dsn-if-using-sentry>
    VITE_APP_BRAND=<your-brand>
    VITE_APP_EMAIL_DOMAIN=<your-domain>
    ```

- [ ] **Never** commit `.env.prod`. Confirm it's in `.gitignore`.
- [ ] `ENCRYPTION_KEY` is load-bearing: once tokens are encrypted with
      it and saved to `SlackConfig` / `JiraConfig`, changing the key
      invalidates every integration token silently. If you ever need
      to rotate, reconnect Slack + Jira from scratch afterwards.

## 3. DNS + TLS

- [ ] `A` record: `<your-domain>` → VPS IP.
- [ ] Wait for propagation (`dig +short <your-domain>` shows VPS IP).
- [ ] Run certbot for the initial cert. The prod compose file expects
      certs at `/etc/letsencrypt/live/<domain>/fullchain.pem` +
      `privkey.pem`.
- [ ] Add cron: `docker compose exec certbot certbot renew --quiet`
      twice daily (standard Certbot recommendation).

## 4. Database bring-up

- [ ] `docker compose -f docker-compose.prod.yml up -d postgres redis`.
- [ ] Wait for `docker compose -f docker-compose.prod.yml exec postgres pg_isready`.
- [ ] Apply migrations:

    ```bash
    docker compose -f docker-compose.prod.yml run --rm api \
      pnpm --filter @flowdruid/api exec prisma migrate deploy
    ```

- [ ] Seed only if this is a fresh customer install — **never on a
      reploy**:

    ```bash
    docker compose -f docker-compose.prod.yml run --rm api \
      pnpm --filter @flowdruid/api exec tsx prisma/seed.ts
    ```

- [ ] If the seed ran, **immediately rotate the default password** on
      the admin account (`Password123!` is seeded for all fictional
      users and is not safe for production).

## 5. App bring-up

- [ ] `docker compose -f docker-compose.prod.yml up -d api web nginx`.
- [ ] `docker compose -f docker-compose.prod.yml logs -f api` — watch
      for `API server ready` with the expected port + version.
- [ ] Confirm SSE works through nginx: in one browser tab open the
      inbox, in another trigger a cover request. Inbox badge should
      update within ~1 s. If it doesn't:
      - Check nginx has `proxy_buffering off` and `proxy_read_timeout
        3600s` on the `/api/events` location.
      - Check the API log shows a `GET /api/events 200` that stays
        open (not 200 + close).

## 6. Smoke tests

- [ ] `curl https://<domain>/health` → `{"status":"ok","version":"…"}`.
- [ ] Login flow works.
- [ ] Create a ticket, drag to DONE, reload — state persisted.
- [ ] Request a leave, approve as admin — requester's availability
      flips to `ON_LEAVE` if the leave starts today.
- [ ] `/admin/audit` shows today's actions.
- [ ] Deliberately trigger a 500 (e.g. drop a tRPC procedure input
      mid-request) and confirm it lands in Sentry.

## 7. Backups

- [ ] Add cron on the VPS (as root or via `crontab -e`):

    ```
    0 3 * * * docker exec flowdruid-postgres-1 \
      pg_dump -U flowdruid flowdruid \
      | gzip > /var/backups/flowdruid/$(date +\%Y-\%m-\%d).sql.gz \
      && find /var/backups/flowdruid -mtime +14 -delete
    ```

- [ ] Weekly rsync to off-host storage (S3, Backblaze B2, or another
      VPS). Without off-host copies, VPS disk loss = total data loss.

## 8. Monitoring

- [ ] UptimeRobot (or similar) pinging `/health` every 5 min.
- [ ] Sentry project receiving events.
- [ ] Optional: `pm2` / `systemd` / docker-compose `restart: unless-stopped`
      — all three are fine; docker-compose `restart: unless-stopped` is
      already set in `docker-compose.prod.yml`.

## 9. Post-deploy hygiene

- [ ] Rotate any credentials that were pasted in chat / screen-shared
      during the deploy.
- [ ] Create the first real admin account and deactivate the fictional
      seed accounts if they were ever created.
- [ ] Document the VPS IP, deploy user, backup location, and cert
      expiry date in your team's runbook.

---

## Redeploy (minor)

```bash
ssh flowdruid@<vps>
cd flowdruid-io
git pull
pnpm -r install
pnpm -r build
docker compose -f docker-compose.prod.yml run --rm api \
  pnpm --filter @flowdruid/api exec prisma migrate deploy
docker compose -f docker-compose.prod.yml up -d --no-deps --build api web
```

## Rollback

```bash
git reset --hard v0.1.0   # previous known-good tag
docker compose -f docker-compose.prod.yml up -d --no-deps --build api web
```

If the rollback crosses a migration boundary, restore the pre-deploy
`pg_dump` first — Prisma migrations are forward-only by design.

## Emergency contacts

- Maintainer: Hristo Minkov
- Sentry project: (fill in)
- Backup storage: (fill in)
