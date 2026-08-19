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
    },
  },
  plugins: [],
};
