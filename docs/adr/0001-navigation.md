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
modifier is held (then a hand, `grab`), and `grabbing` while a rotate drag
turns.
