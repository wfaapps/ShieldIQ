import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#ffffff',
        surface: '#ffffff',
        'surface-2': '#f8fafc',
        border: '#e2e8f0',
        accent: 'var(--accent)',
        'accent-hover': 'var(--accent-hover)',
        muted: '#64748b',
        'muted-light': '#475569',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}

export default config
