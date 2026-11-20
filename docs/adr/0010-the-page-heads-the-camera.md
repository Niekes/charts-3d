# The page may head the camera for a view

Context: the camera belonged to the reader alone - `defaultView` sets where
it starts, and the keys and gestures of ADR-0001 move it. A chart that
follows its data round the globe, such as a route that grows towards a place
on the far side, had no way to bring that place into view: a chart may not
move the camera (the core owns the interaction), and the page could only
remount the container.

Decision: `ChartContainer3D` takes `view`, a view the camera heads for. It
starts there, and when the view changes it glides there over the
`animationDuration`, so the camera turns in step with the data it follows,
and jumps where the reader asks for reduced motion. A view moves only what
it names: a view of yaw and tilt keeps the zoom and the pan of the reader.
It is a heading, not a lock: the reader turns the camera on from it at once,
the same view handed in again moves nothing, and a reset still returns to
`defaultView`. The core helper `facing(lon, lat)` gives the view that looks
at a place on the globe. Behaviour is a prop (ADR-0004), and the gestures of
ADR-0001 stay as they are.

Considered options: a controlled `view` with `onViewChange` (rejected: every
drag and wheel tick would go through the state of the page, and a page that
forgets to answer freezes the camera); an imperative handle, `ref.glideTo`
(rejected: it is not data, so a server render and a test could not state the
view); a `follow` prop on the geo charts (rejected: a chart would move the
camera, and every geo chart would grow the prop).

Consequences: the number 0009 is left to the ADR of the keyboard stepping
(issue #46), which was open when this one was written.
