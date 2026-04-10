import { defineConfig } from "vitepress";

// https://vitepress.dev/reference/site-config
export default defineConfig({
  srcDir: "content",

  title: "Rami's Scratchpad",
  description: "A place for Rami's random thoughts.",
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    nav: [
      { text: "Home", link: "/" },
      { text: "Posts", link: "/posts" },
    ],

    search: { provider: "local" },

    socialLinks: [{ icon: "github", link: "https://github.com/rami3l" }],
  },
});
