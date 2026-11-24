# The depth of a chart shows data

Context: a 3D chart can spend its third dimension on data or on looks. The
3D charts readers know best spend it on looks: the 3D pie of office
software, the funnel and the pyramid, bars drawn as cylinders or cones.
Their thickness adds no number, and the tilt bends the numbers that are
there: the slice at the front of a tilted pie looks larger than its twin at
the side. They are also the 3D charts asked for most. Every chart of the
registry up to 1.0 spends its depth on data - rows and series; x, y and z;
a value over a grid - or on the shape of the earth.

Decision: the depth of every chart shows data or the shape of the earth. A
chart whose depth is decoration - a pie of one thickness, a funnel, a
pyramid, cylinder or cone bars, shaded spheres in place of dots - does not
join the registry, however often it is asked for. Where a reader expects
such a chart, the registry offers the form whose depth carries a value: a
donut joins it only as one whose slices rise to a value.

## Considered Options

- **A classic 3D pie**, for the demand. Rejected: its depth adds nothing,
  and the tilt of every view but the one from straight above bends the
  angles that carry its numbers.
- **A shape for the bars** - cylinders, cones, pyramids, which `box` and
  `lathe` of d3-3d could draw. Rejected: decoration, and a knob nobody
  turns (ADR-0004).

## Consequences

Before a chart is built it answers what its depth shows. A request for a
decorative form is answered with the chart that carries the same data in
its depth, not with a prop.
