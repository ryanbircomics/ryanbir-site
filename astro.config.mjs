import { defineConfig } from "astro/config";
import vercel from "@astrojs/vercel";
import tailwind from "@astrojs/tailwind";
import sitemap from "@astrojs/sitemap";

export default defineConfig({
  site: "https://www.ryanbir.com",
  adapter: vercel(),
  integrations: [
    tailwind(),
    sitemap(),
  ],
});
