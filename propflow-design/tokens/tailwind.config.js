/**
 * PropFlow Tailwind preset.
 * Usage in tailwind.config.js:  presets: [require('./design/tokens/tailwind.config.js')]
 */
module.exports = {
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: '#06C755' },
        primary: { DEFAULT: '#047C3B', hover: '#035E2D', soft: '#E7F8EE' },
        hero: '#0F3D25',
        sidebar: { DEFAULT: '#0F2A1C', admin: '#1E1638' },
        ink: { DEFAULT: '#0F1F17', 2: '#33403A' },
        muted: '#4F5F57',
        placeholder: '#9AA8A1',
        canvas: '#F4F6F5',
        surface: { DEFAULT: '#FFFFFF', 2: '#F0F2F1' },
        segment: '#E8ECEA',
        line: { DEFAULT: '#DCE3DF', soft: '#EEF1EF', input: '#C9D2CD' },
        info: { fg: '#1A4FBF', bg: '#EAF1FE' },
        warn: { fg: '#8A4B05', bg: '#FEF3E2', strong: '#B26A00', chart: '#E3A13B' },
        ok: { fg: '#046A33', bg: '#E7F8EE' },
        danger: { fg: '#A8221A', bg: '#FDECEA' },
        neutral: { fg: '#4A5550', bg: '#F0F2F1' },
        admin: { fg: '#5A3496', bg: '#F1ECFA' },
      },
      fontFamily: {
        display: ['Anuphan', 'Sarabun', 'system-ui', 'sans-serif'],
        sans: ['Sarabun', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        // [size, lineHeight]
        caption: ['13px', '18px'],
        label: ['14px', '20px'],
        body: ['16px', '26px'],
        title: ['22px', '30px'],
        display: ['32px', '40px'],
        amount: ['38px', '44px'],
      },
      borderRadius: {
        input: '10px',
        button: '12px',
        cta: '14px',
        card: '16px',
        hero: '20px',
      },
      spacing: {
        appbar: '56px',
        tabbar: '82px',
        'btn-m': '52px',
        'btn-d': '44px',
      },
      maxWidth: { liff: '430px' },
      boxShadow: {
        fab: '0 6px 16px rgba(4,124,59,0.30)',
        paper: '0 2px 10px rgba(15,31,23,0.10)',
      },
    },
  },
};
