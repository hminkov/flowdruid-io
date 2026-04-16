import { Queue } from 'bullmq';
import { redis } from './redis';

export const slackQueue = new Queue('slack-notifications', { connection: redis });
export const jiraQueue = new Queue('jira-sync', { connection: redis });
export const leaveQueue = new Queue('leave-reminders', { connection: redis });
