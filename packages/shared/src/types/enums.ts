export const Role = {
  ADMIN: 'ADMIN',
  TEAM_LEAD: 'TEAM_LEAD',
  DEVELOPER: 'DEVELOPER',
} as const;
export type Role = (typeof Role)[keyof typeof Role];

export const LeaveType = {
  ANNUAL: 'ANNUAL',
  PARTIAL_AM: 'PARTIAL_AM',
  PARTIAL_PM: 'PARTIAL_PM',
  REMOTE: 'REMOTE',
  SICK: 'SICK',
} as const;
export type LeaveType = (typeof LeaveType)[keyof typeof LeaveType];

export const LeaveStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  DENIED: 'DENIED',
} as const;
export type LeaveStatus = (typeof LeaveStatus)[keyof typeof LeaveStatus];

export const TicketStatus = {
  TODO: 'TODO',
  BLOCKED: 'BLOCKED',
  IN_PROGRESS: 'IN_PROGRESS',
  IN_REVIEW: 'IN_REVIEW',
  READY_FOR_VERIFICATION: 'READY_FOR_VERIFICATION',
  DONE: 'DONE',
} as const;
export type TicketStatus = (typeof TicketStatus)[keyof typeof TicketStatus];

export const TicketPriority = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
} as const;
export type TicketPriority = (typeof TicketPriority)[keyof typeof TicketPriority];

export const TicketSource = {
  INTERNAL: 'INTERNAL',
  JIRA: 'JIRA',
} as const;
export type TicketSource = (typeof TicketSource)[keyof typeof TicketSource];

export const AvailabilityStatus = {
  AVAILABLE: 'AVAILABLE',
  BUSY: 'BUSY',
  REMOTE: 'REMOTE',
  ON_LEAVE: 'ON_LEAVE',
} as const;
export type AvailabilityStatus = (typeof AvailabilityStatus)[keyof typeof AvailabilityStatus];
