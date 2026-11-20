# The tip of a route is a symbol of path data

Context: a route shows where it stands now only by its last circle. A page
that plays a journey - it adds a stop, the leg grows, the view follows
(ADR-0010) - wants the vehicle there: a plane that points along its leg, a
car, a ship, taken from the icon set of the project. A mark is plain data
that every renderer draws and the hover hit-tests (ADR-0003), in a CSS color
the hover lightens (ADR-0008), so it cannot be a React component.

Decision: the tip, the last stop of a route, is drawn as a symbol, the third
mark shape. A symbol is one string of SVG path data in a box of 24, declared
in the chart config beside the color of its key: `symbol: { path, points,
fill }`. It is drawn in the one color of the tip - outlined, as Lucide draws
its icons, or filled with `fill` - ringed by the background, flat to the
reader and of one fixed size, and the pointer hits the disc around it. One
that names where it points at rest, `points` in degrees clockwise from up,
turns to its bearing, the way it comes: the leg that arrives, as the camera
shows it, and without a leg the way it last moved. A bearing never jumps:
where the tip passes to another stop the symbol turns into its new bearing
as it sets out, the shorter way round, a glide of its own. One that names
none stays upright, as a car seen from the side. Every stop before the
tip stays a circle; a flag at a stop is text in its label, never a mark. The
registry takes on no icon package (issue #28): the page copies the path.

Considered options: a React component, such as `<Plane />` of lucide-react
(rejected: the canvas cannot draw it and the scene would hold no data for
the hit test); an image mark that draws any SVG file, flags too (rejected:
it loads late on the canvas, takes no theme color and has no fill for the
hover to lighten, so ADR-0008 would need a second rule); the elements of an
icon as data, `circle` and `rect` beside `path` (rejected: more to draw
alike on every renderer, to save a conversion the page does once); a symbol
that lies on the globe (rejected: a sliver towards the horizon, where the
circle and the leg are as large from every side); a symbol at every stop, or
on every leg (rejected: a route is in one place at a time, and a route that
comes back to a stop would stack two); a `progress` prop that plays the
route (rejected: the chart is driven by its data, and the page that adds a
stop already moves the tip).

Consequences: `Mark3D` becomes a discriminated union with an exhaustive
switch wherever the core draws, and the parity test drives the symbol on
every renderer. An icon with a `circle` or a `rect`, as Lucide's car, is
converted to path data by the page, once. A symbol seen from the side is not
mirrored when its leg runs west. Only the routes chart reads `symbol`. The
number 0009 stays with the keyboard stepping (issue #46).
