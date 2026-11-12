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
