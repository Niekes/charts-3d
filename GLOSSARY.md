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
