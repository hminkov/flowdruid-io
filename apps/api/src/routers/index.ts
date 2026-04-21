import { router } from '../trpc';
import { authRouter } from './auth.router';
import { usersRouter } from './users.router';
import { teamsRouter } from './teams.router';
import { ticketsRouter } from './tickets.router';
import { standupsRouter } from './standups.router';
import { leavesRouter } from './leaves.router';
import { integrationsRouter } from './integrations.router';
import { suggestionsRouter } from './suggestions.router';
import { resourcesRouter } from './resources.router';
import { notificationsRouter } from './notifications.router';
import { messagesRouter } from './messages.router';
import { auditLogRouter } from './auditLog.router';
import { activityRouter } from './activity.router';

export const appRouter = router({
  auth: authRouter,
  users: usersRouter,
  teams: teamsRouter,
  tickets: ticketsRouter,
  standups: standupsRouter,
  leaves: leavesRouter,
  integrations: integrationsRouter,
  suggestions: suggestionsRouter,
  resources: resourcesRouter,
  notifications: notificationsRouter,
  messages: messagesRouter,
  auditLog: auditLogRouter,
  activity: activityRouter,
});

export type AppRouter = typeof appRouter;
