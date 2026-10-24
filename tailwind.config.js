/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: ["class"],
  theme: {
    extend: {
      colors: {
        app: {
          bg:             'var(--bg-app)',
          surface:        'var(--bg-surface)',
          hover:          'var(--bg-surface-hover)',
          border:         'var(--border-subtle)',
          'border-strong':'var(--border-strong)',
        },
        brand: {
          primary: 'var(--brand-primary)',
          hover:   'var(--brand-primary-hover)',
          accent:  'var(--brand-accent)',
        },
        status: {
          success: 'var(--status-success)',
          warning: 'var(--status-warning)',
          error:   'var(--status-error)',
        },
        text: {
          primary:   'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          muted:     'var(--text-muted)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['Geist Mono', 'JetBrains Mono', 'Menlo', 'monospace'],
      },
      borderRadius: {
        '4xl': '2rem',
        '5xl': '2.5rem',
      },
      boxShadow: {
        'glow-primary': 'var(--primary-glow)',
        'glow-emerald': 'var(--emerald-glow)',
        'glow-violet':  'var(--violet-glow)',
      },
    },
  },
  plugins: [],
}
