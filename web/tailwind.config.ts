import type { Config } from "tailwindcss";

// Design tokens mirror RootedQuran (src/app/globals.css + tailwind.config.ts there)
const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "rgb(var(--bg) / <alpha-value>)",
        surface: "rgb(var(--surface) / <alpha-value>)",
        "surface-raised": "rgb(var(--surface-raised) / <alpha-value>)",
        teal: {
          DEFAULT: "rgb(var(--teal) / <alpha-value>)",
          light: "rgb(var(--teal-light) / <alpha-value>)",
          dark: "rgb(var(--teal-dark) / <alpha-value>)",
        },
        parchment: "rgb(var(--parchment) / <alpha-value>)",
        "parchment-muted": "rgb(var(--parchment-muted) / <alpha-value>)",
        border: "rgb(var(--border) / <alpha-value>)",
        stuck: "rgb(var(--stuck) / <alpha-value>)",
        hint: "rgb(var(--hint) / <alpha-value>)",
      },
      fontFamily: {
        serif: ["Georgia", "Cambria", '"Times New Roman"', "serif"],
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
