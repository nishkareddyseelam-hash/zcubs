import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0e1220",
        ink2: "#141a2e",
        ink3: "#171d34",
        ivory: "#f7f2e7",
        ivory2: "#fffdf8",
        indigo: { DEFAULT: "#4a41e0", light: "#6b63f0", deep: "#2e2799" },
        teal: { DEFAULT: "#1c9b8e", deep: "#0f6b62" },
        saffron: "#e8722f",
        good: "#1c8a5a",
        warn: "#b5790f",
        bad: "#c23b3b",
      },
      fontFamily: {
        display: ["Fraunces", "ui-serif", "Georgia", "serif"],
        body: ["Sora", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["IBM Plex Mono", "ui-monospace", "monospace"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(30,20,0,.04), 0 8px 24px -12px rgba(30,20,0,.18)",
      },
      borderRadius: {
        xl2: "14px",
      },
    },
  },
  plugins: [],
};
export default config;
