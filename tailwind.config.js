module.exports = {
  content: ["./src/**/*.{astro,html,js,jsx,ts,tsx,vue,svelte}"],
  theme: {
    extend: {
      colors: {
        background: "#111111",
        surface: "#1A1A1A",
        accent: "#3B82F6",
        text: "#F5F5F5",
        muted: "#9CA3AF",
      },
      fontFamily: {
        display: ['"Bebas Neue"', "sans-serif"],
        body: ['"Inter"', "sans-serif"],
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { transform: "translateY(16px)" },
          "100%": { transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-in-up": "fadeIn 2.2s ease-out both, slideUp 1.2s ease-out both",
      },
    },
  },
  plugins: [],
};
