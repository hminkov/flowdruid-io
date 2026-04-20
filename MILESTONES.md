# Milestones

A running log of what has shipped on `main`, grouped chronologically. Each heading links back to the commits that carried the work.

## Phase 0 — Foundation

- Monorepo scaffold (Turborepo + pnpm workspaces), Docker Compose dev stack with Postgres + Redis.
- Express + tRPC v11 API server with JWT access/refresh auth (httpOnly refresh cookie), Prisma schema covering Organisation / Team / User / LeaveRequest / Ticket / Standup.
- Vite + React 18 frontend with tRPC React Query client, route skeleton, role-gated navigation.

## Phase 1 — Core workflows

- Standup post form + team feed with capacity tracking and blocker flag.
- Leave request + approval flow (admin / team-lead pending queue, approve/deny, calendar + list views).
- Kanban TaskBoard with `dnd-kit`, optimistic status updates, Jira + internal ticket sources.
- Users & Roles admin page (invite, change role, deactivate).

## Phase 2 — Ticket ecosystem

- Rich ticket detail modal: description, assignees with stop-propagation clicks, complexity points, priority tone.
- Assignment suggestions — TEAM_LEAD / ADMIN can suggest a teammate with a reason; surfaces in the inbox.
- Cover-request flow for prod-support shifts with Slack-channel fanout stub.

## Phase 3 — Resources

- **QA environments** — One KBE branch per env, per-service bookings with status pipeline (New → In development → Test in QA → Paused → Ready for prod → Pushed to prod), client-tag field, dev & QA owners. Grid / compact / table views; table groups bookings by env with expandable panels and persists collapse state per user.
- **Parking** — Admin-managed spots, per-day rotation grid, one-slot-per-day rule enforced server-side.
- **Prod-support rota** — Weekly primary/secondary pairs per team, auto-schedule-month action (random pairs with existing-week skip / overwrite), cover-request fanout to team channel + notifications, requester's team labelled inline.

## Phase 4 — Inbox & messaging

- Notification model + inbox page with filter + unread count polling (30 s).
- DM + team-channel `Conversation` / `Message` / `ConversationMember` tables with member gating.
- Header search for people + tickets with keyboard shortcut.

## Phase 5 — Polish

- **Design system formalised** — every colour / radius / motion value in `tokens.css`, consumed via `tailwind.config.ts`. Shared primitives: `Avatar`, `AvatarStack`, `UserPill`, `AvailabilityBadge`, `AvailabilityGlyph`, `CapacityBar`, `PriorityDot`, `StatusPill`, `EmptyState`, `Toast`, `ConfirmDialog`, `RouteErrorBoundary`.
- **Dark mode (Slack-inspired)** — neutral-warm greys (`#1A1D21` / `#232529` / `#2D2F34`), near-white body text, muted semantic chips with WCAG-AA contrast on every surface. Sidebar adopts the login-hero navy (`#1A163F`) in dark mode so chrome reads as one piece.
- **Availability semantics** — red pulsing dot for BUSY, green pulsing dot for AVAILABLE, 🏠 for REMOTE, 🌴 for ON_LEAVE. Only location states (remote / on leave) surface on member rows; urgency states live in the user drawer so list pages stay quiet.
- **Three-way theme toggle** — follow OS, force light, force dark (pre-hydration script prevents first-paint flash).
- **Accessibility pass** — modals respect ESC + click-outside, focus goes to the primary input, `role="dialog"` / `aria-modal` set throughout.

## Phase 6 — Seed + org fit

- Seed rewritten to match the real Cloudruid org chart: 12 business teams, 34 developers + CEO, first-listed member per team promoted to `TEAM_LEAD`. Prod-support rotas, parking rotations, and QA-booking owners updated so no one is scheduled on a team they don't belong to. `Yuliia Pylaieva` seeded as `ON_LEAVE` so the palm-tree state is visible out of the box.

## Recent iteration milestones (April 2026)

### Dashboard

- Stat cards became anchored popovers (`position: fixed` at the clicked card's bounding rect) — Available / On leave / In progress / Teams open right under the card that triggered them, with search, clickable rows, and ESC + click-outside dismiss.
- Dashboard Teams section restored at the top with compact / grid / table view toggle: compact = cards, grid = 2-col rich cards with per-member capacity, table = dense tabular rows with lead + inline availability + capacity bar.
- Member cards: avatar picks up a 🏠 / 🌴 sticker overlay when location warrants it, and every ticket row is a button that opens the TicketDetailModal.
- Mock per-member capacity (45–95%, deterministic per user) when a standup hasn't been posted, so team capacity is never gated on standup coverage.

### QA environments

- Env card header: brand-tinted monospace code pill (`QA1`) with a soft booking-count chip, prominent "Add service" brand CTA, and a 36 px settings gear.
- Bookings within an env sort by lifecycle so active work rises and shipped work sinks; ties break on most-recent-update.
- Modern dropdown (custom, not native `<select>`) for the Env and Sort filters with chevron rotation, brand-highlighted selection, and click-outside dismiss.

### Person / team drawers

- Every ticket row across the drawers opens the `TicketDetailModal` layered above the drawer (`z-modal > z-drawer`). The modal gained an "Open on board" jump for full context.
- User drawer header gets an availability sticker overlaid on the avatar's bottom-right — pulsing green/red dot for available/busy, 🏠 / 🌴 for remote / on leave — so the single piece of information most people open the drawer to check is visible at a glance.

### Clickable-by-default names

- Swept Approve Leaves, Standup feed, All Teams, Users & Roles, QA env compact bookings, Dashboard lead cell, and more to make every rendered person name click-through to the user detail drawer. Nested rows stop propagation so the inner name drills into the person, not the outer row.

### Version + credit

- `/health` returns the running API version, read at runtime from `process.env.npm_package_version`. Sidebar footer pins the version plus a `Created by Hristo Minkov` credit on every route.

### Leave calendar

- "Today on <my-team>" strip under the calendar grid — always on, regardless of the team filter above — lists team members on leave today with a type emoji, a leave-type pill, and a clickable row. Shows a success-tone "the whole team is available today" when nobody is out.
