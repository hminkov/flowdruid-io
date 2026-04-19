import { useTheme, type ThemePreference } from '../hooks/useTheme';

const SunIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
  </svg>
);

const MoonIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
  </svg>
);

const SystemIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
    <rect x="2" y="3" width="20" height="14" rx="2" />
    <path d="M8 21h8M12 17v4" />
  </svg>
);

const label: Record<ThemePreference, string> = {
  light: 'Light',
  dark: 'Dark',
  system: 'System',
};

export function ThemeToggle() {
  const { preference, cycle } = useTheme();

  const Icon = preference === 'light' ? SunIcon : preference === 'dark' ? MoonIcon : SystemIcon;
  const nextLabel =
    preference === 'light' ? 'dark' : preference === 'dark' ? 'system' : 'light';

  return (
    <button
      onClick={cycle}
      title={`Theme: ${label[preference]} (click for ${nextLabel})`}
      aria-label={`Switch theme, currently ${label[preference]}`}
      className="flex items-center gap-2 rounded border border-border bg-surface-primary px-2 py-1 text-xs text-text-secondary transition-colors duration-fast hover:border-border-strong hover:bg-surface-secondary hover:text-text-primary"
    >
      <Icon />
      <span className="hidden sm:inline">{label[preference]}</span>
    </button>
  );
}
