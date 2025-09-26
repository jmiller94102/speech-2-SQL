/**** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./pages/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        background: "#0B0F1A",
        card: "#121829",
        muted: "#1A2238",
        accent: "#3B82F6",
        success: "#22C55E",
        warning: "#F59E0B",
        danger: "#EF4444",
        border: "#1F2937",
        text: {
          DEFAULT: "#E5E7EB",
          muted: "#9CA3AF"
        }
      },
      boxShadow: {
        card: "0 2px 14px rgba(0,0,0,0.25)",
      },
      borderRadius: {
        xl: "14px"
      }
    }
  },
  plugins: []
};
