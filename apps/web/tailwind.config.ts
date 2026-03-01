import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx,js,jsx}"],
  darkMode: ["class", '[data-theme="night"]'],
  theme: {
    extend: {
      colors: {
        bg: "var(--color-bg)",
        surface: "var(--color-surface)",
        "text-primary": "var(--color-text)",
        "text-secondary": "var(--color-text-secondary)",
        border: "var(--color-border)",
        accent: "var(--color-accent)",
        action: "var(--color-action)",
        "action-hover": "var(--color-action-hover)",
        sidebar: "var(--color-sidebar)",
        "sidebar-text": "var(--color-sidebar-text)",
        "sidebar-active": "var(--color-sidebar-active)",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
