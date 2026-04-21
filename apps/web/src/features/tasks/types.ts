export type TicketStatus =
  | 'TODO'
  | 'BLOCKED'
  | 'IN_PROGRESS'
  | 'IN_REVIEW'
  | 'READY_FOR_VERIFICATION'
  | 'DONE';
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
  'BLOCKED',
  'IN_PROGRESS',
  'IN_REVIEW',
  'READY_FOR_VERIFICATION',
  'DONE',
] as const;

// Internal tickets don't use the full Jira workflow — only the four
// canonical states. Drops onto the other two are rejected.
export const INTERNAL_ALLOWED_STATUSES: readonly TicketStatus[] = [
  'TODO',
  'IN_PROGRESS',
  'IN_REVIEW',
  'DONE',
] as const;

export function isStatusAllowed(source: TicketSource, status: TicketStatus): boolean {
  if (source === 'JIRA') return true;
  return (INTERNAL_ALLOWED_STATUSES as readonly TicketStatus[]).includes(status);
}

export const STATUS_LABELS: Record<TicketStatus, string> = {
  TODO: 'Open issues',
  BLOCKED: 'Blocked',
  IN_PROGRESS: 'In progress',
  IN_REVIEW: 'Developer review',
  READY_FOR_VERIFICATION: 'Ready for verification',
  DONE: 'Done',
};

export const PRIORITY_COLORS: Record<TicketPriority, string> = {
  HIGH: 'bg-priority-high',
  MEDIUM: 'bg-priority-medium',
  LOW: 'bg-priority-low',
};
