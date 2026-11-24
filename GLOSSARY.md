# charts-3d

Shared language for the 3D chart registry: the box a chart draws its marks
in, and the axes that read them. The terms here describe what the reader
sees, not how the code draws it.

## The data

**Entry**:
What the data of a chart lists, one by one: a row of bars, a point, a stop, a
place, the value of a region, a slice. Its identity - a name of its own, the region
it colors, or else its place in the data - is what its marks follow through
new data. A name is its own within its series: Jan of one line is not Jan
of another. A cell of a grid is no entry: it is where it stands.
_Avoid_: record, datum, item, row (a row is a row of bars)

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
A short line from a tick toward its label, pointing away from the box.
Where the label moved to make room, the tick mark follows it: in a smooth
curve where it slid along the edge, straight out where it took a second
row, unless its way out would run through a tick label of the first row:
then it stays short. A tick mark never crosses another, nor a tick label of
its own edge.
_Avoid_: tick stroke, tick, leader line

**Axis title**:
The name of an axis: along its edge, never upside down, beyond the tick
labels at the middle of the edge. Where the edge points at the camera and
has no length on the screen, the title is gone.
_Avoid_: axis label, caption, title (bare: the tooltip has one too)

**Cell**:
The span between two neighbouring data positions along an axis of
arrangement, such as one row of bars; where they stand unevenly, the
smallest such span.
_Avoid_: step, slot

**Padding**:
The room the box keeps between the outermost data and its walls: half a
cell, on the axes of arrangement, never below the floor the data stands on.
_Avoid_: margin, gap

## The marks

**Mark**:
One shape of a chart - a bar, a point, a face of a ribbon - projected into
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

**Slice**:
The part of the ring of a donut between two angles, as wide as its share of
the whole and as tall as its value - the mark of the donut chart. Slices
touch, in the order of the data, clockwise seen from above. A slice that
comes widens out of its neighbours and rises as it fades in, and a gone one
narrows back into them as it sinks; a value below 0, or none, is no slice.
_Avoid_: wedge, sector, segment (a piece of a line), arc, piece

**Line**:
The points of one series joined in the order of the data, as wide on the
screen from every side - the mark of the line chart. A point that comes
unfolds from its neighbour on the line as it fades in, and a gone one folds
back into it; an entry without a place breaks the line. Pointing at a line
lights the point nearest the pointer - the halves of the segments at it,
with a dot on it - and the line answers with that point.
_Avoid_: path, trajectory, curve, polyline, stroke

**Segment**:
The straight piece of a line between two points next to each other. On
hover, each half of it speaks for the point at its end.
_Avoid_: edge, link, section

**Route**:
The stops of one series joined in the order of the data, over the globe -
the mark of the routes chart. A stop that joins the end of a route grows its
leg out of the stop before it, and a gone one draws its leg back; an entry
without a place breaks the route.
_Avoid_: flow, arc, path, trip, flight

**Stop**:
A place a route visits, a circle on the globe at its longitude and latitude.
One on the far side of the globe is hidden by it. Pointing at a stop lights
that stop alone.
_Avoid_: waypoint, node, marker, dot

**Tip**:
The last stop of a route, where the route stands now: drawn as its symbol in
place of the circle, where it has one. As a stop joins the route, the tip
travels its leg to it; a tip that leaves the data keeps its symbol while its
leg draws back, and the stop before it is the tip once it is gone.
_Avoid_: head (too near heading, the camera's), end, cursor, vehicle

**Symbol**:
The picture the tip of a route is drawn as, such as a plane or a ship: the
outline of an icon, in the color of the tip, outlined as its icon set draws
it or filled, and ringed by the background. What colors the tip gives it its
symbol: its leg, or else its route. It is flat to the reader and as large on
the screen from every side. One that names the way it points turns to its
bearing; one that names none, as a car seen from the side, stays upright.
_Avoid_: icon (the picture of a legend entry), marker, glyph, pin, sprite

**Leg**:
The part of a route between two stops next to each other, along the great
circle, the shortest way over the surface. It ends at the horizon. Pointing
at a leg lights that leg alone, and it names its two stops. A leg has the
color of its route, or one of its own, which the stop it arrives at names
and shares.
_Avoid_: arc, link, edge, segment

**Bearing**:
The way a symbol that turns points, the way its tip comes: along the leg
that arrives at the tip, where the leg meets it, as the camera shows it. A
tip without a leg points the way it moves, and where it stands it keeps the
bearing it came with, as one whose leg has drawn back into it. A tip that
never came from anywhere has none: its symbol shows as its icon set draws it.
A bearing never jumps: where the tip passes from one stop to another, takes
its first leg or sets out another way, the symbol turns the shorter way as
it sets out - clockwise where it flies back the way it came - and has
turned when about a quarter of its leg is flown.
_Avoid_: heading (the camera's), direction, rotation, angle

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
The marks of a container as plain data, in paint order: a set per
`Marks3D`, in their order in the tree. Every renderer draws the scene and
the hover hit-tests it, so a chart is data-driven on every renderer and
never keeps a copy of its own.
_Avoid_: data binding, virtual DOM, custom elements

**Renderer**:
How the marks are drawn: as SVG elements, or painted on a canvas; the box,
its labels, the tooltip and the legend stay SVG and HTML with every renderer.
_Avoid_: painter, backend, layer

**Fallback**:
The renderer a chart draws with where the requested one is not to be had:
canvas falls to SVG, where the browser has no canvas. A chart falls when it
starts.
_Avoid_: degradation, downgrade, polyfill

**Mark shape**:
The form of a mark: a polygon, a circle around its one point, or a symbol at
its one point. The shapes
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
between `"svg"` and `"canvas"`.
_Avoid_: renderer example, playground

**Many demo**:
The docs section that shows one chart with thousands of marks, on canvas and
with the renderer switch - the proof the chart stays interactive at size.
_Avoid_: performance demo, stress test, benchmark

**Frame time**:
The time from one painted picture to the next while the camera orbits in a
Many demo, in milliseconds; never below one refresh of the screen. The
number the project tracks to get faster.
_Avoid_: fps, speed, performance score

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
one point, one cell, one slice, the point of a line.
_Avoid_: selection, active state, fade, edge

## Navigation

**Orbit**:
Turning the camera around the chart, with the platform modifier and a drag -
⌘ on a Mac, Ctrl elsewhere - with two fingers on a touch screen, or with an
arrow key; a plain drag and a single finger only inspect.
_Avoid_: rotate the view, spin, plain drag, one-finger drag

**Pan**:
Moving the chart within the view, with Alt - ⌥ on a Mac - and a drag, or
Shift and an arrow key.
_Avoid_: Space and a drag (gone), Cmd and drag (the browser and the OS take it), scroll, move the camera

**Zoom**:
Moving the camera closer to the point under the cursor, which stays where it
is, with the platform modifier and the wheel - ⌘ on a Mac, Ctrl elsewhere,
and a trackpad pinch arrives as Ctrl and the wheel on every platform - or,
with `+` and `-`, to the middle of the chart. On a touch screen two fingers
pinch, and the point between them stays. The wheel alone scrolls the page.
_Avoid_: dolly, scale, zoom to the centre (the wheel)

**Default view**:
The view the camera starts at and a reset returns it to. Unlike a
heading, changing it moves nothing: only the next reset goes to the new one.
_Avoid_: home, initial view, start position

**Heading**:
A view the page gives the camera to head for: the camera glides there when
the heading changes, and the reader turns on from it.
_Avoid_: controlled view, camera lock, fly-to

**Gesture**:
What the pointer does to move the camera - a drag with a modifier, the wheel
with one, two fingers - as the shortcut panel names it beside the keys of the
same action.
_Avoid_: hint (the line of a missed drag, below), mouse shortcut

**Hint**:
The line that names the gesture a drag missed: a drag without the platform
modifier, or one finger dragged sideways, moves nothing, and the chart says
for a moment what would have turned it. It says nothing where that gesture
is off.
_Avoid_: toast, tutorial, onboarding, the gesture text of the shortcut panel
