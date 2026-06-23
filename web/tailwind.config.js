/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        pitch: {
          950: "#0c0c16",
          900: "#111120",
          800: "#17172a",
          700: "#1d1d30",
          600: "#262640",
          400: "#6b6b8a",
          300: "#9494b0",
        },
        volt: {
          500: "#e8ff47",
          400: "#f0ff6e",
          300: "#f5ffa0",
        },
        danger: {
          500: "#ef4444",
          600: "#dc2626",
        },
      },
      fontFamily: {
        display: ["Barlow Condensed", "sans-serif"],
        sans:    ["Barlow", "ui-sans-serif", "system-ui", "sans-serif"],
        mono:    ["DM Mono", "ui-monospace", "monospace"],
      },
      boxShadow: {
        "glow-volt": "0 0 12px rgba(232,255,71,0.35)",
        "glow-sm":   "0 0 0 1px rgba(255,255,255,0.04), 0 4px 20px rgba(0,0,0,0.5)",
        card:        "0 0 0 1px rgba(255,255,255,0.05), 0 8px 32px rgba(0,0,0,0.45)",
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};
