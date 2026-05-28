import { defineConfig } from "vitepress";
import typedocSidebar from "../api/typedoc-sidebar.json";

export default defineConfig({
  title: "Bond Analytics",
  description:
    "A dependency-free TypeScript engine for fixed-income analytics — bond pricing, yield, accrued interest, duration, and portfolio metrics.",
  // GitHub Pages serves the site under /<repo>/.
  base: "/Bond-Analytics/",
  lastUpdated: true,
  cleanUrls: true,
  ignoreDeadLinks: true,

  head: [
    ["meta", { name: "theme-color", content: "#3c8772" }],
  ],

  themeConfig: {
    nav: [
      { text: "Guide", link: "/guide/introduction", activeMatch: "/guide/" },
      { text: "API", link: "/api/", activeMatch: "/api/" },
      { text: "Examples", link: "/guide/examples" },
      {
        text: "v0.1.0",
        items: [
          { text: "Changelog", link: "https://github.com/matasurbonavicius/Bond-Analytics/blob/main/CHANGELOG.md" },
          { text: "npm", link: "https://www.npmjs.com/package/bond-analytics" },
        ],
      },
    ],

    sidebar: {
      "/guide/": [
        {
          text: "Guide",
          items: [
            { text: "Introduction", link: "/guide/introduction" },
            { text: "Quickstart", link: "/guide/quickstart" },
            { text: "Methodology", link: "/guide/methodology" },
            { text: "Architecture", link: "/guide/architecture" },
            { text: "Examples", link: "/guide/examples" },
          ],
        },
      ],
      "/api/": [
        {
          text: "API Reference",
          items: typedocSidebar,
        },
      ],
    },

    socialLinks: [
      { icon: "github", link: "https://github.com/matasurbonavicius/Bond-Analytics" },
    ],

    search: {
      provider: "local",
    },

    editLink: {
      pattern:
        "https://github.com/matasurbonavicius/Bond-Analytics/edit/main/docs/:path",
      text: "Edit this page on GitHub",
    },

    footer: {
      message: "Released under the Apache-2.0 License.",
      copyright: "Copyright © 2026 Matas Urbonavičius",
    },
  },
});
