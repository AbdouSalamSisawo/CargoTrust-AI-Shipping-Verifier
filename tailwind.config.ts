import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['"Space Grotesk"', 'Inter', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        navy: { 50: '#F2F6FB', 100: '#E2EBF5', 200: '#C2D6EA', 300: '#93B4D6', 400: '#5F8BBD', 500: '#3D6AA1', 600: '#2B5284', 700: '#23426B', 800: '#1B3554', 900: '#132A46', 950: '#0A1A2F' },
        ink: { 900: '#0B1526', 800: '#12203A', 700: '#1B2E4F', 600: '#274067', 500: '#3B5478', 400: '#5E7398', 300: '#8C9DB8', 200: '#C0CBDC', 100: '#E2E8F2', 50: '#F4F7FB' },
        brand: { 50: '#EEF4FF', 100: '#DFEAFF', 200: '#C5D7FE', 300: '#A2BBFC', 400: '#7F97F8', 500: '#2563EB', 600: '#1D4ED8', 700: '#1E40AF', 800: '#1E3A8A', 900: '#172E6E' },
        aqua: { 50: '#ECFEFF', 100: '#CFFAFE', 300: '#67E8F9', 400: '#22D3EE', 500: '#06B6D4', 600: '#0891B2' },
        ai: { 50: '#F5F3FF', 100: '#EDE9FE', 300: '#C4B5FD', 400: '#A78BFA', 500: '#8B5CF6', 600: '#7C3AED', 700: '#6D28D9' },
      },
      boxShadow: {
        card: '0 1px 2px rgba(11,31,53,.05), 0 12px 32px -16px rgba(11,31,53,.14)',
        lift: '0 2px 6px rgba(11,31,53,.08), 0 24px 48px -20px rgba(11,31,53,.28)',
        glowBrand: '0 8px 24px -8px rgba(37,99,235,.45)',
        glowAi: '0 8px 24px -8px rgba(139,92,246,.45)',
        glowEmerald: '0 8px 24px -8px rgba(16,185,129,.45)',
        glowDanger: '0 8px 24px -8px rgba(239,68,68,.4)',
      },
      keyframes: {
        floatY: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-10px)' } },
        drift: { '0%,100%': { transform: 'translate(0,0) scale(1)' }, '33%': { transform: 'translate(26px,-20px) scale(1.07)' }, '66%': { transform: 'translate(-20px,14px) scale(.96)' } },
        pulseDot: { '0%': { boxShadow: '0 0 0 0 rgba(16,185,129,.45)' }, '70%': { boxShadow: '0 0 0 8px rgba(16,185,129,0)' }, '100%': { boxShadow: '0 0 0 0 rgba(16,185,129,0)' } },
        dashmove: { to: { strokeDashoffset: '-28' } },
        spinSlow: { to: { transform: 'rotate(360deg)' } },
        pageIn: { '0%': { opacity: '0', transform: 'translateY(14px)' }, '100%': { opacity: '1', transform: 'none' } },
        popIn: { '0%': { opacity: '0', transform: 'scale(.94)' }, '100%': { opacity: '1', transform: 'scale(1)' } },
        flowDot: { '0%': { left: '0%', opacity: '0' }, '12%': { opacity: '1' }, '85%': { opacity: '1' }, '100%': { left: 'calc(100% - 8px)', opacity: '0' } },
        nodePing: { '0%': { transform: 'scale(.4)', opacity: '.8' }, '100%': { transform: 'scale(2.6)', opacity: '0' } },
        shakeX: { '10%,90%': { transform: 'translateX(-1px)' }, '20%,80%': { transform: 'translateX(2px)' }, '30%,50%,70%': { transform: 'translateX(-3px)' }, '40%,60%': { transform: 'translateX(3px)' } },
        toastbar: { from: { width: '100%' }, to: { width: '0%' } },
        scanline: { '0%': { top: '-18%' }, '100%': { top: '112%' } },
      },
      animation: {
        floatY: 'floatY 6s ease-in-out infinite',
        drift: 'drift 15s ease-in-out infinite',
        pulseDot: 'pulseDot 2s ease-out infinite',
        dashmove: 'dashmove 1.5s linear infinite',
        spinSlow: 'spinSlow 16s linear infinite',
        pageIn: 'pageIn .5s cubic-bezier(.22,1,.36,1) both',
        popIn: 'popIn .32s cubic-bezier(.22,1,.36,1) both',
        flowDot: 'flowDot 2.6s linear infinite',
        shakeX: 'shakeX .5s both',
        scanline: 'scanline 2.6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;
