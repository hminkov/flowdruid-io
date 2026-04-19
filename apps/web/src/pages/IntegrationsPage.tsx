import { useState, type FormEvent } from 'react';
import { trpc } from '../lib/trpc';
import {
  AlertIcon,
  CheckIcon,
  JiraIcon,
  RefreshIcon,
  SlackIcon,
  SpinnerIcon,
} from '../components/icons';

export function IntegrationsPage() {
  // Slack
  const [slackBotToken, setSlackBotToken] = useState('');
  const [slackSigningSecret, setSlackSigningSecret] = useState('');
  const [slackNotifyStandup, setSlackNotifyStandup] = useState(true);
  const [slackNotifyLeave, setSlackNotifyLeave] = useState(true);
  const [slackNotifyBlocker, setSlackNotifyBlocker] = useState(true);
  const [slackNotifyDone, setSlackNotifyDone] = useState(false);
  const [slackNotifyBroadcast, setSlackNotifyBroadcast] = useState(true);

  // Jira
  const [jiraBaseUrl, setJiraBaseUrl] = useState('');
  const [jiraEmail, setJiraEmail] = useState('');
  const [jiraApiToken, setJiraApiToken] = useState('');
  const [jiraProjectKeys, setJiraProjectKeys] = useState('');
  const [jiraSyncInterval, setJiraSyncInterval] = useState(15);

  const utils = trpc.useUtils();

  const slackConfig = trpc.integrations.getSlackConfig.useQuery();
  const saveSlack = trpc.integrations.saveSlackConfig.useMutation({
    onSuccess: () => utils.integrations.getSlackConfig.invalidate(),
  });
  const testSlack = trpc.integrations.testSlack.useMutation();

  const jiraConfig = trpc.integrations.getJiraConfig.useQuery();
  const saveJira = trpc.integrations.saveJiraConfig.useMutation({
    onSuccess: () => utils.integrations.getJiraConfig.invalidate(),
  });
  const testJira = trpc.integrations.testJira.useMutation();
  const syncJira = trpc.tickets.syncJira.useMutation();

  const handleSaveSlack = (e: FormEvent) => {
    e.preventDefault();
    saveSlack.mutate({
      botToken: slackBotToken,
      signingSecret: slackSigningSecret,
      notifyStandup: slackNotifyStandup,
      notifyLeave: slackNotifyLeave,
      notifyBlocker: slackNotifyBlocker,
      notifyDone: slackNotifyDone,
      notifyBroadcast: slackNotifyBroadcast,
    });
  };

  const handleSaveJira = (e: FormEvent) => {
    e.preventDefault();
    saveJira.mutate({
      baseUrl: jiraBaseUrl,
      email: jiraEmail,
      apiToken: jiraApiToken,
      projectKeys: jiraProjectKeys.split(',').map((k) => k.trim()).filter(Boolean),
      syncInterval: jiraSyncInterval,
    });
  };

  const StatusBadge = ({ connected }: { connected: boolean }) => (
    <span
      className={`inline-flex items-center gap-1.5 rounded-pill px-2 py-0.5 text-xs ${
        connected ? 'bg-success-bg text-success-text' : 'bg-neutral-bg text-neutral-text'
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${connected ? 'bg-success-text' : 'bg-text-tertiary'}`} />
      {connected ? 'Connected' : 'Not configured'}
    </span>
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1>Integrations</h1>
        <p className="mt-1 text-base text-text-secondary">
          Connect Slack for notifications and Jira for ticket sync.
        </p>
      </header>

      {/* Slack */}
      <section className="rounded-lg border border-border bg-surface-primary p-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-accent-bg text-accent-text">
              <SlackIcon className="h-5 w-5" />
            </span>
            <div>
              <h2>Slack</h2>
              <p className="text-xs text-text-tertiary">Standups, leaves, blockers, broadcasts</p>
            </div>
          </div>
          <StatusBadge connected={!!slackConfig.data} />
        </div>

        <form onSubmit={handleSaveSlack} className="space-y-3">
          <input
            value={slackBotToken}
            onChange={(e) => setSlackBotToken(e.target.value)}
            type="password"
            placeholder="Bot token (xoxb-…)"
            required
            className="min-h-input w-full rounded border border-border bg-surface-primary px-3 text-base text-text-primary placeholder:text-text-tertiary"
          />
          <input
            value={slackSigningSecret}
            onChange={(e) => setSlackSigningSecret(e.target.value)}
            type="password"
            placeholder="Signing secret"
            required
            className="min-h-input w-full rounded border border-border bg-surface-primary px-3 text-base text-text-primary placeholder:text-text-tertiary"
          />

          <fieldset className="space-y-2 rounded border border-border bg-surface-secondary p-3">
            <legend className="px-1 text-xs text-text-tertiary">Notifications</legend>
            {[
              ['Standup notifications', slackNotifyStandup, setSlackNotifyStandup],
              ['Leave notifications', slackNotifyLeave, setSlackNotifyLeave],
              ['Blocker notifications', slackNotifyBlocker, setSlackNotifyBlocker],
              ['Ticket done notifications', slackNotifyDone, setSlackNotifyDone],
              ['Broadcast notifications', slackNotifyBroadcast, setSlackNotifyBroadcast],
            ].map(([label, val, set]) => (
              <label key={label as string} className="flex items-center gap-2 text-sm text-text-secondary">
                <input
                  type="checkbox"
                  checked={val as boolean}
                  onChange={(e) => (set as (b: boolean) => void)(e.target.checked)}
                  className="h-4 w-4 rounded accent-brand-600"
                />
                {label as string}
              </label>
            ))}
          </fieldset>

          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={saveSlack.isPending}
              className="flex min-h-input items-center gap-1.5 rounded bg-brand-600 px-3 text-base text-white hover:bg-brand-800 disabled:opacity-60"
            >
              {saveSlack.isPending ? <SpinnerIcon className="h-4 w-4" /> : <CheckIcon className="h-4 w-4" />}
              Save
            </button>
            <button
              type="button"
              onClick={() => testSlack.mutate()}
              disabled={testSlack.isPending}
              className="flex min-h-input items-center gap-1.5 rounded border border-border bg-surface-primary px-3 text-base text-text-secondary hover:bg-surface-secondary hover:text-text-primary disabled:opacity-60"
            >
              {testSlack.isPending ? <SpinnerIcon className="h-4 w-4" /> : <RefreshIcon className="h-4 w-4" />}
              Test connection
            </button>
          </div>

          {testSlack.data && (
            <div className="flex items-center gap-2 rounded border border-success-text/20 bg-success-bg p-2 text-sm text-success-text">
              <CheckIcon className="h-4 w-4" />
              Connected to {testSlack.data.team}
            </div>
          )}
          {testSlack.error && (
            <div className="flex items-start gap-2 rounded border border-danger-text/20 bg-danger-bg p-2 text-sm text-danger-text">
              <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
              {testSlack.error.message}
            </div>
          )}
        </form>
      </section>

      {/* Jira */}
      <section className="rounded-lg border border-border bg-surface-primary p-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-info-bg text-info-text">
              <JiraIcon className="h-5 w-5" />
            </span>
            <div>
              <h2>Jira</h2>
              <p className="text-xs text-text-tertiary">Read-only ticket sync</p>
            </div>
          </div>
          <StatusBadge connected={!!jiraConfig.data} />
        </div>

        <form onSubmit={handleSaveJira} className="space-y-3">
          <input
            value={jiraBaseUrl}
            onChange={(e) => setJiraBaseUrl(e.target.value)}
            placeholder="Base URL (https://yourco.atlassian.net)"
            required
            className="min-h-input w-full rounded border border-border bg-surface-primary px-3 text-base text-text-primary placeholder:text-text-tertiary"
          />
          <input
            value={jiraEmail}
            onChange={(e) => setJiraEmail(e.target.value)}
            type="email"
            placeholder="Jira account email"
            required
            className="min-h-input w-full rounded border border-border bg-surface-primary px-3 text-base text-text-primary placeholder:text-text-tertiary"
          />
          <input
            value={jiraApiToken}
            onChange={(e) => setJiraApiToken(e.target.value)}
            type="password"
            placeholder="API token"
            required
            className="min-h-input w-full rounded border border-border bg-surface-primary px-3 text-base text-text-primary placeholder:text-text-tertiary"
          />
          <input
            value={jiraProjectKeys}
            onChange={(e) => setJiraProjectKeys(e.target.value)}
            placeholder="Project keys (comma-separated: DW, EX, AC, QA)"
            required
            className="min-h-input w-full rounded border border-border bg-surface-primary px-3 text-base text-text-primary placeholder:text-text-tertiary"
          />
          <select
            value={jiraSyncInterval}
            onChange={(e) => setJiraSyncInterval(Number(e.target.value))}
            className="min-h-input w-full rounded border border-border bg-surface-primary px-3 text-base text-text-primary"
          >
            <option value={5}>Sync every 5 minutes</option>
            <option value={15}>Sync every 15 minutes</option>
            <option value={30}>Sync every 30 minutes</option>
            <option value={60}>Sync every 60 minutes</option>
          </select>

          {jiraConfig.data?.lastSyncAt && (
            <p className="text-xs text-text-tertiary">
              Last synced: {new Date(jiraConfig.data.lastSyncAt).toLocaleString()}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={saveJira.isPending}
              className="flex min-h-input items-center gap-1.5 rounded bg-brand-600 px-3 text-base text-white hover:bg-brand-800 disabled:opacity-60"
            >
              {saveJira.isPending ? <SpinnerIcon className="h-4 w-4" /> : <CheckIcon className="h-4 w-4" />}
              Save
            </button>
            <button
              type="button"
              onClick={() => testJira.mutate()}
              disabled={testJira.isPending}
              className="flex min-h-input items-center gap-1.5 rounded border border-border bg-surface-primary px-3 text-base text-text-secondary hover:bg-surface-secondary hover:text-text-primary disabled:opacity-60"
            >
              {testJira.isPending ? <SpinnerIcon className="h-4 w-4" /> : <RefreshIcon className="h-4 w-4" />}
              Test connection
            </button>
            <button
              type="button"
              onClick={() => syncJira.mutate({})}
              disabled={syncJira.isPending}
              className="flex min-h-input items-center gap-1.5 rounded border border-border bg-surface-primary px-3 text-base text-text-secondary hover:bg-surface-secondary hover:text-text-primary disabled:opacity-60"
            >
              {syncJira.isPending ? <SpinnerIcon className="h-4 w-4" /> : <RefreshIcon className="h-4 w-4" />}
              {syncJira.isPending ? 'Syncing…' : 'Sync now'}
            </button>
          </div>

          {testJira.data && (
            <div className="flex items-center gap-2 rounded border border-success-text/20 bg-success-bg p-2 text-sm text-success-text">
              <CheckIcon className="h-4 w-4" />
              Connected. Projects: {testJira.data.projects.map((p) => p.key).join(', ')}
            </div>
          )}
          {testJira.error && (
            <div className="flex items-start gap-2 rounded border border-danger-text/20 bg-danger-bg p-2 text-sm text-danger-text">
              <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
              {testJira.error.message}
            </div>
          )}
        </form>
      </section>
    </div>
  );
}
