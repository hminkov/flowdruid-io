# `features/tasks` — task board module

Drag-and-drop kanban board used on `/tasks`. Built on `@dnd-kit` with
optimistic tRPC mutations so cards move instantly and only roll back on
server rejection.

## File layout

```
apps/web/src/features/tasks/
├── README.md                  ← you are here
├── types.ts                   ← TicketStatus, Ticket, STATUS_COLUMNS, PRIORITY_COLORS
├── TicketCard.tsx             ← TicketCard (sortable) + TicketCardDisplay (pure)
├── StatusColumn.tsx           ← one column: useDroppable + SortableContext
├── TaskBoard.tsx              ← DndContext + sensors + DragOverlay + announcements
└── useUpdateTicketStatus.ts   ← optimistic mutation hook
```

## Usage

```tsx
import { TaskBoard } from '@/features/tasks/TaskBoard';

<TaskBoard tickets={tickets} listArgs={listArgs} />
```

`listArgs` must match the arguments used for `trpc.tickets.list.useQuery`
so the optimistic cache update targets the same key.

## Install

`@dnd-kit` is already a dependency. To add from scratch:

```bash
pnpm --filter @flowdruid/web add @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

## Keyboard accessibility

Comes for free via `KeyboardSensor` + `sortableKeyboardCoordinates`:

- `Tab` to focus a card
- `Space` to pick it up
- Arrow keys to move between cards / columns
- `Space` again to drop
- `Escape` to cancel

Screen readers are announced on every drag phase via the `announcements`
config on `DndContext`.

## Types

`types.ts` is local to this module for now. Once the shared package has
UI-facing types, replace with:

```ts
import type { Ticket, TicketStatus } from '@flowdruid/shared';
```

## Troubleshooting

**Card snaps back after drop.** The server rejected the update. Check
the network tab for the tRPC `tickets.update` call — the optimistic
rollback runs in `onError`.

**Cards don't respond to drag.** Make sure each card has a unique `id`
and that `SortableContext` receives the matching array. Also check the
`PointerSensor` activation distance — ours is 4px so short clicks still
work as clicks, not drags.

**Keyboard drag does nothing.** Verify `sortableKeyboardCoordinates` is
passed as the `coordinateGetter` to the `KeyboardSensor`. Without it,
arrow keys don't know how to compute the next drop target.

**The dragged card flickers across the board.** Confirm the column
grouping is memoised (we use `useMemo` in `TaskBoard.tsx`) — rebuilding
the object on every pointer event breaks dnd-kit's measuring.
