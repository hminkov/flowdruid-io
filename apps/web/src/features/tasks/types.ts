export type TicketStatus = 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE';
export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH';
export type TicketSource = 'INTERNAL' | 'JIRA';

export type TicketAssignee = {
  user: { id: string; name: string; initials: string };
};

export type Ticket = {
  id: string;
  status: TicketStatus;
  priority: TicketPriority;
  source: TicketSource;
  jiraKey: string | null;
  title: string;
  assignees: TicketAssignee[];
};

export const STATUS_COLUMNS: readonly TicketStatus[] = [
  'TODO',
  'IN_PROGRESS',
  'IN_REVIEW',
  'DONE',
] as const;

export const STATUS_LABELS: Record<TicketStatus, string> = {
  TODO: 'To do',
  IN_PROGRESS: 'In progress',
  IN_REVIEW: 'In review',
  DONE: 'Done',
};

export const PRIORITY_COLORS: Record<TicketPriority, string> = {
  HIGH: 'bg-priority-high',
  MEDIUM: 'bg-priority-medium',
  LOW: 'bg-priority-low',
};
