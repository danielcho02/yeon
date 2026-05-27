import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))"
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))"
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))"
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))"
        },
        wedding: {
          primary: "#f43f5e",
          "primary-light": "#fda4af",
          "primary-dark": "#be123c",
          background: "#fff7ed",
          accent: "#d97706",
          "accent-light": "#fcd34d",
          surface: "#fff1f2",
          muted: "#fce7f3",
        },
        funeral: {
          primary: "#475569",
          "primary-light": "#94a3b8",
          "primary-dark": "#1e293b",
          background: "#f8fafc",
          accent: "#1e3a5f",
          "accent-light": "#3b82f6",
          surface: "#f1f5f9",
          muted: "#e2e8f0",
        },
      },
      borderRadius: {
        lg: "1rem",
        md: "0.75rem",
        sm: "0.5rem"
      },
      boxShadow: {
        glow: "0 24px 80px rgba(16, 51, 44, 0.12)"
      }
    }
  },
  plugins: [tailwindcssAnimate]
};

export default config;
