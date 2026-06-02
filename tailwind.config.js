/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        "cw-black": "#050508",
        "cw-dark": "#0a0a0f",
        "cw-panel": "#0d0d14",
        "cw-border": "#1a1a2e",
        "cw-cyan": "#00f5ff",
        "cw-cyan-dim": "#00b8c4",
        "cw-red": "#ff2d55",
        "cw-red-dim": "#c41e3a",
        "cw-amber": "#ff9500",
        "cw-amber-dim": "#c47300",
        "cw-green": "#00ff88",
        "cw-green-dim": "#00c46a",
        "cw-purple": "#bf5af2",
        "cw-text": "#e0e0f0",
        "cw-muted": "#6b7280",
      },
      fontFamily: {
        mono: ["'JetBrains Mono'", "monospace"],
        display: ["'Orbitron'", "sans-serif"],
        body: ["'IBM Plex Sans'", "sans-serif"],
      },
      animation: {
        "scan-line": "scanLine 2s linear infinite",
        "pulse-cyan": "pulseCyan 2s ease-in-out infinite",
        "flicker": "flicker 0.15s infinite",
      },
      keyframes: {
        scanLine: {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100vh)" },
        },
        pulseCyan: {
          "0%, 100%": { boxShadow: "0 0 5px #00f5ff, 0 0 10px #00f5ff" },
          "50%": { boxShadow: "0 0 20px #00f5ff, 0 0 40px #00f5ff" },
        },
        flicker: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.8" },
        },
      },
    },
  },
  plugins: [],
};
