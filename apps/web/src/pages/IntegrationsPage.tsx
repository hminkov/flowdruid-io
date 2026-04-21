import { useEffect, useState, type FormEvent } from 'react';
import { trpc } from '../lib/trpc';
import { useToast } from '../components/ui';
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
  // When already connected, default to read-only creds + toggle-only
  // saves. The admin has to click Edit to reveal the token inputs.
  const [slackEditCreds, setSlackEditCreds] = useState(false);

  // Jira
  const [jiraBaseUrl, setJiraBaseUrl] = useState('');
  const [jiraEmail, setJiraEmail] = useState('');
  const [jiraApiToken, setJiraApiToken] = useState('');
  const [jiraProjectKeys, setJiraProjectKeys] = useState('');
  const [jiraSyncInterval, setJiraSyncInterval] = useState(15);
  const [jiraEditCreds, setJiraEditCreds] = useState(false);

  const utils = trpc.useUtils();
  const toast = useToast();

  // Which Jira projects are ticked when the multi-select is visible.
  // Populated from the testJira result; falls back to the manual text input below.
  const [selectedJiraProjects, setSelectedJiraProjects] = useState<string[]>([]);

  const slackConfig = trpc.integrations.getSlackConfig.useQuery();
  const saveSlack = trpc.integrations.saveSlackConfig.useMutation({
    onSuccess: () => {
      utils.integrations.getSlackConfig.invalidate();
      setSlackEditCreds(false);
      setSlackBotToken('');
      setSlackSigningSecret('');
      toast.push({ kind: 'success', title: 'Slack config saved' });
    },
    onError: (err) => toast.push({ kind: 'error', title: 'Save failed', message: err.message }),
  });
  const testSlack = trpc.integrations.testSlack.useMutation({
    onError: (err) => toast.push({ kind: 'error', title: 'Test failed', message: err.message }),
  });

  const jiraConfig = trpc.integrations.getJiraConfig.useQuery();
  const saveJira = trpc.integrations.saveJiraConfig.useMutation({
    onSuccess: () => {
      utils.integrations.getJiraConfig.invalidate();
      setJiraEditCreds(false);
      setJiraApiToken('');
      toast.push({ kind: 'success', title: 'Jira config saved' });
    },
    onError: (err) => toast.push({ kind: 'error', title: 'Save failed', message: err.message }),
  });
  const testJira = trpc.integrations.testJira.useMutation({
    onError: (err) => toast.push({ kind: 'error', title: 'Test failed', message: err.message }),
  });
  const syncJira = trpc.tickets.syncJira.useMutation({
    onSuccess: () => toast.push({ kind: 'success', title: 'Jira sync complete' }),
    onError: (err) => toast.push({ kind: 'error', title: 'Sync failed', message: err.message }),
  });

  // When a testJira result comes in, preselect any keys the user already had saved.
  useEffect(() => {
    if (testJira.data && selectedJiraProjects.length === 0) {
      const existing = jiraConfig.data?.projectKeys ?? [];
      setSelectedJiraProjects(existing);
    }
  }, [testJira.data, jiraConfig.data?.projectKeys]);

  // Hydrate editable toggles + Jira non-secret fields from the saved
  // config. Runs each time the query returns fresh data (e.g. after save
  // invalidation). Does NOT touch token fields — those stay blank in
  // edit mode; the server-returned mask is shown separately when not.
  useEffect(() => {
    if (slackConfig.data) {
      setSlackNotifyStandup(slackConfig.data.notifyStandup);
      setSlackNotifyLeave(slackConfig.data.notifyLeave);
      setSlackNotifyBlocker(slackConfig.data.notifyBlocker);
      setSlackNotifyDone(slackConfig.data.notifyDone);
      setSlackNotifyBroadcast(slackConfig.data.notifyBroadcast);
    }
  }, [slackConfig.data]);

  useEffect(() => {
    if (jiraConfig.data) {
      setJiraBaseUrl(jiraConfig.data.baseUrl);
      setJiraEmail(jiraConfig.data.email);
      setJiraSyncInterval(jiraConfig.data.syncInterval);
      setJiraProjectKeys(jiraConfig.data.projectKeys.join(', '));
    }
  }, [jiraConfig.data]);

  const handleSaveSlack = (e: FormEvent) => {
    e.preventDefault();
    // Only include token fields when the admin is actively editing
    // credentials. Sending them blank on every toggle change would wipe
    // the saved values.
    const sendingCreds = slackEditCreds || !slackConfig.data;
    saveSlack.mutate({
      ...(sendingCreds ? { botToken: slackBotToken, signingSecret: slackSigningSecret } : {}),
      notifyStandup: slackNotifyStandup,
      notifyLeave: slackNotifyLeave,
      notifyBlocker: slackNotifyBlocker,
      notifyDone: slackNotifyDone,
      notifyBroadcast: slackNotifyBroadcast,
    });
  };

  const handleSaveJira = (e: FormEvent) => {
    e.preventDefault();
    // Prefer the checkbox selection when we have a live project list; fall back to the text input.
    const effectiveKeys =
      testJira.data && selectedJiraProjects.length > 0
        ? selectedJiraProjects
        : jiraProjectKeys
            .split(',')
            .map((k) => k.trim())
            .filter(Boolean);

    const sendingToken = jiraEditCreds || !jiraConfig.data;
    saveJira.mutate({
      baseUrl: jiraBaseUrl,
      email: jiraEmail,
      ...(sendingToken ? { apiToken: jiraApiToken } : {}),
      projectKeys: effectiveKeys,
      syncInterval: jiraSyncInterval,
    });
  };

  const toggleJiraProject = (key: string) => {
    setSelectedJiraProjects((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
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
          {slackConfig.data && !slackEditCreds ? (
            <div className="space-y-2 rounded border border-border bg-surface-secondary p-3">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-text-tertiary">Bot token</p>
                  <p className="truncate font-mono text-sm text-text-primary">
                    {slackConfig.data.botToken}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSlackEditCreds(true)}
                  className="ml-2 shrink-0 rounded border border-border bg-surface-primary px-3 py-1 text-xs text-text-secondary hover:text-text-primary"
                >
                  Edit credentials
                </button>
              </div>
              <div>
                <p className="text-xs text-text-tertiary">Signing secret</p>
                <p className="truncate font-mono text-sm text-text-primary">
                  {slackConfig.data.signingSecret}
                </p>
              </div>
            </div>
          ) : (
            <>
              <input
                value={slackBotToken}
                onChange={(e) => setSlackBotToken(e.target.value)}
                type="password"
                placeholder="Bot token (xoxb-…)"
                required
                autoFocus={slackEditCreds}
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
              {slackEditCreds && slackConfig.data && (
                <button
                  type="button"
                  onClick={() => {
                    setSlackEditCreds(false);
                    setSlackBotToken('');
                    setSlackSigningSecret('');
                  }}
                  className="text-xs text-text-secondary underline-offset-2 hover:text-text-primary hover:underline"
                >
                  Cancel — keep existing credentials
                </button>
              )}
            </>
          )}

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
          {jiraConfig.data && !jiraEditCreds ? (
            <div className="flex items-center justify-between rounded border border-border bg-surface-secondary p-3">
              <div className="min-w-0 flex-1">
                <p className="text-xs text-text-tertiary">API token</p>
                <p className="truncate font-mono text-sm text-text-primary">
                  {jiraConfig.data.apiToken}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setJiraEditCreds(true)}
                className="ml-2 shrink-0 rounded border border-border bg-surface-primary px-3 py-1 text-xs text-text-secondary hover:text-text-primary"
              >
                Edit token
              </button>
            </div>
          ) : (
            <>
              <input
                value={jiraApiToken}
                onChange={(e) => setJiraApiToken(e.target.value)}
                type="password"
                placeholder="API token"
                required
                autoFocus={jiraEditCreds}
                className="min-h-input w-full rounded border border-border bg-surface-primary px-3 text-base text-text-primary placeholder:text-text-tertiary"
              />
              {jiraEditCreds && jiraConfig.data && (
                <button
                  type="button"
                  onClick={() => {
                    setJiraEditCreds(false);
                    setJiraApiToken('');
                  }}
                  className="text-xs text-text-secondary underline-offset-2 hover:text-text-primary hover:underline"
                >
                  Cancel — keep existing token
                </button>
              )}
            </>
          )}
          {testJira.data ? (
            <fieldset className="rounded border border-border bg-surface-secondary p-3">
              <legend className="px-1 text-xs text-text-tertiary">
                Projects to sync ({selectedJiraProjects.length} of {testJira.data.projects.length})
              </legend>
              <div className="max-h-44 space-y-1 overflow-y-auto">
                {testJira.data.projects.map((p) => (
                  <label
                    key={p.key}
                    className="flex items-center gap-2 rounded p-1 text-sm text-text-secondary hover:bg-surface-primary"
                  >
                    <input
                      type="checkbox"
                      checked={selectedJiraProjects.includes(p.key)}
                      onChange={() => toggleJiraProject(p.key)}
                      className="h-4 w-4 rounded accent-brand-600"
                    />
                    <span className="font-mono text-xs text-text-primary">{p.key}</span>
                    <span className="truncate text-text-tertiary">{p.name ?? ''}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          ) : (
            <input
              value={jiraProjectKeys}
              onChange={(e) => setJiraProjectKeys(e.target.value)}
              placeholder="Project keys (comma-separated: DW, EX, AC, QA) — or hit Test connection to pick from a list"
              className="min-h-input w-full rounded border border-border bg-surface-primary px-3 text-base text-text-primary placeholder:text-text-tertiary"
            />
          )}
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
