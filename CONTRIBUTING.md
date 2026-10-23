# Contributing to charts-3d

Thanks for taking the time to contribute. charts-3d is maintained by one person in
spare time, so every pull request that saves a day of debugging is worth a lot.

## Getting started

```bash
git clone https://github.com/niekes/charts-3d.git
cd charts-3d
npm install
npm run docs:dev
```

Node 22, 24 or newer is required. The docs run at `http://localhost:5173/charts-3d/`.

## The checks that have to pass

```bash
npm run lint     # the whole gate
npm test         # the test suite
npm run build    # typecheck + registry JSON + docs + npm package
```

`npm run lint` runs four things:

- `vp fmt --check` checks the formatting; `vp fmt` fixes it.
- `vp lint` lints the code, type-aware.
- `npm run lint:template` checks that the registry follows the template in
  [AGENTS.md](./AGENTS.md). The template is not a convention — it is enforced in
  CI, in the pre-commit hook and by the agent hooks.
- `npm run lint:fallow` checks layering, dead code, test coverage and
  duplication, and that the fallow health score stays at 98 or above.

All of them run in CI on every pull request, so running them locally saves you a
round trip.

## Repository layout

| Path                                  | Zone         | What lives there                                       |
| ------------------------------------- | ------------ | ------------------------------------------------------ |
| `index.ts`                            | `public-api` | The npm package: re-exports every registry file.       |
| `registry/new-york/ui/chart-3d.tsx`   | `core`       | The container, camera, axes, tooltip and helpers.      |
| `registry/new-york/ui/*-chart-3d.tsx` | `charts`     | One chart per file.                                    |
| `registry.json`                       |              | The registry: one item per file.                       |
| `lib/**`                              | `lib`        | `cn`, as every shadcn project has it.                  |
| `tests/**`                            | `tests`      | The test suite, one file per registry item.            |
| `docs/**`                             | `docs`       | The documentation site: Fumadocs on React Router.      |
| `scripts/**`                          | `tooling`    | Repository tooling. Imports nothing from the registry. |

Dependencies point inwards only. A chart builds on the core and never on another
chart, and the core knows nothing about the charts.

## Adding a chart

1. Create `registry/new-york/ui/<name>-chart-3d.tsx` following the template in [AGENTS.md](./AGENTS.md).
2. Add its item to `registry.json`, with `niekes/charts-3d/chart-3d` as its only registry dependency.
3. Add `tests/<name>-chart-3d.test.tsx`, `docs/examples/<name>-chart-3d-demo.tsx` and
   `docs/content/components/<name>-chart-3d.mdx`.
4. Re-export it from `index.ts` for the npm package.
5. Run `npm run lint` and `npm test`.

## Code style

- The style of shadcn/ui: two spaces, double quotes, no semicolons. The registry files land in
  shadcn projects and should read like the code there. `vp fmt` applies it.
- A chart exports its component with `export function` and its props as a named type,
  `<Name>Chart3DProps`, with a comment on every prop. The docs generate the API table from it.
- No default exports in the registry, and no `console` calls in code that lands in other projects.
- No function in the registry is longer than 60 lines: one costs the health score more than two
  points, and the gate requires 98. Split a long component into a hook, a component per mark or
  a helper function.
- Every new export of the core needs a test. An export that no test can reach is reported by
  the coverage rule.

## Pull requests

- Keep them focused. One change per pull request makes review fast.
- Open an issue first for anything larger than a bug fix, so the approach can
  be agreed on before you write the code.
- Describe what changed and why. Screenshots are welcome for anything visual.
- Make sure `npm run lint` and `npm test` pass locally.

## Reporting bugs

Open an issue with the [bug report template](https://github.com/niekes/charts-3d/issues/new/choose).
A reproduction is worth more than a description: a StackBlitz, a minimal snippet
or a failing test case is ideal. Bugs in the projection or the depth sorting
itself belong to [d3-3d](https://github.com/niekes/d3-3d/issues).

## Documentation

The documentation site lives in `docs/` and is prerendered to static HTML:

```bash
npm run docs:dev      # local dev server
npm run docs:build    # production build into build/client
npm run docs:preview  # serve the production build
```

GitHub Pages serves the site under `/charts-3d/`, so `docs:build` moves the
prerendered pages from `build/client/charts-3d/` to the root of
`build/client/`, next to the assets, and keeps the SPA fallback as `404.html`.
Pages are deployed to GitHub Pages from `master`.

## Releases

Every version ships twice, from the same files: as the shadcn registry and as
the npm package `@niekes/charts-3d`. Bump `version` in `package.json` and add
its section to `CHANGELOG.md`. On `master`, the release workflow then does both:

- **The registry.** It tags `v<version>` and publishes the GitHub release, and
  the items can be pinned with `npx shadcn add niekes/charts-3d/<item>#v<version>`.
  The shadcn CLI does not pass the tag on to the registry dependencies, so the
  tag does not sit on the `master` commit: the workflow makes a release commit
  beside `master` in which every chart depends on
  `niekes/charts-3d/chart-3d#v<version>`, and tags that one. On `master` the
  dependencies stay unpinned.
- **The package.** It stages the version on npm with `npm stage publish`,
  through trusted publishing: OIDC instead of a token, provenance included. The
  version goes live once a maintainer approves it with 2FA, with
  `npm stage approve` or on npmjs.com.

Each half runs only if it is missing, so a release that failed halfway can be
rerun from the Actions tab (`workflow_dispatch`). The props and the exports of
`index.ts` are the API of the package: a change to them is a breaking change.

`npm pack --dry-run` shows what the package would ship: `dist/`, `LICENSE`,
`NOTICE`, `README.md` and `package.json`.

## Support

charts-3d is free and always will be. If it is useful to you and you want to help
keep it maintained, [become a sponsor](https://github.com/sponsors/niekes).
