/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      // The Practice app's own tokens (src/index.css), so the Command Center
      // is the same paper, navy and gold the members see.
      colors: {
        canvas: "hsl(var(--canvas))",
        "canvas-sunken": "hsl(var(--canvas-sunken))",
        surface: "hsl(var(--surface))",
        "surface-raised": "hsl(var(--surface-raised))",
        line: "hsl(var(--line))",
        "line-strong": "hsl(var(--line-strong))",
        ink: {
          DEFAULT: "hsl(var(--ink))",
          muted: "hsl(var(--ink-muted))",
          faint: "hsl(var(--ink-faint))"
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          strong: "hsl(var(--accent-strong))",
          soft: "hsl(var(--accent-soft))",
          wash: "hsl(var(--accent-wash))",
          ink: "hsl(var(--accent-ink))",
          ring: "hsl(var(--accent-ring))"
        },
        feature: {
          DEFAULT: "hsl(var(--feature))",
          ink: "hsl(var(--feature-ink))"
        },
        gilt: {
          DEFAULT: "hsl(var(--gilt))",
          ink: "hsl(var(--gilt-ink))",
          bright: "hsl(var(--gilt-bright))",
          tan: "hsl(var(--gilt-tan))"
        },
        gold: "hsl(var(--gold))",
        positive: "hsl(var(--positive))",
        warning: "hsl(var(--warning))",
        danger: "hsl(var(--danger))"
      },
      // `bg-accent/12`, the tint under an icon: twelve is not on Tailwind's scale.
      opacity: { 12: "0.12" },
      textColor: {
        accent: {
          DEFAULT: "hsl(var(--accent-text))",
          strong: "hsl(var(--accent-text-strong))"
        }
      },
      borderRadius: {
        field: "var(--r-field)",
        card: "var(--r-card)",
        sheet: "var(--r-sheet)"
      },
      boxShadow: {
        card: "var(--shadow-card)",
        raised: "var(--shadow-raised)",
        float: "var(--shadow-float)"
      },
      fontFamily: {
        heading: ["var(--font-display)"],
        display: ["var(--font-display)"],
        body: ["var(--font-body)"],
        mono: ["var(--font-mono)"]
      },
      fontWeight: {
        semibold: "560",
        bold: "600"
      },
      keyframes: {
        "rise-in": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" }
        },
        "pulse-ring": {
          "0%": { boxShadow: "0 0 0 0 hsl(var(--gold) / 0.55)" },
          "100%": { boxShadow: "0 0 0 14px hsl(var(--gold) / 0)" }
        }
      },
      animation: {
        "rise-in": "rise-in 220ms cubic-bezier(0.22, 0.61, 0.36, 1) both",
        "pulse-ring": "pulse-ring 1.2s ease-out 1"
      }
    }
  },
  plugins: []
};
