# Flowdruid — Implementation Plan for Claude Code

## Overview

Flowdruid is a team management SaaS platform for tracking tasks, availability, standups, and leave across multiple teams. It integrates with Slack (notifications) and Jira (ticket sync), and supports internal tickets that live only in Flowdruid.

This document is the single source of truth for Claude Code to implement the full application.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, TailwindCSS, React Query (TanStack Query v5) |
| Backend | Node.js 20, TypeScript, Express, tRPC v11 |
| ORM | Prisma 5 |
| Database | PostgreSQL 16 |
| Queue / Cache | Redis 7 + BullMQ |
| Auth | JWT (access token 15min + refresh token 7d stored in httpOnly cookie) |
| Monorepo | Turborepo + pnpm workspaces |
| Containerisation | Docker + Docker Compose |
| Reverse proxy (VPS) | Nginx + Certbot (Let's Encrypt) |
| CI/CD | GitHub Actions |
| External integrations | Slack Web API + Webhooks, Jira REST API v3 |

---

## Monorepo Structure

```
flowdruid/
├── apps/
│   ├── web/                  # React frontend
│   │   ├── src/
│   │   │   ├── components/   # Shared UI components
│   │   │   ├── pages/        # Route-level page components
│   │   │   ├── hooks/        # Custom React hooks
│   │   │   ├── lib/          # tRPC client, query client setup
│   │   │   └── types/        # Frontend-only types
│   │   ├── index.html
│   │   ├── vite.config.ts
│   │   └── package.json
│   └── api/                  # Express + tRPC backend
│       ├── src/
│       │   ├── routers/      # tRPC routers (one per domain)
│       │   ├── services/     # Business logic
│       │   ├── workers/      # BullMQ job processors
│       │   ├── integrations/ # Slack, Jira clients
│       │   ├── middleware/   # Auth, error handling
│       │   └── lib/          # Prisma client, Redis client, BullMQ setup
│       ├── prisma/
│       │   ├── schema.prisma
│       │   └── migrations/
│       └── package.json
├── packages/
│   └── shared/               # Zod schemas + shared TypeScript types
│       ├── src/
│       │   ├── schemas/      # Zod validation schemas
│       │   └── types/        # Shared enums and types
│       └── package.json
├── docker-compose.yml        # Local development
├── docker-compose.prod.yml   # VPS production
├── turbo.json
├── pnpm-workspace.yaml
└── .github/
    └── workflows/
        └── deploy.yml
```

---

## Database Schema (Prisma)

```prisma
// apps/api/prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Role {
  ADMIN
  TEAM_LEAD
  DEVELOPER
}

enum LeaveType {
  ANNUAL
  PARTIAL_AM
  PARTIAL_PM
  REMOTE
  SICK
}

enum LeaveStatus {
  PENDING
  APPROVED
  DENIED
}

enum TicketStatus {
  TODO
  IN_PROGRESS
  IN_REVIEW
  DONE
}

enum TicketPriority {
  LOW
  MEDIUM
  HIGH
}

enum TicketSource {
  INTERNAL
  JIRA
}

enum AvailabilityStatus {
  AVAILABLE
  BUSY
  REMOTE
  ON_LEAVE
}

model Organisation {
  id        String   @id @default(cuid())
  name      String
  slug      String   @unique
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  teams     Team[]
  users     User[]
  slackConfig SlackConfig?
  jiraConfig  JiraConfig?
}

model Team {
  id             String       @id @default(cuid())
  name           String
  orgId          String
  slackChannelId String?
  createdAt      DateTime     @default(now())

  org            Organisation @relation(fields: [orgId], references: [id])
  members        User[]
  tickets        Ticket[]
  standups       Standup[]
}

model User {
  id           String             @id @default(cuid())
  email        String             @unique
  name         String
  initials     String             @db.VarChar(3)
  passwordHash String
  role         Role               @default(DEVELOPER)
  orgId        String
  teamId       String?
  availability AvailabilityStatus @default(AVAILABLE)
  createdAt    DateTime           @default(now())
  updatedAt    DateTime           @updatedAt

  org              Organisation  @relation(fields: [orgId], references: [id])
  team             Team?         @relation(fields: [teamId], references: [id])
  leaveRequests    LeaveRequest[]
  standups         Standup[]
  assignedTickets  TicketAssignment[]
  refreshTokens    RefreshToken[]
}

model RefreshToken {
  id        String   @id @default(cuid())
  token     String   @unique
  userId    String
  expiresAt DateTime
  createdAt DateTime @default(now())

  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model LeaveRequest {
  id          String      @id @default(cuid())
  userId      String
  type        LeaveType
  status      LeaveStatus @default(PENDING)
  startDate   DateTime
  endDate     DateTime
  note        String?
  reviewedBy  String?
  reviewedAt  DateTime?
  notifySlack Boolean     @default(true)
  createdAt   DateTime    @default(now())

  user        User        @relation(fields: [userId], references: [id])
}

model Ticket {
  id          String         @id @default(cuid())
  source      TicketSource   @default(INTERNAL)
  jiraKey     String?        @unique  // e.g. "FD-041" — null for internal
  jiraId      String?        @unique  // Jira internal issue ID
  title       String
  description String?
  status      TicketStatus   @default(TODO)
  priority    TicketPriority @default(MEDIUM)
  teamId      String
  createdAt   DateTime       @default(now())
  updatedAt   DateTime       @updatedAt
  syncedAt    DateTime?      // last Jira sync timestamp

  team        Team           @relation(fields: [teamId], references: [id])
  assignees   TicketAssignment[]
}

model TicketAssignment {
  ticketId  String
  userId    String

  ticket    Ticket @relation(fields: [ticketId], references: [id])
  user      User   @relation(fields: [userId], references: [id])

  @@id([ticketId, userId])
}

model Standup {
  id           String   @id @default(cuid())
  userId       String
  teamId       String
  yesterday    String
  today        String
  blockers     String?
  capacityPct  Int      @default(50)  // 0–100
  postedAt     DateTime @default(now())

  user         User     @relation(fields: [userId], references: [id])
  team         Team     @relation(fields: [teamId], references: [id])
}

model SlackConfig {
  id              String       @id @default(cuid())
  orgId           String       @unique
  botToken        String       // encrypted at rest
  signingSecret   String       // encrypted at rest
  notifyStandup   Boolean      @default(true)
  notifyLeave     Boolean      @default(true)
  notifyBlocker   Boolean      @default(true)
  notifyDone      Boolean      @default(false)
  notifyBroadcast Boolean      @default(true)

  org             Organisation @relation(fields: [orgId], references: [id])
}

model JiraConfig {
  id           String       @id @default(cuid())
  orgId        String       @unique
  baseUrl      String       // e.g. https://yourco.atlassian.net
  email        String       // Jira account email for API auth
  apiToken     String       // encrypted at rest
  projectKeys  String[]     // e.g. ["FD", "OPS"] — projects to sync
  syncInterval Int          @default(15)  // minutes between auto-sync
  lastSyncAt   DateTime?

  org          Organisation @relation(fields: [orgId], references: [id])
}
```

---

## API Routers (tRPC)

Implement one router per domain under `apps/api/src/routers/`:

### `auth.router.ts`
- `auth.login` — validate credentials, return access token, set refresh token cookie
- `auth.refresh` — rotate refresh token, return new access token
- `auth.logout` — invalidate refresh token
- `auth.me` — return current user profile

### `users.router.ts`
- `users.list` — list all users in org (admin/lead only)
- `users.invite` — create user with temporary password (admin only)
- `users.update` — update name, role, team (admin only)
- `users.updateAvailability` — user updates own availability status
- `users.deactivate` — soft-delete (admin only)

### `teams.router.ts`
- `teams.list` — list all teams in org
- `teams.create` — create team (admin only)
- `teams.update` — rename, assign Slack channel (admin only)
- `teams.delete` — (admin only)

### `tickets.router.ts`
- `tickets.list` — list tickets, filterable by team/status/source/assignee
- `tickets.create` — create internal ticket
- `tickets.update` — update status, priority, assignees
- `tickets.delete` — delete internal ticket only (cannot delete Jira-sourced)
- `tickets.assign` — assign/unassign user to ticket
- `tickets.syncJira` — manually trigger Jira sync for a team (admin/lead)

### `standups.router.ts`
- `standups.post` — post today's standup update
- `standups.list` — list standups, filterable by team/date/user
- `standups.today` — get today's standup for current user
- `standups.teamSummary` — get all standups for a team on a given date

### `leaves.router.ts`
- `leaves.request` — submit leave request
- `leaves.list` — list leave requests (own, or all for admin/lead)
- `leaves.pending` — list pending requests (admin/lead only)
- `leaves.approve` — approve a request (admin/lead only)
- `leaves.deny` — deny a request (admin/lead only)
- `leaves.calendar` — get leave events for calendar view (date range + team filter)

### `integrations.router.ts`
- `integrations.getSlackConfig` — get Slack config (admin only)
- `integrations.saveSlackConfig` — save/update Slack config (admin only)
- `integrations.testSlack` — send a test message (admin only)
- `integrations.getJiraConfig` — get Jira config (admin only)
- `integrations.saveJiraConfig` — save/update Jira config (admin only)
- `integrations.testJira` — validate Jira credentials and list projects (admin only)
- `integrations.broadcastSlack` — send company-wide message to all team channels (admin only)

---

## Jira Integration

### Setup (`apps/api/src/integrations/jira.client.ts`)

Use the **Jira REST API v3** with HTTP Basic Auth (email + API token).

```typescript
// Base URL: https://{subdomain}.atlassian.net/rest/api/3
// Auth: Basic base64(email:apiToken)
// Headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' }
```

### Sync Logic (`apps/api/src/services/jira.sync.ts`)

Implement `syncJiraTickets(orgId: string)`:

1. Load `JiraConfig` for the org
2. For each `projectKey` in config, call `GET /rest/api/3/search?jql=project={key}&maxResults=100&fields=summary,status,priority,assignee`
3. Map Jira issue fields to Flowdruid `Ticket` model:
   - `issue.key` → `jiraKey`
   - `issue.id` → `jiraId`
   - `issue.fields.summary` → `title`
   - `issue.fields.description` (ADF format, strip to plain text) → `description`
   - `issue.fields.status.name` → map to `TicketStatus` enum:
     - "To Do" → `TODO`
     - "In Progress" → `IN_PROGRESS`
     - "In Review" / "Code Review" → `IN_REVIEW`
     - "Done" / "Closed" / "Resolved" → `DONE`
   - `issue.fields.priority.name` → map to `TicketPriority`:
     - "Highest" / "High" → `HIGH`
     - "Medium" → `MEDIUM`
     - "Low" / "Lowest" → `LOW`
4. Upsert each ticket using `jiraKey` as the unique identifier (`prisma.ticket.upsert`)
5. Update `JiraConfig.lastSyncAt`
6. Do NOT delete tickets that disappear from Jira — mark them `DONE` instead

### Auto-sync (BullMQ)

Create a repeatable job `jira-sync` in `apps/api/src/workers/jira.worker.ts`:
- Runs every `jiraConfig.syncInterval` minutes (default 15)
- Processes all orgs with a `JiraConfig`
- On failure: retry up to 3 times with exponential backoff, log error

### Ticket Display Rules (frontend)

- Jira tickets: show `jiraKey` badge (e.g. `FD-041`), source indicator, link to Jira issue (`{baseUrl}/browse/{jiraKey}`)
- Internal tickets: show `INT-{id}` badge in a different colour, no external link
- Both types: same status/priority UI, same assignment UI
- Filter bar: "All", "Jira", "Internal" — persist filter in URL query param

---

## Slack Integration

### Setup (`apps/api/src/integrations/slack.client.ts`)

Use `@slack/web-api` SDK. Initialise with `botToken` from `SlackConfig`.

### Notification Events (BullMQ jobs)

Each event queues a job processed by `apps/api/src/workers/slack.worker.ts`:

| Event | Trigger | Channel | Message format |
|---|---|---|---|
| `standup.posted` | User posts standup | Team channel | Name + today summary + capacity bar |
| `leave.approved` | Admin/lead approves | Team channel | Name + leave type + dates |
| `leave.denied` | Admin/lead denies | DM to requester | Leave type + dates + denied |
| `blocker.flagged` | Standup has blocker | Team channel | Name + blocker text + @lead mention |
| `ticket.done` | Ticket moved to DONE | Team channel (if enabled) | Ticket key + title + assignee |
| `broadcast` | Admin sends broadcast | All team channels | Full message text |

### Slack Webhook (incoming)

Expose `POST /api/slack/events` to receive Slack event callbacks. Verify signature using `signingSecret`. Initially only needs to handle: URL verification challenge.

---

## Background Workers

All workers in `apps/api/src/workers/`:

### `jira.worker.ts`
- Queue: `jira-sync`
- Job: sync all orgs every N minutes
- Repeatable via BullMQ `repeat` option

### `slack.worker.ts`
- Queue: `slack-notifications`
- Job: send queued Slack messages
- Concurrency: 5

### `leave.worker.ts`
- Queue: `leave-reminders`
- Job: daily cron at 08:00 — post today's absence summary to each team channel

---

## Auth & Permissions Middleware

Implement `requireAuth` and `requireRole` middleware for tRPC procedures:

```typescript
// Role hierarchy: ADMIN > TEAM_LEAD > DEVELOPER
// Rules:
// - ADMIN: access to all orgs data, all admin routes
// - TEAM_LEAD: access to own team data, can approve/deny leave for own team
// - DEVELOPER: access to own data + own team's read-only data
```

All tRPC procedures should be one of:
- `publicProcedure` — login, refresh only
- `protectedProcedure` — any authenticated user
- `leadProcedure` — TEAM_LEAD or ADMIN
- `adminProcedure` — ADMIN only

---

## Docker Compose

### `docker-compose.yml` (local dev)

```yaml
version: '3.9'
services:
  web:
    build:
      context: ./apps/web
      dockerfile: Dockerfile.dev
    ports:
      - "5173:5173"
    volumes:
      - ./apps/web:/app
      - /app/node_modules
    environment:
      - VITE_API_URL=http://localhost:3000

  api:
    build:
      context: ./apps/api
      dockerfile: Dockerfile.dev
    ports:
      - "3000:3000"
    volumes:
      - ./apps/api:/app
      - /app/node_modules
    environment:
      - DATABASE_URL=postgresql://flowdruid:flowdruid@postgres:5432/flowdruid
      - REDIS_URL=redis://redis:6379
      - JWT_SECRET=dev_jwt_secret_change_in_prod
      - REFRESH_TOKEN_SECRET=dev_refresh_secret_change_in_prod
    depends_on:
      - postgres
      - redis

  postgres:
    image: postgres:16-alpine
    ports:
      - "5432:5432"
    environment:
      - POSTGRES_USER=flowdruid
      - POSTGRES_PASSWORD=flowdruid
      - POSTGRES_DB=flowdruid
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

### `docker-compose.prod.yml` (VPS)

Extends the above with:
- Nginx service (port 80/443) routing to `web:80` and `api:3000`
- Certbot service for TLS
- No volume mounts (use built images)
- Environment variables loaded from `.env.prod` (never committed)
- `restart: always` on all services

---

## Environment Variables

### `apps/api/.env`
```
DATABASE_URL=postgresql://flowdruid:flowdruid@postgres:5432/flowdruid
REDIS_URL=redis://redis:6379
JWT_SECRET=
REFRESH_TOKEN_SECRET=
ENCRYPTION_KEY=          # 32-byte hex key for encrypting Slack/Jira tokens at rest
PORT=3000
NODE_ENV=development
```

### `apps/web/.env`
```
VITE_API_URL=http://localhost:3000
```

---

## Sensitive Data Encryption

Slack `botToken`, `signingSecret`, and Jira `apiToken` must be encrypted at rest using AES-256-GCM before storing in the database. Implement `apps/api/src/lib/encrypt.ts`:

```typescript
// encrypt(plaintext: string, key: string): string  → stores as "iv:authTag:ciphertext" (hex)
// decrypt(ciphertext: string, key: string): string
// Key loaded from ENCRYPTION_KEY env var
```

Use Node.js built-in `crypto` module — no external dependencies needed.

---

## Frontend Pages & Routing

Use React Router v6. Route structure:

```
/login                    → LoginPage
/                         → redirect to /dashboard
/dashboard                → DashboardPage (team tasks + availability)
/tasks                    → TasksPage (all tasks + tickets)
/standup                  → StandupPage (feed + post form)
/calendar                 → LeaveCalendarPage
/leave/request            → LeaveRequestPage
/admin/leaves             → ApproveLeavesPage      [lead, admin]
/admin/users              → UsersRolesPage          [admin]
/admin/integrations       → IntegrationsPage        [admin]
/all-teams                → AllTeamsPage            [lead, admin]
```

### Key Frontend Components

- `TaskBoard` — displays tickets from both Jira and internal, with source badge, filter bar (All / Jira / Internal), and status columns
- `TicketCard` — shows jiraKey or INT-xxx badge, title, priority dot, assignee avatars, status pill; Jira tickets have external link icon
- `StandupForm` — yesterday / today / blockers fields + capacity slider (0–100) + submit
- `LeaveRequestForm` — type selector (annual / partial AM / partial PM / remote / sick), date picker, note, Slack notify checkboxes
- `LeaveCalendar` — monthly grid, filter chips, list view toggle, capacity bars per team
- `AvailabilityBadge` — coloured pill: Available (green) / Busy (amber) / Remote (blue) / On leave (red)
- `CapacityBar` — coloured fill bar: green < 70%, amber 70–89%, red ≥ 90%
- `TeamSelector` — dropdown in topbar to filter dashboard by team (persisted in URL)
- `BroadcastBox` — admin-only text input + "Send to all" button on All Teams page

---

## Jira Config UI (Integrations Page)

The Jira section of the integrations page must include:

1. **Connection fields**: Jira base URL, account email, API token (masked input)
2. **Test connection button**: calls `integrations.testJira`, shows project list on success
3. **Project selection**: multi-select checkboxes of available Jira projects to sync
4. **Sync interval**: dropdown — 5 / 15 / 30 / 60 minutes
5. **Last synced**: timestamp display
6. **Manual sync button**: calls `tickets.syncJira` and shows spinner + result
7. **Status indicator**: Connected (green) / Not configured (gray) / Error (red)

---

## Data Flow: Ticket Sync

```
JiraConfig saved
      ↓
BullMQ repeatable job scheduled (every N min)
      ↓
jira.worker picks up job
      ↓
jira.sync.ts fetches issues from Jira REST API
      ↓
For each issue: prisma.ticket.upsert (match on jiraKey)
      ↓
source = JIRA, syncedAt = now()
      ↓
Internal tickets untouched (source = INTERNAL)
      ↓
Frontend React Query refetches /tickets.list
```

---

## Data Flow: Leave Approval

```
User submits leave request
      ↓
leaves.request → creates LeaveRequest (status: PENDING)
      ↓
Lead/Admin sees in /admin/leaves
      ↓
leaves.approve → status: APPROVED, reviewedBy, reviewedAt set
      ↓
BullMQ job queued: slack.notify(leave.approved)
      ↓
slack.worker sends message to team channel
      ↓
User availability updated if leave starts today
      ↓
Calendar reflects approved leave
```

---

## Implementation Order for Claude Code

Build in this sequence to always have a working app at each step:

### Phase 1 — Foundation (get it running)
1. Scaffold monorepo with Turborepo + pnpm workspaces
2. Docker Compose up (Postgres + Redis running)
3. Prisma schema + first migration
4. Express server + tRPC setup + health check endpoint
5. JWT auth (login, refresh, logout, me)
6. React app with Vite + TailwindCSS + tRPC client
7. Login page + protected route wrapper

### Phase 2 — Core features
8. Users & teams CRUD (API + admin UI)
9. Dashboard page — team availability + active tasks widget
10. Tickets — internal ticket CRUD (create, list, update status, assign)
11. Standup feed — post + list + capacity bar
12. Leave requests — submit, list, approve/deny
13. Leave calendar — monthly grid, list view, filters

### Phase 3 — Integrations
14. Slack config UI + save/test
15. BullMQ workers + Slack notification jobs
16. Jira config UI + save/test connection
17. Jira sync service + BullMQ repeatable job
18. Ticket list unified view (Jira + internal, source badge, filters)
19. All Teams page + broadcast

### Phase 4 — Polish & deploy
20. Role-based UI (hide admin nav for non-admins)
21. Error boundaries + loading states throughout
22. `docker-compose.prod.yml` + Nginx config
23. GitHub Actions deploy workflow
24. README with setup instructions

---

## Key Business Rules

- A Jira-sourced ticket **cannot be deleted** from Flowdruid — only its local status can be updated; changes do NOT sync back to Jira (read-only sync)
- Internal tickets use the prefix `INT-` followed by a sequential number per team
- Leave requests require approval even for REMOTE type — leads can approve same-day
- PARTIAL_AM = morning 4 hours, PARTIAL_PM = afternoon 4 hours — both count as 0.5 capacity for that day
- SICK leave is auto-approved (status set to APPROVED immediately) but still creates a record and fires a Slack notification
- A user can only have one pending leave request per date range — overlapping requests are rejected at API level
- Standup can only be posted once per user per day — subsequent posts update the existing record
- Capacity percentage in standup is self-reported (0–100 slider) — it is displayed but does not automatically block task assignment
- BullMQ jobs use the `orgId` as the job ID prefix to avoid cross-org collisions in Redis

---

## Notes for Claude Code

- All API tokens and secrets stored in the database must be encrypted using the `encrypt/decrypt` utility before write and after read
- Use `zod` for all input validation — share schemas from `packages/shared/src/schemas/`
- tRPC errors should use `TRPCError` with appropriate codes (`UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `BAD_REQUEST`)
- Prisma queries that touch multiple tables should use transactions (`prisma.$transaction`)
- The frontend should never call the Jira or Slack APIs directly — all external calls go through the backend
- React Query keys should be structured as arrays: `['tickets', 'list', { teamId, status }]`
- Use `@tanstack/react-query` devtools in development only
- TailwindCSS config should include the Flowdruid brand purple: `#534AB7` as `primary`
- All date/time values are stored in UTC in the database; convert to local time in the frontend only
