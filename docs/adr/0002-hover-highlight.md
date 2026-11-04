# Hover highlights the single element with an edge only - no fill change

Context: on hover, a chart marks what the pointer is on. Earlier versions faded
everything else darker; that was a fill change and read as brightness, not as a
highlight, and groups made whole series or whole node neighborhoods light up.

Decision: the fill never changes on hover, with any renderer. The core gives
exactly the marks of the hovered element - named in its `groups` - an edge in
`var(--foreground)`, white in the dark theme and black in the light. The element is single: one bar, one point, one cell. Graph-like
charts may relate instead - a node's marks can carry the keys of its links, so
hovering a node highlights the connected part. The edge
clears when the pointer leaves the mark or the chart; through a drag it stays.

Considered options: fading the rest darker (rejected: a color change, and group
membership highlighted more than the element), brightening the hovered fill
(rejected for the same reason). WebGL draws fans only, so the edge shows on SVG
and canvas; there the hover still shows the tooltip.

Consequences: every chart gives its marks `groups` naming the marks of the same
element; `new-chart` and `evaluate-chart` encode this as a checklist row. A mark
that carries its own stroke (a scatter point's background ring, a flow's
inner faces) keeps it, so a multi-face element is outlined without seams between
its parts; a background ring turns into the foreground edge on hover.
