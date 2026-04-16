# Flowdruid

Team management platform for tracking tasks, availability, standups, and leave across multiple teams. Integrates with Slack and Jira.

## Features

- **Dashboard** — Team availability overview and active tasks at a glance
- **Task Board** — Kanban board with internal tickets and Jira sync, filterable by source/status/assignee
- **Standups** — Daily standup posts with capacity tracking and blocker alerts
- **Leave Management** — Request, approve/deny leave with calendar view and Slack notifications
- **Jira Integration** — Automatic read-only sync of Jira issues on a configurable interval
- **Slack Integration** — Notifications for standups, leave approvals, blockers, and company broadcasts
- **Role-based Access** — Admin, Team Lead, and Developer roles with scoped permissions

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, TailwindCSS, TanStack Query v5 |
| Backend | Node.js 20, TypeScript, Express, tRPC v11 |
| ORM | Prisma 5 |
| Database | PostgreSQL 16 |
| Queue / Cache | Redis 7, BullMQ |
| Auth | JWT (access + refresh token with httpOnly cookies) |
| Monorepo | Turborepo, pnpm workspaces |
| Containerisation | Docker, Docker Compose |

## Project Structure

```
flowdruid/
├── apps/
│   ├── api/          # Express + tRPC backend
│   └── web/          # React frontend
├── packages/
│   └── shared/       # Zod schemas + shared types
├── nginx/            # Reverse proxy config (production)
├── docker-compose.yml        # Local development
├── docker-compose.prod.yml   # Production deployment
└── .github/workflows/        # CI/CD
```

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 9+
- Docker & Docker Compose

### Local Development

1. **Clone and install dependencies**
   ```bash
   git clone https://github.com/hminkov/flowdruid-io.git
   cd flowdruid-io
   pnpm install
   ```

2. **Start Postgres and Redis**
   ```bash
   docker compose up postgres redis -d
   ```

3. **Set up environment variables**
   ```bash
   cp apps/api/.env.example apps/api/.env
   cp apps/web/.env.example apps/web/.env
   ```
   Edit `apps/api/.env` and set `JWT_SECRET`, `REFRESH_TOKEN_SECRET`, and `ENCRYPTION_KEY`.

4. **Run database migrations**
   ```bash
   pnpm db:migrate
   ```

5. **Start the dev servers**
   ```bash
   pnpm dev
   ```
   - Frontend: http://localhost:5173
   - API: http://localhost:3000
   - Health check: http://localhost:3000/health

### Docker (full stack)

```bash
docker compose up
```

This starts all services: frontend, API, Postgres, and Redis.

## Environment Variables

### API (`apps/api/.env`)

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `JWT_SECRET` | Secret for signing access tokens |
| `REFRESH_TOKEN_SECRET` | Secret for signing refresh tokens |
| `ENCRYPTION_KEY` | 32-byte hex key for encrypting Slack/Jira tokens at rest |
| `PORT` | API server port (default: 3000) |
| `NODE_ENV` | `development` or `production` |

### Web (`apps/web/.env`)

| Variable | Description |
|---|---|
| `VITE_API_URL` | API base URL (default: http://localhost:3000) |

## Production Deployment

```bash
docker compose -f docker-compose.prod.yml up -d
```

Uses Nginx with Certbot for TLS termination. Environment variables are loaded from `.env.prod` (not committed).

## License

MIT
