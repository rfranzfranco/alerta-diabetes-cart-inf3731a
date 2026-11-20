import daisyui from 'daisyui';

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "SF Pro Text",
          "SF Pro Display",
          "Helvetica Neue",
          "sans-serif"
        ],
        mono: [
          "ui-monospace",
          "SF Mono",
          "Menlo",
          "Monaco",
          "Consolas",
          "monospace"
        ]
      }
    },
  },
  plugins: [
    daisyui
  ],
  daisyui: {
    themes: [
      {
        light: {
          "primary": "#0071E3",
          "secondary": "#5856D6",
          "accent": "#34C759",
          "neutral": "#1D1D1F",
          "base-100": "#FFFFFF",
          "base-200": "#F5F5F7",
          "base-300": "#E5E5EA",
          "info": "#0071E3",
          "success": "#34C759",
          "warning": "#FF9500",
          "error": "#FF3B30",
        },
        dark: {
          "primary": "#0A84FF",
          "secondary": "#5E5CE6",
          "accent": "#30D158",
          "neutral": "#F5F5F7",
          "base-100": "#1C1C1E",
          "base-200": "#000000",
          "base-300": "#2C2C2E",
          "info": "#64D2FF",
          "success": "#30D158",
          "warning": "#FF9F0A",
          "error": "#FF453A",
        }
      }
    ],
    darkTheme: "dark"
  }
}
