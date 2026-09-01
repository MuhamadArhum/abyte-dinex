/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      fontSize: {
        // Tighter line-heights for business/data-dense UI
        'xs':   ['11px', { lineHeight: '16px', letterSpacing: '0.01em' }],
        'sm':   ['13px', { lineHeight: '20px', letterSpacing: '-0.001em' }],
        'base': ['14px', { lineHeight: '22px', letterSpacing: '-0.002em' }],
        'md':   ['15px', { lineHeight: '24px', letterSpacing: '-0.003em' }],
        'lg':   ['16px', { lineHeight: '24px', letterSpacing: '-0.003em' }],
        'xl':   ['18px', { lineHeight: '28px', letterSpacing: '-0.01em'  }],
        '2xl':  ['22px', { lineHeight: '30px', letterSpacing: '-0.02em'  }],
        '3xl':  ['26px', { lineHeight: '34px', letterSpacing: '-0.02em'  }],
        '4xl':  ['32px', { lineHeight: '40px', letterSpacing: '-0.03em'  }],
      },
      letterSpacing: {
        tightest: '-0.03em',
        tighter:  '-0.02em',
        tight:    '-0.01em',
        normal:   '-0.002em',
        wide:     '0.01em',
        wider:    '0.04em',
        widest:   '0.08em',
      },
      lineHeight: {
        'tight-heading': '1.25',
        'snug-heading':  '1.35',
      },
      keyframes: {
        shimmer: {
          '0%':   { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '-200% 0' },
        },
        fadeIn: {
          '0%':   { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideUp: {
          '0%':   { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%':   { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        countUp: {
          '0%':   { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        shimmer:  'shimmer 2s linear infinite',
        fadeIn:   'fadeIn 0.3s ease-out',
        slideUp:  'slideUp 0.35s ease-out',
        scaleIn:  'scaleIn 0.25s ease-out',
        countUp:  'countUp 0.5s ease-out',
      },
    },
  },
  plugins: [],
}
