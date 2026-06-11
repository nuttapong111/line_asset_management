import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        line: {
          DEFAULT: '#06C755',
          dark: '#04A244',
          light: '#EAF3DE',
        },
        amber: { DEFAULT: '#EF9F27' },
        danger: { DEFAULT: '#E24B4A' },
        info: { DEFAULT: '#185FA5' },
      },
      fontFamily: {
        sans: ['Sarabun', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config
