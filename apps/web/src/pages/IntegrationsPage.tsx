import { useState, type FormEvent } from 'react';
import { trpc } from '../lib/trpc';

export function IntegrationsPage() {
  // Slack state
  const [slackBotToken, setSlackBotToken] = useState('');
  const [slackSigningSecret, setSlackSigningSecret] = useState('');
  const [slackNotifyStandup, setSlackNotifyStandup] = useState(true);
  const [slackNotifyLeave, setSlackNotifyLeave] = useState(true);
  const [slackNotifyBlocker, setSlackNotifyBlocker] = useState(true);
  const [slackNotifyDone, setSlackNotifyDone] = useState(false);
  const [slackNotifyBroadcast, setSlackNotifyBroadcast] = useState(true);

  // Jira state
  const [jiraBaseUrl, setJiraBaseUrl] = useState('');
  const [jiraEmail, setJiraEmail] = useState('');
  const [jiraApiToken, setJiraApiToken] = useState('');
  const [jiraProjectKeys, setJiraProjectKeys] = useState('');
  const [jiraSyncInterval, setJiraSyncInterval] = useState(15);

  const utils = trpc.useUtils();

  // Slack queries/mutations
  const slackConfig = trpc.integrations.getSlackConfig.useQuery();
  const saveSlack = trpc.integrations.saveSlackConfig.useMutation({
    onSuccess: () => utils.integrations.getSlackConfig.invalidate(),
  });
  const testSlack = trpc.integrations.testSlack.useMutation();

  // Jira queries/mutations
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

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <h1 className="text-2xl font-bold">Integrations</h1>

      {/* Slack */}
      <section className="rounded-lg border bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Slack</h2>
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            slackConfig.data ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
          }`}>
            {slackConfig.data ? 'Connected' : 'Not configured'}
          </span>
        </div>
        <form onSubmit={handleSaveSlack} className="space-y-3">
          <input value={slackBotToken} onChange={(e) => setSlackBotToken(e.target.value)} type="password" placeholder="Bot Token" required className="w-full rounded border px-3 py-2 text-sm" />
          <input value={slackSigningSecret} onChange={(e) => setSlackSigningSecret(e.target.value)} type="password" placeholder="Signing Secret" required className="w-full rounded border px-3 py-2 text-sm" />
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={slackNotifyStandup} onChange={(e) => setSlackNotifyStandup(e.target.checked)} /> Standup notifications</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={slackNotifyLeave} onChange={(e) => setSlackNotifyLeave(e.target.checked)} /> Leave notifications</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={slackNotifyBlocker} onChange={(e) => setSlackNotifyBlocker(e.target.checked)} /> Blocker notifications</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={slackNotifyDone} onChange={(e) => setSlackNotifyDone(e.target.checked)} /> Ticket done notifications</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={slackNotifyBroadcast} onChange={(e) => setSlackNotifyBroadcast(e.target.checked)} /> Broadcast notifications</label>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={saveSlack.isPending} className="rounded bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700">Save</button>
            <button type="button" onClick={() => testSlack.mutate()} disabled={testSlack.isPending} className="rounded border px-3 py-1.5 text-sm">Test Connection</button>
          </div>
          {testSlack.data && <p className="text-sm text-green-600">Connected to {testSlack.data.team}</p>}
          {testSlack.error && <p className="text-sm text-red-600">{testSlack.error.message}</p>}
        </form>
      </section>

      {/* Jira */}
      <section className="rounded-lg border bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Jira</h2>
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            jiraConfig.data ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
          }`}>
            {jiraConfig.data ? 'Connected' : 'Not configured'}
          </span>
        </div>
        <form onSubmit={handleSaveJira} className="space-y-3">
          <input value={jiraBaseUrl} onChange={(e) => setJiraBaseUrl(e.target.value)} placeholder="Base URL (e.g. https://yourco.atlassian.net)" required className="w-full rounded border px-3 py-2 text-sm" />
          <input value={jiraEmail} onChange={(e) => setJiraEmail(e.target.value)} type="email" placeholder="Jira Account Email" required className="w-full rounded border px-3 py-2 text-sm" />
          <input value={jiraApiToken} onChange={(e) => setJiraApiToken(e.target.value)} type="password" placeholder="API Token" required className="w-full rounded border px-3 py-2 text-sm" />
          <input value={jiraProjectKeys} onChange={(e) => setJiraProjectKeys(e.target.value)} placeholder="Project keys (comma-separated, e.g. FD, OPS)" required className="w-full rounded border px-3 py-2 text-sm" />
          <select value={jiraSyncInterval} onChange={(e) => setJiraSyncInterval(Number(e.target.value))} className="w-full rounded border px-3 py-2 text-sm">
            <option value={5}>Every 5 minutes</option>
            <option value={15}>Every 15 minutes</option>
            <option value={30}>Every 30 minutes</option>
            <option value={60}>Every 60 minutes</option>
          </select>
          {jiraConfig.data?.lastSyncAt && (
            <p className="text-xs text-gray-500">Last synced: {new Date(jiraConfig.data.lastSyncAt).toLocaleString()}</p>
          )}
          <div className="flex gap-2">
            <button type="submit" disabled={saveJira.isPending} className="rounded bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700">Save</button>
            <button type="button" onClick={() => testJira.mutate()} disabled={testJira.isPending} className="rounded border px-3 py-1.5 text-sm">Test Connection</button>
            <button type="button" onClick={() => syncJira.mutate({})} disabled={syncJira.isPending} className="rounded border px-3 py-1.5 text-sm">{syncJira.isPending ? 'Syncing...' : 'Sync Now'}</button>
          </div>
          {testJira.data && (
            <div className="text-sm text-green-600">
              Connected. Projects: {testJira.data.projects.map((p) => p.key).join(', ')}
            </div>
          )}
          {testJira.error && <p className="text-sm text-red-600">{testJira.error.message}</p>}
        </form>
      </section>
    </div>
  );
}
