/*
 * Flowdruid — Tailwind Config
 * apps/web/tailwind.config.ts
 *
 * Maps CSS custom properties from tokens.css into Tailwind utility classes.
 * This file is the bridge between raw design tokens and class-based usage
 * in components.
 *
 * Usage examples:
 *   <div class="bg-brand-600 text-white">          → primary button
 *   <div class="bg-surface-secondary border">      → subtle card
 *   <span class="text-success-text bg-success-bg"> → success badge
 *   <p class="text-base text-text-secondary">      → body text
 */

import type { Config } from 'tailwindcss';

export default {
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
  ],
  darkMode: 'class', // manual toggle via `.dark` on <html>; tokens.css keeps the media-query fallback
  theme: {
    extend: {
      colors: {
        // ─── Brand ─────────────────────────────────────────────────────
        brand: {
          50:  'var(--brand-50)',
          100: 'var(--brand-100)',
          500: 'var(--brand-500)',
          600: 'var(--brand-600)',
          800: 'var(--brand-800)',
          900: 'var(--brand-900)',
        },

        // ─── Surfaces ──────────────────────────────────────────────────
        surface: {
          primary:   'var(--surface-primary)',
          secondary: 'var(--surface-secondary)',
          tertiary:  'var(--surface-tertiary)',
        },

        // ─── Borders ───────────────────────────────────────────────────
        border: {
          DEFAULT: 'var(--border-default)',
          strong:  'var(--border-strong)',
        },

        // ─── Text ──────────────────────────────────────────────────────
        text: {
          primary:   'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          tertiary:  'var(--text-tertiary)',
        },

        // ─── Semantic tones (bg + text always used as a pair) ─────────
        success: {
          bg:   'var(--success-bg)',
          text: 'var(--success-text)',
        },
        warning: {
          bg:   'var(--warning-bg)',
          text: 'var(--warning-text)',
        },
        danger: {
          bg:   'var(--danger-bg)',
          text: 'var(--danger-text)',
        },
        info: {
          bg:   'var(--info-bg)',
          text: 'var(--info-text)',
        },
        accent: {
          bg:   'var(--accent-bg)',
          text: 'var(--accent-text)',
        },
        neutral: {
          bg:   'var(--neutral-bg)',
          text: 'var(--neutral-text)',
        },

        // ─── Priority dots ─────────────────────────────────────────────
        priority: {
          high:   'var(--priority-high)',
          medium: 'var(--priority-medium)',
          low:    'var(--priority-low)',
        },

        // ─── Capacity bar thresholds ──────────────────────────────────
        capacity: {
          normal: 'var(--capacity-normal)',
          high:   'var(--capacity-high)',
          full:   'var(--capacity-full)',
        },
      },

      fontFamily: {
        sans: [
          '"Inter Variable"',
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'sans-serif',
        ],
      },

      fontSize: {
        'xs':   ['11px', { lineHeight: '1.4',  fontWeight: '400' }],
        'sm':   ['12px', { lineHeight: '1.5',  fontWeight: '400' }],
        'base': ['13px', { lineHeight: '1.5',  fontWeight: '400' }],
        'md':   ['14px', { lineHeight: '1.5',  fontWeight: '500' }],
        'lg':   ['15px', { lineHeight: '1.4',  fontWeight: '500' }],
        'xl':   ['18px', { lineHeight: '1.3',  fontWeight: '500' }],
        '2xl':  ['22px', { lineHeight: '1.2',  fontWeight: '500' }],
      },

      fontWeight: {
        normal: '400',
        medium: '500',
        // deliberately omitted: bold (600/700) — the design system uses only 400 and 500
      },

      borderRadius: {
        'sm':      'var(--radius-sm)',
        DEFAULT:   'var(--radius-default)',
        'md':      'var(--radius-md)',
        'lg':      'var(--radius-lg)',
        'pill':    'var(--radius-pill)',
      },

      borderWidth: {
        DEFAULT: '0.5px',
        '0':   '0',
        '1':   '1px',
        '2':   '2px',
      },

      boxShadow: {
        float: 'var(--shadow-float)',
        none:  'none',
      },

      spacing: {
        // 8-point grid — restrict auto-complete to our allowed values
        '0':   '0',
        '1':   '4px',
        '2':   '8px',
        '3':   '12px',
        '4':   '16px',
        '5':   '20px',
        '6':   '24px',
        '8':   '32px',
        '12':  '48px',
        '16':  '64px',
      },

      maxWidth: {
        'content': '1400px',
        'modal':   '500px',
        'card':    '420px',
        'drawer':  '480px',
      },

      minHeight: {
        'cal-cell': '72px',
        'input':    '36px',
      },

      transitionTimingFunction: {
        'out-quart': 'cubic-bezier(0.16, 1, 0.3, 1)',
        'in-out':    'cubic-bezier(0.4, 0, 0.2, 1)',
      },

      transitionDuration: {
        'fast':    '120ms',
        'default': '200ms',
        'slow':    '400ms',
      },

      animation: {
        'skeleton':  'skeleton-pulse 1500ms ease-in-out infinite',
        'fade-in':   'fade-in 200ms cubic-bezier(0.16, 1, 0.3, 1)',
        'fade-out':  'fade-out 120ms cubic-bezier(0.4, 0, 0.2, 1)',
        'modal-in':  'modal-in 200ms cubic-bezier(0.16, 1, 0.3, 1)',
        'modal-out': 'modal-out 150ms cubic-bezier(0.4, 0, 0.2, 1)',
        'toast-in':  'toast-in 250ms cubic-bezier(0.16, 1, 0.3, 1)',
        'toast-out': 'toast-out 150ms cubic-bezier(0.4, 0, 0.2, 1)',
        'spin':      'spin 600ms linear infinite',
      },

      zIndex: {
        'base':     '0',
        'dropdown': '100',
        'sticky':   '200',
        'drawer':   '300',
        'modal':    '400',
        'toast':    '500',
      },
    },
  },
  plugins: [
    // We deliberately avoid @tailwindcss/forms — it conflicts with our own
    // form-element styling. Every form control has its style defined in
    // globals.css or via component classes.
  ],
} satisfies Config;
