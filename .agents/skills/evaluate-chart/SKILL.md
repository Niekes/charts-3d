---
name: evaluate-chart
description: Load when an existing chart of the charts-3d registry should be checked against the house requirements ("evaluate chart X", "review the sankey", "does every chart have ..."). Runs the gates and the requirement checklist and reports pass/fail with evidence; fixes nothing unless explicitly asked.
---

# Evaluate chart

Checks `<name>-chart-3d` (or every chart in `registry/new-york/ui/`) against
the requirements of this registry. Read `AGENTS.md` and `GLOSSARY.md` for the
terms (mark, scene, renderer, hover, focus). Report only; change nothing
unless the user says "fix" - then fix and re-run.

## 1. Run the gates

Record each failure with the exact command and output:

- `npm run lint` (formatting, types, `lint:template`, fallow)
- `npm test`
- `npm run coverage` (gate: >= 98% in statements, branches, functions, lines)

## 2. Requirement checklist

One row per criterion, with evidence (`file:line`) and pass/fail:

| #   | Criterion                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Where to look                                                                                                   |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| 1   | Template: file is a `registry:ui` item in `registry.json`, starts with `"use client"`, no default export, exports `<Name>Chart3D` + `<Name>Chart3DProps`, imports only React + the npm deps of `chart-3d` + the core, re-exported from `index.ts`                                                                                                                                                                                                                                                  | `scripts/check-template.mjs`, `registry.json`, `index.ts`                                                       |
| 2   | Draws only through `Axes3D`/`Marks3D`/`Labels3D`; no own SVG/HTML, no own canvas or webgl, no pointer/keyboard handlers                                                                                                                                                                                                                                                                                                                                                                            | the chart file                                                                                                  |
| 3   | Data-driven, one scene: shapes are handed over as `Mark3D`/`Label3D` data; canvas and webgl paint the scene and the hover hit-tests it; the chart keeps no copy of the data                                                                                                                                                                                                                                                                                                                        | `useScene`/`Marks3D`/`paint`/`paintGL`/`hit` in `chart-3d.tsx`, the chart file                                  |
| 4   | Renderer parity: the renderers demo has a `<select>` over `"svg"`/`"canvas"`/`"webgl"` (`RendererSelect`); the probe falls back webgl to canvas to SVG; box, labels, tooltip, legend, gizmo stay SVG/HTML on every renderer                                                                                                                                                                                                                                                                        | `docs/examples/<name>-chart-3d-renderers-demo.tsx`, `useRenderer`/`ChartCanvas3D` in `chart-3d.tsx`             |
| 5   | Hover: tooltip + focus follow the hovered mark and clear when the pointer leaves the mark or the chart - with a test that fails without it                                                                                                                                                                                                                                                                                                                                                         | `useHover`/`useFades` in `chart-3d.tsx`, `tests/chart-3d.test.tsx` focus tests, the chart's test                |
| 6   | Interaction only via the container: camera moves through `SHORTCUTS`/`keymap` only, the chart file has no pointer/key handlers; demos keep the standard gestures on (platform modifier + drag rotates - ⌘ on Mac, Ctrl elsewhere, plain drag only inspects with the default cursor; Space+drag pans; Ctrl/⌘+wheel or pinch zooms; double-click resets) unless they opt out via `keymap`; panel and `aria-keyshortcuts` agree; see docs/adr/0001-navigation.md and docs/adr/0002-hover-highlight.md | `SHORTCUTS`/`keymapOf` in `chart-3d.tsx`, the chart file, the demos                                             |
| 7   | Three demos + mdx sections: `<name>-demo`, `<name>-update-demo`, `<name>-renderers-demo`, page in `meta.json`                                                                                                                                                                                                                                                                                                                                                                                      | `docs/examples/`, `docs/content/components/`                                                                    |
| 8   | Health: no function over 60 lines, fallow health >= 98, layers respected (chart imports only core + npm deps, core knows no chart)                                                                                                                                                                                                                                                                                                                                                                 | `npm run lint:fallow`, `.fallowrc.jsonc`                                                                        |
| 9   | Tests drive the chart like a user: render, pointer + keyboard events, read the drawing, on every renderer                                                                                                                                                                                                                                                                                                                                                                                          |
| 10  | Unified focus: every mark carries `groups` naming what is highlighted together (single element per chart; the sankey relates node and flows); hovering gives exactly those an edge in `var(--foreground)` with unchanged fill (no fade anywhere), leaving the mark or the chart clears it - with a focus test in the chart's own test file                                                                                                                                                         | the chart file (`groups:` on the marks), `useLit`/`Marks3D` in `chart-3d.tsx`, `tests/<name>-chart-3d.test.tsx` |

## 3. Report

A table `criterion | pass/fail | evidence (file:line)` plus the failing
commands to run. If all pass, say so in one line. Do not fix anything in
this pass unless the user asks.
