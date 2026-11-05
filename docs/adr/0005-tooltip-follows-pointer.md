# The tooltip follows the pointer and flips within the chart

Context: the tooltip sat centred above an anchor each chart computed,
`Tooltip3D.at` - the top face of a bar, a point, the centre of a quad. It
jumped from one mark to the next and was cut off at the top of the chart.

Decision: the tooltip follows the pointer one to one, at its placement - a
corner beside the pointer, `"top-right"` unless `ChartContainer3D` says
otherwise with `tooltip`, the corners of `gizmo`. Where it would leave the
chart's box it flips, each axis alone, and only when the other side has more
room; it is never pushed inwards over the mark under the pointer. The core
measures the tooltip and the box in JS and writes the position to the DOM on
every move, so a move within a mark still renders nothing. The pointer
position is geometry and moves at once; only a flip glides, through
`translate`, and jumps where the reader asks for reduced motion - as with
the axis labels, geometry follows at once and only a change of side moves.
The tooltip comes and goes with the hover at once, no fade, no linger.
`Tooltip3D.at` is gone: nothing reads an anchor. The placement is a prop
because a user asked for it (behaviour is a prop, ADR-0004); the gap to the
pointer stays fixed.

Considered options: the mark's anchor (rejected: the tooltip jumps between
marks and covers what the pointer is on); an eased trail behind the pointer
(rejected: it lags across a row of bars); the viewport as the bounds
(rejected: the tooltip spills over the page beside the chart, and an
`overflow: hidden` parent still cuts it off); CSS anchor positioning with
`position-try-fallbacks` (rejected: jsdom cannot drive it, so the flip would
merge untested, and it flips by what fits, not by which side has more room);
a margin of hysteresis at the flip (rejected: more code for a swing that the
glide already softens); `tooltip={false}` and a knob for the gap (rejected:
nobody asked, and CSS hides the slot).

Consequences: removing `at` from the exported `Tooltip3D`, and `center`,
which only computed it, is a breaking change, released as 0.6.0. A chart
builds a tooltip from its title and items only.
