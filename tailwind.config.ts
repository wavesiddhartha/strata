import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        cream: "#F0EEE6",
        card: "#E7E3D8",
        ink: "#1A1A1A",
        line: "#D8D3C4",
        rust: "#BF5B3F",
        highlight: {
          yellow: "#FCE9A8",
          blue: "#C9DCE8",
          pink: "#F3D0D9",
        },
      },
      fontFamily: {
        serif: ["var(--font-serif)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        pill: "999px",
      },
      transitionTimingFunction: {
        out: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
    },
  },
  plugins: [],
};

export default config;
