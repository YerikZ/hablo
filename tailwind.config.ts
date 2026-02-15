import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        bg: "#f7f8f2",
        fg: "#0f172a",
        accent: "#c2410c",
        muted: "#e5e7eb"
      }
    }
  },
  plugins: []
};

export default config;
