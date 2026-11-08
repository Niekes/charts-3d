# Customization climbs a ladder - props for behaviour, CSS for looks, ADRs for identity

Context: two kinds of users consume these charts. Registry users own their
copy - the shadcn model, where the escape hatch is editing the file - and npm
users depend on the API, where every prop is semver. Without a rule, every
wish becomes a prop, and the API grows until it freezes the internals.

Decision: every knob chooses a rung.

- **Behaviour is a prop.** What differs per app: `keymap` (keys replaced,
  labels renamed - the language with them - and actions turned off), `renderer`,
  `animationDuration`, `defaultView`, what shows (`legend`, `shortcuts`,
  `gizmo`), and the data props of the charts. A behaviour prop comes with a
  doc comment, a `@defaultValue` and a test; an added knob is a minor, a
  changed one a major.
- **Looks are CSS.** The theme tokens (`--chart-1..5`, `--muted`, `--border`,
  `--background`, `--foreground`) and the slots: every visible part carries a
  `data-slot`, the public hook for a stylesheet, documented on the theming
  page. There are no style props: a second styling channel beside the theme
  would drift from it.
- **Identity is fixed.** Hover highlights with an edge and never changes the
  fill (ADR-0002), the gestures follow the 3D viewers of the browser, gated
  by the platform modifier (ADR-0001), and every renderer draws the same
  scene (ADR-0003). Changing identity means editing the owned copy, not
  turning a prop.

A knob nobody turns is API debt: the motion constants (camera glide, axes
fade), the step sizes and limits of the camera, the tick density, the walls
and gridlines, and the width of the focus edge stay fixed until a user asks
for them.

Considered options: style props (rejected: two sources of truth beside the
theme); render props or a slot-component per part (rejected: freezes the
internals into the API; `ChartLegend3D` stays the one composable, and the
tooltip may follow when a real need shows); everything fixed (rejected: npm
users cannot edit their copy).

Consequences: a new visible part carries a `data-slot`, and the slot table on
the theming page grows with it - `evaluate-chart` checks both. The props are
semver, as AGENTS.md records. The `shortcuts` button corner, the `help` icon,
a tooltip value formatter and cursor custom properties are the next rungs to
climb, in that order, when asked.

Amended 2026-11-08: the tooltip followed, as a function per chart of what
the mark would say and the data behind it (ADR-0006), in place of the value
formatter: a formatter alone left the labels and the items fixed.
