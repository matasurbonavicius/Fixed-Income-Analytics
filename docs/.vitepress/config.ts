import { defineConfig } from "vitepress";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import typedocSidebar from "../api/typedoc-sidebar.json";

// Single source of truth for the version shown in the nav.
const { version } = JSON.parse(
  readFileSync(fileURLToPath(new URL("../../package.json", import.meta.url)), "utf-8")
);

const SITE_TITLE = "Fixed Income Analytics";
const SITE_DESC =
  "A dependency-free TypeScript engine for fixed-income analytics — bond pricing, yield, accrued interest, duration, and portfolio metrics.";
const SITE_URL = "https://matasurbonavicius.github.io/Fixed-Income-Analytics/";
// Social-card image. Platforms (Slack/X/LinkedIn) render PNG, not SVG — the
// source card is docs/public/og-image.svg; generate the .png from it once
// (see docs/public/README.md) and it ships from /public unchanged.
const OG_IMAGE = SITE_URL + "og-image.png";

// TypeDoc's markdown plugin emits the API sidebar twice: once grouped by our
// @category tags, and again by reflection kind (Classes / Interfaces / …). We
// discard the redundant kind buckets and re-shape the curated @category groups
// into the engine's three architectural layers (see Concepts → Architecture):
//   Domain      - the pure financial model
//   Application - orchestration: services + the formula registry
//   Calendars   - the static holiday-data leaf
type SidebarItem = { text: string; link?: string; items?: SidebarItem[] };
const apiGroups = typedocSidebar as SidebarItem[];
const pickGroups = (...titles: string[]) =>
  titles
    .map((t) => apiGroups.find((g) => g.text === t))
    .filter((g): g is SidebarItem => Boolean(g));

// The `calendars` namespace nests as Namespaces → calendars → [members].
// Hoist its members up so the Calendars layer lists them directly.
const calendarsMembers =
  apiGroups
    .find((g) => g.text === "Namespaces")
    ?.items?.find((i) => i.text === "calendars")?.items ?? [];

// Entities tree: the Bond and Portfolio classes sit at the top, with each
// entity's supporting props/metrics/enums tucked into a collapsed child group
// so the level stays scannable but the detail is one click away.
const groupItems = (title: string) =>
  apiGroups.find((g) => g.text === title)?.items ?? [];
const entitiesTree = [
  ...groupItems("Entities"), // Bond, Portfolio
  {
    text: "Bond: supporting types",
    collapsed: true,
    items: groupItems("Bond Types & Shapes"),
  },
  {
    text: "Portfolio: supporting types",
    collapsed: true,
    items: groupItems("Portfolio Types & Shapes"),
  },
];

const apiSidebar = [
  {
    text: "Domain",
    collapsed: false,
    items: [
      ...pickGroups("Value Objects"),
      { text: "Entities", collapsed: false, items: entitiesTree },
      ...pickGroups("Market Data", "Calendars & Day-Count", "Results & Types"),
    ],
  },
  {
    text: "Application",
    collapsed: false,
    items: pickGroups("Services", "Formula Registry"),
  },
  {
    text: "Calendars",
    collapsed: false,
    items: calendarsMembers,
  },
];

// Shared sidebar for the hand-written docs: Guide (get going), Concepts
// (the reasoning behind the engine), and Examples (runnable scenarios).
const guideSidebar = [
  {
    text: "Guide",
    items: [
      { text: "Introduction", link: "/guide/introduction" },
      { text: "Quickstart", link: "/guide/quickstart" },
    ],
  },
  {
    text: "Concepts",
    items: [
      { text: "Methodology", link: "/concepts/methodology" },
      { text: "Architecture", link: "/concepts/architecture" },
      { text: "Design decisions", link: "/concepts/design-decisions" },
    ],
  },
  {
    text: "Examples",
    items: [{ text: "Runnable scenarios", link: "/examples/" }],
  },
];

export default defineConfig({
  title: SITE_TITLE,
  titleTemplate: ":title · Fixed Income Analytics",
  description: SITE_DESC,
  // GitHub Pages serves the site under /<repo>/.
  base: "/Fixed-Income-Analytics/",
  lastUpdated: true,
  cleanUrls: true,
  ignoreDeadLinks: false,

  head: [
    ["link", { rel: "icon", type: "image/svg+xml", href: "/Fixed-Income-Analytics/logo.svg" }],
    ["meta", { name: "theme-color", content: "#3c8772" }],
    // Open Graph (Slack / LinkedIn / Facebook link previews)
    ["meta", { property: "og:type", content: "website" }],
    ["meta", { property: "og:site_name", content: SITE_TITLE }],
    ["meta", { property: "og:title", content: SITE_TITLE }],
    ["meta", { property: "og:description", content: SITE_DESC }],
    ["meta", { property: "og:url", content: SITE_URL }],
    ["meta", { property: "og:image", content: OG_IMAGE }],
    // Twitter / X card
    ["meta", { name: "twitter:card", content: "summary_large_image" }],
    ["meta", { name: "twitter:title", content: SITE_TITLE }],
    ["meta", { name: "twitter:description", content: SITE_DESC }],
    ["meta", { name: "twitter:image", content: OG_IMAGE }],
  ],

  // Per-page <title>/og:title/description so shared deep links unfurl correctly.
  transformPageData(pageData) {
    const pageTitle = pageData.title
      ? `${pageData.title} · ${SITE_TITLE}`
      : SITE_TITLE;
    const pageDesc = pageData.description || SITE_DESC;
    pageData.frontmatter.head ??= [];
    pageData.frontmatter.head.push(
      ["meta", { property: "og:title", content: pageTitle }],
      ["meta", { property: "og:description", content: pageDesc }],
      ["meta", { name: "twitter:title", content: pageTitle }],
      ["meta", { name: "twitter:description", content: pageDesc }],
    );
  },

  themeConfig: {
    logo: "/logo.svg",
    outline: "deep",

    nav: [
      { text: "Guide", link: "/guide/introduction", activeMatch: "/guide/" },
      { text: "Concepts", link: "/concepts/methodology", activeMatch: "/concepts/" },
      { text: "Examples", link: "/examples/", activeMatch: "/examples/" },
      { text: "API", link: "/api/", activeMatch: "/api/" },
      {
        text: `v${version}`,
        items: [
          { text: "Changelog", link: "https://github.com/matasurbonavicius/Fixed-Income-Analytics/blob/main/CHANGELOG.md" },
          { text: "npm", link: "https://www.npmjs.com/package/fixed-income-analytics" },
        ],
      },
    ],

    sidebar: {
      // Guide, Concepts, and Examples share one sidebar so all three groups
      // stay visible no matter which section you're reading.
      "/guide/": guideSidebar,
      "/concepts/": guideSidebar,
      "/examples/": guideSidebar,
      "/api/": [
        {
          text: "API Reference",
          items: apiSidebar,
        },
      ],
    },

    socialLinks: [
      { icon: "github", link: "https://github.com/matasurbonavicius/Fixed-Income-Analytics" },
    ],

    search: {
      provider: "local",
    },

    editLink: {
      pattern:
        "https://github.com/matasurbonavicius/Fixed-Income-Analytics/edit/main/docs/:path",
      text: "Edit this page on GitHub",
    },

    footer: {
      message: "Released under the Apache-2.0 License.",
      copyright: "Copyright © 2026 Matas Urbonavičius",
    },
  },
});
