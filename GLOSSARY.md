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

**Enter**:
A part the new data brings: a mark with a new key, a tick the axis did not
have, the gridline of that tick. It comes in gradually - a mark grows from
its enter value, a part of the axes fades in - where a part the data drops
goes at once. Only a tick beyond the new ends of its axis stays and fades
out as the gliding end sweeps past it, the mirror of its entering.
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
hover, tooltip and focus act alike. Only the pixels may differ - webgl draws
fills only, so the focus edge shows on SVG and canvas.
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
`data-slot` name, to restyle, move or hide with CSS.
_Avoid_: css hook, class name

## The pointer

**Hover**:
The pointer over a mark: its tooltip shows and its groups come into focus,
and both go when the pointer leaves the mark or the chart.
_Avoid_: mouseover, highlight state

**Focus**:
The element under the pointer, highlighted with an edge in the foreground
color - white in the dark theme, black in the light; the fill never changes.
Every chart's marks carry their `groups`, naming the marks highlighted
together: one bar, one point, one cell.
_Avoid_: selection, active state, fade

## Navigation

**Orbit**:
Turning the camera around the chart, with the platform modifier and a drag -
⌘ on a Mac, Ctrl elsewhere - or an arrow key; a plain drag only inspects.
_Avoid_: rotate the view, spin, plain drag

**Pan**:
Moving the chart within the view, with Space and a drag or Shift and an
arrow key.
_Avoid_: Cmd and drag (the browser and the OS take it), scroll, move the camera

**Zoom**:
Moving the camera closer, with Ctrl or ⌘ and the wheel - a trackpad pinch
arrives that way - or `+` and `-`. The wheel alone scrolls the page.
_Avoid_: pinch without Ctrl, dolly, scale
