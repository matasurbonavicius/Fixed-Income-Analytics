// Generates a shields.io "endpoint" badge JSON from the Vitest coverage summary.
// Run after `npm run test:coverage`; the output is published to GitHub Pages and
// read by the README badge — no third-party coverage service required.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const SUMMARY = "coverage/coverage-summary.json";
const OUT = process.argv[2] ?? "docs/.vitepress/dist/coverage-badge.json";

const pct = JSON.parse(readFileSync(SUMMARY, "utf8")).total.statements.pct;

// Green ≥ 90, yellow-green ≥ 80, yellow ≥ 70, orange ≥ 60, else red.
const color =
  pct >= 90 ? "brightgreen" :
  pct >= 80 ? "green" :
  pct >= 70 ? "yellowgreen" :
  pct >= 60 ? "yellow" :
  pct >= 50 ? "orange" : "red";

const badge = {
  schemaVersion: 1,
  label: "coverage",
  message: `${pct.toFixed(1)}%`,
  color,
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(badge));
console.log(`coverage badge: ${badge.message} (${color}) → ${OUT}`);
