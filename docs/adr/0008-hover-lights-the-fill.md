# Hover lights the fill of the element, not its edge

Supersedes the edge of [ADR-0002](0002-hover-highlight.md); the single
element, its `groups` and the no-fade rule of that decision stand.

Context: ADR-0002 highlighted the hovered element with an edge in the focus
color and kept its fill. An edge outlines the element: it reads as a frame
around what is in focus, where the whole fill lit reads as the element itself
in focus, and on every renderer alike.

Decision: pointing at a mark fills the marks of its element - named in
`groups` - with the focus color: `--chart-3d-focus` where it is set, else
their own fill lightened with `color-mix`, the color the edge drew in since
the amendment of ADR-0002, so the custom property keeps its meaning. A stroke
of the mark's own stays - a scatter point keeps its ring, a flow's inner faces
their seams - and nothing else changes: no edge, no fade, and the paint order
with its depth as before. The focus clears when the pointer leaves the mark or
the chart; through a drag it stays.

Consequences: the core draws no focus edge on any renderer, so the one pixel
difference ADR-0003 allowed for its width is gone; a mark's own stroke is the
only stroke whose width may differ. The hover test of every chart asserts the
lit fill and that every other fill stays.
