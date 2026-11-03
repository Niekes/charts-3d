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
the outermost ticks.
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

**Renderer demo**:
The docs section that shows one chart on every renderer, with a switch
between `"svg"`, `"canvas"` and `"webgl"`.
_Avoid_: renderer example, playground

## The pointer

**Hover**:
The pointer over a mark: its tooltip shows and its groups come into focus,
and both go when the pointer leaves the mark or the chart.
_Avoid_: mouseover, highlight state

**Focus**:
The groups of the hovered mark, lit while the pointer is on it; every mark
and label that shares none of them fades in place. Every chart's marks carry
their groups - their key and their series - so the fade works in every chart.
_Avoid_: selection, highlight, active state

## Navigation

**Orbit**:
Turning the camera around the chart, with a drag or an arrow key.
_Avoid_: rotate the view, spin

**Pan**:
Moving the chart within the view, with Space and a drag or Shift and an
arrow key.
_Avoid_: Cmd and drag (the browser and the OS take it), scroll, move the camera

**Zoom**:
Moving the camera closer, with Ctrl or ⌘ and the wheel - a trackpad pinch
arrives that way - or `+` and `-`. The wheel alone scrolls the page.
_Avoid_: pinch without Ctrl, dolly, scale
