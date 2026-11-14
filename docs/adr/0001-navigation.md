# Navigation: the platform modifier and a drag rotate

Context: a 3D chart in a docs page must not fight the page or the OS. A plain
drag therefore does nothing but inspect - the cursor stays the default pointer
and the hover highlight reads cleanly. Rotating takes the platform modifier
and a drag: ⌘ on macOS, Ctrl on Windows and Linux (the Windows key opens the
Start menu there, so Ctrl is the agnostic choice; detected via
`navigator.userAgentData.platform` / `navigator.platform`). Panning is Space
and a drag, the hand of the design tools; zooming is Ctrl or ⌘ with the wheel,
which is also how a trackpad pinch arrives in the browser, while the plain
wheel keeps scrolling the page. A double click resets. The keys - arrows
rotate, Shift+arrows pan, `+`/`-` zoom, `0` resets, `?` lists them - stay on
alongside.

Considered options: plain drag rotates (three.js OrbitControls default), rejected
because a docs-embedded chart must not capture every drag; ⌘+drag on every
platform, rejected because the OS and the browser intercept it off Mac.

Consequences: the shortcut panel and the `aria-label` show the modifier per
platform ("⌘ Drag" on a Mac, "Ctrl Drag" elsewhere), and `keymap` can turn the
gesture off like any other action. The modifier is re-checked on every pointer
move, so releasing it mid-drag stops the rotation. On touch there is no
modifier, so a touch drag only inspects; rotation there is arrow keys (or an
opt-in `keymap` rebinding). The cursor is the default pointer until the
modifier is held (then a hand, `grab`), and `grabbing` while the camera
turns; a missed keyup (window blur while the modifier is held) resets the hand.

Amended 2026-11-04: Alt and a drag pans - ⌥ on a Mac - and Space and a drag
is gone. With the platform modifier on the rotate and Ctrl or ⌘ on the wheel,
Alt is the modifier left free, the browser claims no Alt-drag of its own, and
Space goes back to the page, which it scrolls. Some Linux window managers
still take Alt and a drag to move the window; where they do, the chart never
sees the drag, and panning falls back to Shift and the arrow keys. `keymap`
turns `dragPan` off on its own, like any other action.

Amended 2026-11-04: the zoom follows the platform modifier, like the rotate -
the panel says "⌘ Scroll" on a Mac, "Ctrl Scroll" elsewhere - so every
gesture but the pan reads as the one modifier. Ctrl and the wheel keeps
zooming on a Mac too, unannounced, because a trackpad pinch arrives in the
browser as Ctrl and the wheel and cannot be told from the keys; the Windows
key and the wheel zoom nothing. The cursor now names every gesture, not only
the rotate: Alt held shows the four arrows (`move`), through a pan drag too,
and a wheel zoom shows `zoom-in` or `zoom-out` by its direction, falling back
to the hand shortly after the last tick.

Amended 2026-11-09: a turn is divided by the zoom, in `moved`, where every
step lands. Zoomed in eight times, a drag turned the chart the same angle as
zoomed out, and the picture flew eight times as far under the pointer; now
the drag moves it as far as it did, and an arrow key turns it as far on
screen, as the 3D viewers of the browser slow their rotation as the camera
nears. The zoom itself was a factor per tick already, and stays one.

Amended 2026-11-12: the wheel zooms to the cursor - the point under it stays
where it is, zooming in and out alike, as in maps and design tools, so
zooming in and back out lands on the same view. The zoom therefore moves the
pan with it, by the zoom after its limits: at 1/4 and 8 the chart stands
still instead of sliding. A trackpad pinch anchors the same way, because it
arrives as the wheel. `+` and `-` have no cursor and keep zooming to the
middle of the chart, wherever the pointer rests. There is no prop to get the
zoom to the centre back: the gestures are identity (ADR-0004).

Amended 2026-11-13: a vertical swipe on the chart scrolls the page. The svg
took every touch (`touch-none`) for a drag that a phone, having no modifier,
could never make, so a chart taller than half the screen trapped the reader.
It now carries `touch-pan-y`: the browser scrolls on a vertical swipe, and a
tap and a sideways drag still reach the chart and inspect.

Amended 2026-11-13: two fingers orbit and zoom on a touch screen. A phone
has no modifier and no arrow keys, so the chart could not be turned there at
all. Two fingers are one gesture, as on a map: the movement of the point
between them turns the camera, the change of their distance zooms, both at
once, and the zoom goes to that point as the wheel's goes to the cursor. One
finger keeps what it had - a vertical swipe scrolls the page, a tap and a
sideways drag inspect - so the chart still never traps the reader. There is
no pan on touch: two fingers cannot both turn and pan. Considered and
rejected: one finger rotates (tricharts offers it as `touchRotate`), because
it takes the page scroll; a toolbar of rotate and zoom buttons, a fourth
overlay for what the gesture and the keys already do. The browser would take
a two-finger vertical drag for a scroll under `touch-pan-y`, so the core
claims the touch itself once the second finger lands - only fingers that
landed on the chart count, so a thumb resting beside it leaves the scroll
alone, and a scroll the browser has begun stays the browser's. While two
fingers hold the chart, its tooltip goes, as in a drag, rather than jumping
from one finger to the other. Both are actions of
`SHORTCUTS`, off through `keymap` like any other.
