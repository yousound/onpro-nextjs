import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        "chrome-dark": "#0f1419",
        "chrome-elevated": "#161f2a",
        "surface-body": "#f0f2f7",
        "surface-card": "#ffffff",
        "border-subtle": "rgba(255, 255, 255, 0.08)",
        "border-light": "#e2e8f0",
        "text-on-chrome": "#f8fafc",
        "text-muted-chrome": "#94a3b8",
        "text-primary": "#0f172a",
        "text-secondary": "#64748b",
        accent: "#7c3aed",
        "health-ok": "#22c55e",
        "health-warn": "#eab308",
        "health-bad": "#ef4444",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
