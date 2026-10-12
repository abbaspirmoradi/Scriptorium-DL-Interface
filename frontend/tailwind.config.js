/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{html,js}"],
  theme: {
    extend: {
      colors: {
        // Archival design system — matches the approved Figma prototype 1:1.
        // Use these tokens (not raw hex, not the old MUI palette) in every
        // restyled component so the whole app stays visually consistent.
        parchment: "#f4f3ef",
        "parchment-card": "#ffffff",
        "parchment-muted": "#e5e1d6",
        "parchment-secondary": "#ede9df",
        "parchment-input": "#edeae2",
        navy: {
          DEFAULT: "#1a1744",
          foreground: "#ffffff",
        },
        ink: {
          DEFAULT: "#1c1917",
          muted: "#6b6358",
        },
        accent: {
          DEFAULT: "#c9930a",
          foreground: "#ffffff",
        },
        "archival-border": "rgba(28, 25, 23, 0.1)",
        destructive: {
          DEFAULT: "#c0392b",
          foreground: "#ffffff",
        },
        // Agent colors — keep in sync with backend/ai/agents.js role colors
        agent: {
          aria: "#4f46e5",   // indigo — Synthesizer
          clio: "#0891b2",   // cyan — Citations
          hermes: "#059669", // emerald — Navigator
          socrates: "#d97706", // amber — Critic
          minerva: "#7c3aed", // violet — Methods
        },
      },
      fontFamily: {
        // Document titles / scholarly register
        serif: ["EB Garamond", "Georgia", "serif"],
        // UI chrome
        sans: ["Inter", "system-ui", "sans-serif"],
        // Metadata, timestamps, filter tabs
        mono: ["DM Mono", "ui-monospace", "monospace"],
      },
      borderRadius: {
        DEFAULT: "0.5rem",
      },
    },
  },
  plugins: [],
}

