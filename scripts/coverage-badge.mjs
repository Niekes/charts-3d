#!/usr/bin/env node
/**
 * Writes the coverage badge from the line coverage of Vitest: a shields.io
 * endpoint at .github/badges/coverage.json, which the README renders.
 *
 * Usage: npm run coverage && npm run coverage:badge
 */

import { readFileSync, writeFileSync } from "node:fs"

const { pct } = JSON.parse(readFileSync("coverage/coverage-summary.json", "utf8")).total.lines
const color = pct >= 90 ? "brightgreen" : pct >= 80 ? "green" : pct >= 70 ? "yellow" : "red"

writeFileSync(
  ".github/badges/coverage.json",
  `${JSON.stringify({ schemaVersion: 1, label: "coverage", message: `${pct}%`, color })}\n`
)
