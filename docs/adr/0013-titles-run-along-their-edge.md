# The title of an axis runs along its edge

Context: the title of an axis ran along its edge from #17 and stood upright
from #43, because "Visitors" stood on end beside the y axis. Upright, each
placement broke from some side: the y title over the top end of its axis
landed among the bars seen from straight above, where that end lies on the
floor, and the title of a floor axis stuck out sideways from the box by the
width of its text where its edge ran down the screen.

Decision: every title runs along the line of its axis as the screen shows
it, folded so it never reads upside down, beyond its tick labels at the
middle of the edge, as tricharts lays its titles out. It turns with the line
itself, not square to the normal of the edge, which perspective leans off
it, and stands off square to the line as far as the tick labels reach. A
title fades out as its edge, pointing at the camera, shrinks below a line on
the screen: there is no edge left to run along.

## Considered Options

- **Drop the titles from the box** and name the axes in the tooltip and the
  ticks alone. Kept in reserve, should this placement fail too.
- **Lay the text in the floor plane**, skewed by the perspective, as
  tricharts does. Rejected: near the horizon it cannot be read, and the
  labels stay flat screen text on every renderer (ADR-0003).
- **Put the titles at the end of their axis**, as tricharts does for x and z.
  Rejected: the ends are corners the other axes label.
- **Keep every title on one edge**, as tricharts can by limiting the camera
  to a quarter turn. Rejected: the camera turns all the way round
  (ADR-0001), so a title follows the chosen edge.
