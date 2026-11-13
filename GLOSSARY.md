# charts-3d

Shared language for the 3D chart registry: the box a chart draws its marks
in, and the axes that read them. The terms here describe what the reader
sees, not how the code draws it.

## The chart box

**Wall**:
A face of the chart box, drawn with its gridlines when it faces away from
the camera.
_Avoid_: face, panel

**Edge**:
A side of the box outline, where an axis sits with its line, its tick marks
and its labels.
_Avoid_: border, side

**Chosen edge**:
The edge an axis sits on for the current camera; the axis fades from one
edge to the next as it turns.
_Avoid_: active edge

**Gridline**:
A line across a wall, marking one tick value of the axis the wall belongs
to.
_Avoid_: wall line

## An axis

**Axis line**:
The line that carries the scale of an axis, along its chosen edge between
the outermost ticks. While the axis glides into new data it ends at the
gliding end, never at a tick beyond it.
_Avoid_: axis border, box edge line

**Tick mark**:
A short line at a tick, pointing away from the box.
_Avoid_: tick stroke, tick

**Axis title**:
The name of an axis, upright: over the top end of the vertical axis, on the
box's side of the axis line with its edge on that line, clear of the top of
the box as far as that keeps it by its axis; beyond the tick labels of a
floor axis, at the middle of its edge.
_Avoid_: axis label, caption, title (bare: the tooltip has one too)

**Cell**:
The span between two neighbouring data positions along an axis of
arrangement, such as one row of bars.
_Avoid_: step, slot

**Padding**:
The room the box keeps between the outermost data and its walls: half a
cell, on the axes of arrangement, never below the floor the data stands on.
_Avoid_: margin, gap

## The marks

**Mark**:
One shape of a chart - a bar, a point, a face of a flow - projected into
the chart box, in paint order.
_Avoid_: shape, element, datum

**Tile**:
The piece of the globe between two meridians and two parallels, a fixed
number of degrees wide. A tile with an entry rises from the globe to its
value; one without an entry is not drawn.
_Avoid_: cell, hexbin, bin, patch

**Land**:
The regions of the earth under the marks of a globe, drawn from the GeoJSON
the chart is given, in the color of a gridline unless the theme gives it
one. It is scenery: it neither enters nor answers the pointer.
_Avoid_: countries, map, features, background

**Region**:
A part of the land with an entry, colored over the land in the color of its
class - the mark of the choropleth. It fades in and out, since on a map a
shape that grows would mislead, and answers the pointer with its name and
its value.
_Avoid_: country, polygon, area, feature

**Dot**:
A circle on the land at a place, its area the value of the place - the mark
of the places chart. It grows from nothing as it fades in, and a dot on the
far side of the globe is hidden by it.
_Avoid_: bubble, marker, pin, point

**Ocean**:
The disc of the globe the land lies on, in the color of a wall unless the
theme gives it one.
_Avoid_: sea, sphere, backdrop

**Horizon**:
The edge of the ocean disc, where the land is cut and a tile beyond it is
hidden.
_Avoid_: silhouette, limb, clip

**Enter**:
A part the new data brings: a mark with a new key, a tick the axis did not
have, the gridline of that tick. It comes in gradually - a mark grows from
its enter value as it fades in, or only fades in, in place, where motion
would mislead; a part of the axes fades in, and the line of the axis grows
to it - and leaves as its mirror: a gone mark glides back to its enter value
as it fades out, or only fades out, before it goes; a dropped tick fades
out, in place or as the gliding end sweeps past one beyond the new ends, and
the line of the axis shrinks from it.
_Avoid_: appear, pop in

**Scene**:
The marks of a chart as plain data, in paint order: every renderer draws
the scene and the hover hit-tests it, so a chart is data-driven on every
renderer and never keeps a copy of its own.
_Avoid_: data binding, virtual DOM, custom elements

**Renderer**:
How the marks are drawn: as SVG elements, painted on a canvas, or
triangulated on webgl; the box, its labels, the tooltip and the legend
stay SVG and HTML with every renderer.
_Avoid_: painter, backend, layer

**Mark shape**:
The form of a mark: a polygon, or a circle around its one point. The shapes
are a closed vocabulary: a new one joins every renderer and the parity test
before a chart may use it.
_Avoid_: mark kind, mark type

**Parity**:
The same chart behaves the same on every renderer: every mark draws, and
hover, tooltip and focus act alike. Only the pixels may differ, such as the
width of a ring.
_Avoid_: pixel identity, visual equality

**Renderer demo**:
The docs section that shows one chart on every renderer, with a switch
between `"svg"`, `"canvas"` and `"webgl"`.
_Avoid_: renderer example, playground

**Many demo**:
The docs section that shows one chart with thousands of marks, on canvas and
with the renderer switch - the proof the chart stays interactive at size.
_Avoid_: performance demo, stress test, benchmark

## Styling

**Slot**:
A named part of the chart - the box, the marks, the tooltip, the legend, the
keyboard button and its panel, the gizmo - addressed from outside by its
`data-slot` name, to restyle, move or hide with CSS. The span between two
data positions on an axis is a cell, never a slot.
_Avoid_: css hook, class name

## The pointer

**Hover**:
The pointer over a mark: its tooltip shows and its groups come into focus,
and both go when the pointer leaves the mark or the chart.
_Avoid_: mouseover, highlight state

**Tooltip**:
The box that names the mark under the pointer and its values: a title and
its items, a label and a value each. What it says the chart decides, from
the data behind the mark, unless the app says otherwise; where it sits is
its placement. It follows the pointer and comes and goes with the hover, at
once. A mark on its way out of the data has none.
_Avoid_: popover, hover card, label (a label sits beside a mark, a tooltip
beside the pointer), rows (a row is a row of bars)

**Placement**:
The corner beside the pointer the tooltip sits at - above and to the right,
unless the chart says otherwise. Where the tooltip would leave the chart it
flips to the other side, on each axis alone and only where that side has
more room: past the right edge it sits to the left, past the top below.
_Avoid_: alignment, anchor, position

**Focus**:
The element under the pointer, lit: its fill in its own color lightened - or
in the focus color, where one is set; a stroke of its own stays. Every
chart's marks carry their `groups`, naming the marks lit together: one bar,
one point, one cell.
_Avoid_: selection, active state, fade, edge

## Navigation

**Orbit**:
Turning the camera around the chart, with the platform modifier and a drag -
⌘ on a Mac, Ctrl elsewhere - or an arrow key; a plain drag only inspects.
_Avoid_: rotate the view, spin, plain drag

**Pan**:
Moving the chart within the view, with Alt - ⌥ on a Mac - and a drag, or
Shift and an arrow key.
_Avoid_: Space and a drag (gone), Cmd and drag (the browser and the OS take it), scroll, move the camera

**Zoom**:
Moving the camera closer to the point under the cursor, which stays where it
is, with the platform modifier and the wheel - ⌘ on a Mac, Ctrl elsewhere,
and a trackpad pinch arrives as Ctrl and the wheel on every platform - or,
with `+` and `-`, to the middle of the chart. The wheel alone scrolls the
page.
_Avoid_: pinch without Ctrl, dolly, scale, zoom to the centre (the wheel)
