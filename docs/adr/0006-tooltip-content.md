# What a mark says on hover is a function of the data behind it

Context: each chart hard-wired its tooltip - the entry name, the series
label and a raw number - and the core showed a number with
`toLocaleString()`. `format` reached the ticks only, so a tick of "1.2k" sat
beside a tooltip of "1,234", and nothing an npm user could do changed a word
of it. ADR-0004 named a value formatter as the next rung and rejected render
props in general, with the tooltip as the one part that may follow when a
real need shows. It showed: the content and the numbers of the tooltip had
to be the user's.

Decision: every chart takes `tooltip`, a function `(tooltip, data) =>
Tooltip3D | null`. The first argument is what the mark would say - a title
and its items, built from the data behind the mark, its values as the ticks
name them through `format` - so a small edit spreads it; the second is what
the chart knows about the mark, in the words of its props: `{ entry, key }`
for a bar, `{ entry }` for a point, `{ key, entries }` for a face of a
ribbon, `{ row, column, value }` for a cell. `null` shows none. The box and
the items of the tooltip stay the core's, and the container's `tooltip` stays
the placement. A mark carries its tooltip as a function the core calls when
the pointer lands on it, so the user's function never runs per mark per
frame. The tooltip is built from the data value, not the gliding number: the
core sets it when the pointer lands and a glide never updates it, so the
gliding number froze mid-glide, and a number in a box has no reason to
glide. A mark whose entry has left the data says nothing, since there is
nothing to build it from.

Considered options: a value formatter only (rejected: the labels and the
items stay fixed); raw markup for the inside of the box (rejected: nobody
asked, and a `content` field is a minor later); the prop on the container
(rejected: the core knows nothing about the charts, so it could hand over
the default and nothing behind it); one object argument (rejected: the
default first keeps the common edit a one-liner, and the second argument is
an object, so a field added later is a minor); the function per mark per
frame (rejected: thousands of calls per frame at the size the many demos
prove); the gliding number (rejected: it froze mid-glide); keeping the last
entry of a leaving mark (rejected: state in every chart for a hover of under
a second).

Consequences: `format` reaches the tooltip of every chart and a leaving mark
says nothing, for every user, not only for those who pass `tooltip`;
`Mark3D.tooltip` widens to a function. The template check requires `tooltip`
in every chart's props, so a new chart never ships with a tooltip nobody can
change.
