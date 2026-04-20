# Flowdruid

Team management platform for engineering orgs — tracks standups, capacity, leave, prod-support rota, QA environments, parking, and tickets across every team. Integrates with Slack and Jira.

Ships with a fictional 12-team demo seed (35 users, all `password = Password123!`) so every feature has data to render against out of the box.

## What's inside

### Planning & visibility

- **Dashboard** — Expandable team panels with a compact/grid/table toggle, per-member capacity (mocked from standups when not posted), clickable stat-cards that open anchored popovers (Available now, On leave, In progress, Teams) with built-in search.
- **Task Board** — Kanban with drag-and-drop via `dnd-kit`, Jira + internal tickets side-by-side, filter chips for source / status / assignee, deep-link support via `?open=<ticketId>`.
- **Ticket overview modal** — Opens from any person or team drawer, any member card, or the board. Shows description, assignees, suggestions, cover requests, and complexity points. "Open on board" jumps to the task board with the ticket highlighted.
- **Standups** — Daily post with capacity slider and blocker flag; author profile clickable everywhere it appears.
- **Leave management** — Request, approve/deny, month calendar + list views, and a "Today on my team" strip under the calendar that lists who is out with 🌴 / 🤒 / 🏠 / ⏱️ glyphs (or confirms the whole team is available).
- **Users & roles admin** — Invite users, change roles, deactivate; every person row opens the detail drawer.

### Resources

- **QA environments** — One KBE branch per env; each env holds multiple service bookings with status (New → In development → Test in QA → Paused → Ready for prod → Pushed to prod), client tag, dev & QA owners, and a last-activity heat strip. Compact / grid / table views; the table groups bookings by env with expandable panels and persists collapse state per user.
- **Parking** — Admin-managed spots with a per-day rotation; one-slot-per-day rule enforced server-side.
- **Prod-support rota** — Per-team weekly schedule with an auto-schedule-month action (random pair, skips existing weeks unless `overwrite`). Cover requests fan out to the team channel + notification inbox, show the requester's team inline, and can be accepted by any team-mate.

### Inbox & messaging

- **Inbox** — Notifications for leave reviews, ticket status, prod-support on-call, blockers, cover requests; unread badge on the sidebar bell polls every 30 s.
- **Messages** — DM + per-team channel `Conversation` / `Message` tables with member gating; unread markers drive the same inbox indicator.

### Integrations

- **Slack** — Webhook-driven events (workers in BullMQ), notifications for standups, leave approvals, blockers, cover requests, and company broadcasts.
- **Jira** — Background sync on a configurable interval; read-only import of tickets from specified projects.

### Presence & identity

- **Availability glyphs** — Red-dot busy, green-dot available (both with a pulsing halo), 🏠 for remote, 🌴 for on-leave. Shown as a sticker-style overlay on avatars in the user drawer.
- **Clickable-by-default names** — Every rendered person name across the app opens the user detail drawer (with stop-propagation in nested rows so the inner name drills into the person, not the outer row).
- **Click through to the drawer** — The drawer shows availability, today's standup, assigned tickets grouped by status, and a month/year activity window with complexity-weighted score.

### UX & design system

- **Design tokens** in `apps/web/src/styles/tokens.css` — every colour, radius, and motion value is a CSS custom property, wired into `tailwind.config.ts`. No hardcoded hex outside that file.
- **Three-way theme toggle** — follow OS, force light, or force dark. Sidebar mirrors the login hero's deep-navy in dark mode for brand continuity.
- **Shared primitives** — `Avatar`, `AvatarStack`, `UserPill`, `AvailabilityBadge`, `AvailabilityGlyph`, `CapacityBar`, `PriorityDot`, `StatusPill`, `EmptyState`, `Toast`, `ConfirmDialog`, `RouteErrorBoundary`.
- **A11y** — Modal + drawer layers respect ESC and click-outside, role="dialog"/"aria-modal" set where applicable, keyboard focus on primary inputs in every modal.

### Workbench

- **Sidebar footer** shows the running API version (read from `/health` which pulls `process.env.npm_package_version`) with a `Created by Hristo Minkov` credit.

## Tech stack

| Layer             | Technology                                          |
| ----------------- | --------------------------------------------------- |
| Frontend          | React 18, Vite, TailwindCSS, TanStack Query v5      |
| Backend           | Node.js 20, TypeScript, Express, tRPC v11           |
| ORM               | Prisma 5                                            |
| Database          | PostgreSQL 16                                       |
| Queue / cache     | Redis 7, BullMQ                                     |
| Auth              | JWT access + refresh tokens (httpOnly refresh)      |
| Monorepo          | Turborepo, pnpm workspaces                          |
| Containerisation  | Docker, Docker Compose                              |
| Drag & drop       | `dnd-kit`                                           |
| Shared validation | Zod schemas in `packages/shared`                    |

## Project structure

```
flowdruid/
├── apps/
│   ├── api/          # Express + tRPC backend, Prisma schema, BullMQ workers
│   └── web/          # React frontend
├── packages/
│   └── shared/       # Zod schemas + shared types
├── nginx/            # Reverse proxy config (production)
├── docker-compose.yml        # Local development
├── docker-compose.prod.yml   # Production deployment
└── .github/workflows/        # CI/CD
```

## Getting started

### Prerequisites

- Node.js 20+
- pnpm 9+
- Docker & Docker Compose

### Local development

1. **Clone and install**

   ```bash
   git clone https://github.com/hminkov/flowdruid-io.git
   cd flowdruid-io
   pnpm install
   ```

2. **Start Postgres and Redis**

   ```bash
   docker compose up postgres redis -d
   ```

3. **Environment variables**

   ```bash
   cp apps/api/.env.example apps/api/.env
   cp apps/web/.env.example apps/web/.env
   ```

   Edit `apps/api/.env` and set `JWT_SECRET`, `REFRESH_TOKEN_SECRET`, and `ENCRYPTION_KEY`.

4. **Database**

   ```bash
   pnpm db:migrate
   pnpm --filter @flowdruid/api exec tsx prisma/seed.ts
   ```

   Seed creates the Cloudruid org (12 teams, 35 users including `hristo.minkov@cloudruid.com` as admin). All seeded users share the password `Password123!`.

5. **Run the dev servers**

   ```bash
   pnpm dev
   ```

   - Web: http://localhost:5173
   - API: http://localhost:3000 (health: `/health` returns status + version)

### Docker (full stack)

```bash
docker compose up
```

## Testing with the seeded data

The seed builds a fictional `Acme` workspace with 12 teams, 35 users, sample tickets, standups, leaves, QA bookings, parking spots, and a prod-support rota — every feature has data to render against. Re-run any time for a clean slate:

```bash
pnpm --filter @flowdruid/api exec tsx prisma/seed.ts
```

### Accounts to log in with

All seeded users share the password **`Password123!`**. Emails follow `firstname.lastname@acme.com`.

| Role                 | Email                       | Use to exercise                                          |
| -------------------- | --------------------------- | -------------------------------------------------------- |
| **Admin**            | `alex.morgan@acme.com`      | Every admin-only page, role changes, integrations config |
| Team lead (Coins)    | `peter.novak@acme.com`      | Team-lead views, approving leaves for Coins              |
| Team lead (Account)  | `nathan.price@acme.com`     | Another team-lead scope                                  |
| Team lead (QA)       | `nina.kowalski@acme.com`    | QA team — **seeded as 🌴 ON_LEAVE** (palm-tree badge)    |
| Developer            | `marcus.klein@acme.com`     | Default developer view (Coins team)                      |
| Developer (remote)   | `thomas.kelly@acme.com`     | **Seeded as 🏠 REMOTE** (house badge)                    |

### Suggested five-minute tour

Log in as `alex.morgan@acme.com` and try:

1. **Dashboard** — expand a team panel, click a team-member's ticket to open the overview, then click **Open on board** to jump to `/tasks` with the modal pre-opened.
2. **Stat cards** — click **Available now**, **On leave**, **In progress**, or **Teams** on the dashboard stat strip. Each opens a searchable popover anchored under the card.
3. **QA environments** — toggle the Grid / Compact / Table views. In Table view, expand / collapse env groups. Click "Add service" on any env to create a booking.
4. **Leave calendar** — below the calendar grid, see the **Today on &lt;your team&gt;** strip. Log in as `peter.novak@acme.com` to see a populated team-specific view.
5. **Prod-support rota** — go to Prod support, click "Request cover" on any assignment, then log in as a team-mate (same team) and accept the request.
6. **Keyboard shortcuts** — press `?` to open the help overlay. Try `g d` → dashboard, `g t` → tasks, `/` to focus the global search.
7. **User drawer** — click any person's name anywhere in the app (names are clickable across every surface). The avatar in the drawer carries a pulsing red/green dot or an emoji showing their status.
8. **Dark mode** — toggle via the theme switcher in the top-right (system / light / dark). The left nav shifts to the login-hero navy in dark mode.

### Things the seed cannot fake

The following need real external credentials to work end-to-end. Today they're stubs:

- **Slack outbound** — leave-approval, blocker, and cover-request notifications currently write to the in-app `Notification` inbox. No message reaches Slack until the integration is wired and an admin connects via the Settings page.
- **Jira sync** — every Jira-flagged ticket (`DW-XXX`) is seeded directly. The Jira worker is scheduled but makes no outbound calls without a `JiraConfig` row.
- **Email fallback** — no email worker is wired yet.

### Resetting

```bash
# Nuke and re-seed
docker compose exec postgres psql -U postgres -d flowdruid -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
pnpm db:migrate
pnpm --filter @flowdruid/api exec tsx prisma/seed.ts
```

## Environment variables

### API (`apps/api/.env`)

| Variable               | Description                                         |
| ---------------------- | --------------------------------------------------- |
| `DATABASE_URL`         | PostgreSQL connection string                        |
| `REDIS_URL`            | Redis connection string                             |
| `JWT_SECRET`           | Secret for signing access tokens                    |
| `REFRESH_TOKEN_SECRET` | Secret for signing refresh tokens                   |
| `ENCRYPTION_KEY`       | 32-byte hex key for Slack/Jira tokens at rest       |
| `PORT`                 | API server port (default: 3000)                     |
| `NODE_ENV`             | `development` or `production`                       |

### Web (`apps/web/.env`)

| Variable       | Description                                       |
| -------------- | ------------------------------------------------- |
| `VITE_API_URL` | API base URL (default: http://localhost:3000)     |

## Production deployment

```bash
docker compose -f docker-compose.prod.yml up -d
```

Uses Nginx with Certbot for TLS termination. Production env vars are loaded from `.env.prod` (not committed).

## License

MIT
