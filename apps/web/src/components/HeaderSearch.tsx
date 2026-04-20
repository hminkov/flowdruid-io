import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { trpc } from '../lib/trpc';
import { useUserDetail } from '../hooks/useUserDetail';
import { SearchIcon, TeamsIcon, BriefcaseIcon } from './icons';

const avatarPalettes = [
  { bg: 'var(--avatar-1-bg)', text: 'var(--avatar-1-text)' },
  { bg: 'var(--avatar-2-bg)', text: 'var(--avatar-2-text)' },
  { bg: 'var(--avatar-3-bg)', text: 'var(--avatar-3-text)' },
  { bg: 'var(--avatar-4-bg)', text: 'var(--avatar-4-text)' },
  { bg: 'var(--avatar-5-bg)', text: 'var(--avatar-5-text)' },
  { bg: 'var(--avatar-6-bg)', text: 'var(--avatar-6-text)' },
];

const paletteFor = (id: string) => {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return avatarPalettes[Math.abs(hash) % avatarPalettes.length]!;
};

export function HeaderSearch() {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const { openUser } = useUserDetail();
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const teamsQuery = trpc.teams.list.useQuery();
  const ticketsQuery = trpc.tickets.list.useQuery({});

  const q = query.trim().toLowerCase();

  const memberResults = useMemo(() => {
    if (!q) return [];
    return (teamsQuery.data ?? [])
      .flatMap((team) => team.members.map((m) => ({ ...m, teamName: team.name })))
      .filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.initials.toLowerCase().includes(q) ||
          m.teamName.toLowerCase().includes(q)
      )
      .slice(0, 6);
  }, [teamsQuery.data, q]);

  const ticketResults = useMemo(() => {
    if (!q) return [];
    return (ticketsQuery.data ?? [])
      .filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          (t.jiraKey ?? '').toLowerCase().includes(q) ||
          (t.description ?? '').toLowerCase().includes(q)
      )
      .slice(0, 5);
  }, [ticketsQuery.data, q]);

  const total = memberResults.length + ticketResults.length;

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // ⌘K / Ctrl-K focus
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === 'Escape' && document.activeElement === inputRef.current) {
        inputRef.current?.blur();
        setOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleMemberClick = (id: string) => {
    openUser(id);
    setOpen(false);
    setQuery('');
  };

  const handleTicketClick = () => {
    navigate('/tasks');
    setOpen(false);
    setQuery('');
  };

  const shortcut = navigator.platform.toLowerCase().includes('mac') ? '⌘K' : 'Ctrl+K';

  return (
    <div ref={containerRef} className="relative w-full max-w-sm">
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-tertiary" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search people or tickets"
          data-shortcut="search"
          className="w-full rounded-pill border border-border bg-surface-secondary py-1.5 pl-8 pr-12 text-sm text-text-primary placeholder:text-text-tertiary focus:border-brand-500 focus:bg-surface-primary"
        />
        <kbd className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 rounded border border-border bg-surface-primary px-1.5 py-0.5 text-[10px] text-text-tertiary sm:block">
          {shortcut}
        </kbd>
      </div>

      {open && (q.length > 0 || total > 0) && (
        <div className="absolute left-0 right-0 top-full z-dropdown mt-1 overflow-hidden rounded-lg border border-border bg-surface-primary shadow-float">
          {total === 0 && q.length > 0 && (
            <div className="p-3 text-center text-sm text-text-tertiary">
              No matches for "{query}"
            </div>
          )}

          {memberResults.length > 0 && (
            <div>
              <div className="border-b border-border bg-surface-secondary px-3 py-1 text-[10px] uppercase tracking-widest text-text-tertiary">
                People
              </div>
              {memberResults.map((m) => {
                const palette = paletteFor(m.id);
                return (
                  <button
                    key={m.id}
                    onClick={() => handleMemberClick(m.id)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-surface-secondary"
                  >
                    <span
                      className="flex h-6 w-6 items-center justify-center rounded-full text-xs"
                      style={{ background: palette.bg, color: palette.text }}
                    >
                      {m.initials}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm text-text-primary">
                      {m.name}
                    </span>
                    <span className="text-xs text-text-tertiary">{m.teamName}</span>
                  </button>
                );
              })}
            </div>
          )}

          {ticketResults.length > 0 && (
            <div>
              <div className="border-b border-t border-border bg-surface-secondary px-3 py-1 text-[10px] uppercase tracking-widest text-text-tertiary">
                Tickets
              </div>
              {ticketResults.map((t) => (
                <button
                  key={t.id}
                  onClick={handleTicketClick}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-surface-secondary"
                >
                  <BriefcaseIcon className="h-3.5 w-3.5 shrink-0 text-text-tertiary" />
                  <span
                    className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] ${
                      t.source === 'JIRA'
                        ? 'bg-info-bg text-info-text'
                        : 'bg-neutral-bg text-neutral-text'
                    }`}
                  >
                    {t.jiraKey || `INT-${t.id.slice(-4)}`}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm text-text-primary">
                    {t.title}
                  </span>
                </button>
              ))}
            </div>
          )}

          {q.length === 0 && total === 0 && (
            <div className="flex items-center gap-2 p-3 text-xs text-text-tertiary">
              <TeamsIcon className="h-3.5 w-3.5" />
              Start typing to search teammates and tickets
            </div>
          )}
        </div>
      )}
    </div>
  );
}
