import { router } from '../trpc';
import { authRouter } from './auth.router';
import { usersRouter } from './users.router';
import { teamsRouter } from './teams.router';
import { ticketsRouter } from './tickets.router';
import { standupsRouter } from './standups.router';
import { leavesRouter } from './leaves.router';
import { integrationsRouter } from './integrations.router';
import { suggestionsRouter } from './suggestions.router';

export const appRouter = router({
  auth: authRouter,
  users: usersRouter,
  teams: teamsRouter,
  tickets: ticketsRouter,
  standups: standupsRouter,
  leaves: leavesRouter,
  integrations: integrationsRouter,
  suggestions: suggestionsRouter,
});

export type AppRouter = typeof appRouter;
