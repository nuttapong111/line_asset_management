import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: '#06C755',
        primary: { DEFAULT: '#047C3B', hover: '#035E2D', soft: '#E7F8EE' },
        hero: '#0F3D25',
        sidebar: { DEFAULT: '#0F2A1C', admin: '#1E1638' },
        ink: { DEFAULT: '#0F1F17', 2: '#33403A' },
        muted: '#4F5F57',
        placeholder: '#9AA8A1',
        canvas: '#F4F6F5',
        surface: { DEFAULT: '#FFFFFF', 2: '#F0F2F1' },
        segment: '#E8ECEA',
        line: {
          DEFAULT: '#047C3B',
          dark: '#035E2D',
          light: '#E7F8EE',
          soft: '#EEF1EF',
          input: '#C9D2CD',
          brand: '#06C755',
        },
        amber: { DEFAULT: '#8A4B05' },
        danger: { DEFAULT: '#A8221A', bg: '#FDECEA' },
        info: { DEFAULT: '#1A4FBF', bg: '#EAF1FE' },
        ok: { fg: '#046A33', bg: '#E7F8EE' },
        warn: { fg: '#8A4B05', bg: '#FEF3E2', chart: '#E3A13B' },
        neutral: { fg: '#4A5550', bg: '#F0F2F1' },
        admin: { fg: '#5A3496', bg: '#F1ECFA' },
      },
      fontFamily: {
        display: ['Anuphan', 'Sarabun', 'sans-serif'],
        sans: ['Sarabun', 'sans-serif'],
      },
      borderRadius: {
        input: '10px',
        button: '12px',
        cta: '14px',
        card: '16px',
        hero: '20px',
      },
      maxWidth: { liff: '430px' },
      boxShadow: {
        fab: '0 6px 16px rgba(4,124,59,0.30)',
        paper: '0 2px 10px rgba(15,31,23,0.10)',
      },
    },
  },
  plugins: [],
} satisfies Config
