# The floor titles run along their edge, the y title stands upright

Context: the title of an axis ran along its edge from #17 and stood upright
again from #43, because "Visitors" stood on end beside the y axis. Upright,
the title of a floor axis sits beyond its tick labels as wide as its text:
seen from above, the z edge runs down the screen and its title sticks out
sideways from the box, a caption of nothing.

Decision: the titles of the floor axes, x and z, turn with their edge on
the screen and flip so they never read upside down, beyond their tick labels
at the middle of the edge; the gap they take from the box is the height of
the text. The y title stays upright over the top end of its axis (#43).

## Considered Options

- **Lay the text in the floor plane**, skewed by the perspective, as
  tricharts does. Rejected: near the horizon it cannot be read, and the
  labels stay flat screen text on every renderer (ADR-0003).
- **Put the floor titles at the end of their axis**, as tricharts does.
  Rejected: the ends are corners the other axes label.
- **Keep every title on one edge**, as tricharts can by limiting the camera
  to a quarter turn. Rejected: the camera turns all the way round
  (ADR-0001), so a title follows the chosen edge.
