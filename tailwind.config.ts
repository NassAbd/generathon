import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      boxShadow: {
        glow: "0 0 50px rgba(168, 85, 247, 0.18)",
      },
      keyframes: {
        "bounce-word": {
          "0%, 100%": { transform: "translateY(0) scale(1.08)" },
          "50%": { transform: "translateY(-8px) scale(1.16)" },
        },
        glitch: {
          "0%, 100%": { transform: "translate(0)" },
          "20%": { transform: "translate(-2px, 1px)" },
          "40%": { transform: "translate(2px, -1px)" },
        },
      },
      animation: {
        "bounce-word": "bounce-word 0.55s ease-in-out",
        glitch: "glitch 0.45s steps(2, end)",
      },
    },
  },
  plugins: [],
};

export default config;
