# A stack is a row along z

Context: stacking the series of the bar chart on one another takes them off
z, where each series stands in a row of its own, and leaves the depth empty -
the 3D stacked column of office software, which ADR-0015 rejects. The
charts that stack in 3D put three things on z: a second category on the
floor, x by z, with the series stacked over each cell (ECharts-GL `bar3D`);
a row per stack group, each series naming the group it joins (Highcharts
`stack` with `grouping: false`); or nothing (Excel, AnyChart, amCharts).

Decision: the depth of a stacked bar chart is the stack. `stack` maps a key
to the name of its stack; keys of the same name stand on one another, in the
order of `keys`, in one row along z, which the axis names by the stack. A
key without one stands alone, as every key does today, so the bar chart
without `stack` is the chart it was.

## Considered Options

- **A second category along z** (ECharts-GL), a `z` field with the keys
  stacked over each cell. Rejected: it changes what `keys` lays out on the
  presence of another prop, and the wide table of the bar chart has one
  category, `index`. A table of two categories is the bar field's, a grid.
- **No depth** (Excel). Rejected by ADR-0015.
- **`stack` in the chart config**, beside `symbol`. Rejected: it would stack
  every chart of the container, and stacking is behaviour, a prop (ADR-0004).
- **`stacks`, a list of the stacks, each a list of keys.** Rejected: it
  names the series a second time beside `keys`, and the two can disagree.

## Consequences

`stack` keeps its meaning wherever another chart stacks (ADR-0012). A single
stack of every key is allowed, as a single series is, and draws a 2D chart:
the docs say so and never show one. Percent stacking waits until someone
asks; a page normalises its data in one `map`.
