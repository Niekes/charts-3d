# A prop name means one thing in every chart

Context: the charts read their data through props that name its fields, and
a review before 1.0 found the same idea under different names and shapes:
`format` as a record per axis and as a single function, and the field that
names an entry as `index`, `id` and `label`. From 1.0 every one is locked.

Decision: a prop name means one thing in every chart that has it, and a
chart reads an idea through the name the others give it.

- **`id` identifies an entry**: what its marks follow through new data. In
  the choropleth an entry's identity is its region, so joining on `id` is
  the same idea. In the places and the routes chart `id` names the entry in
  the tooltip too.
- **`label` titles the tooltip of an entry**, and nothing else: the globe
  and the choropleth.
- **`index` is the category along x of a wide table** - an entry per row of
  bars, a column per series - and so its identity and its name in the
  tooltip as well: the bar and the area chart. Not `x`: in the scatter and
  the line chart `x` is a number in a long table, and the bar chart would
  read like the scatter without working like it.
- **`keys` lists the columns that each hold a series** (wide data);
  **`series` names the one field whose value picks the series** (long data).
- **`x` and `z` are the position along their axis**: a field of the entry in
  a table, the positions of the columns and rows in a grid.
- **`format` is a record keyed by what it formats**: by axis where the chart
  has axes - the `x` of a category axis takes the category - and by field
  where it has none, `value`. The globe, the places and the choropleth chart
  took a single function in 0.7.
- **`tooltip` is what a mark says**, on every chart; **`placement` is the
  corner the tooltip sits at**, on the container, which took it as `tooltip`
  in 0.7.

Considered options: one name for the field that names an entry (rejected:
identity, title and category are three ideas - the choropleth needs identity
and title apart, the bar chart all three in one field); a single function
for `format` where a chart formats one number (rejected: the geo tooltips
print the latitude and longitude raw, and a record lets `format.lat` and
`format.lon` join in a minor version, where a function would need a major).

Consequences: the Props section of the `chart-3d` docs page lists the shared
names, and a new chart takes them from there. A field a chart lacks - a
`label` beside the `id` of the places chart, `x` and `z` in the tooltip data
of the surface, `format` on the routes chart - is a minor version and waits
until someone asks.
