import { useState } from "react"

import { ChartContainer3D, facing, type Renderer3D } from "@/components/ui/chart-3d"
import { RoutesChart3D } from "@/components/ui/routes-chart-3d"
import { land } from "@/docs/examples/land"
import { RendererSelect } from "@/docs/examples/renderer-select"
import { chartConfig, stops } from "@/docs/examples/routes-chart-3d-demo"

// A tour of the world, capital by capital, eastwards and home again.
const tour = stops("atlantic", [
  "London",
  "Cairo",
  "New Delhi",
  "Beijing",
  "Tokyo",
  "Wellington",
  "Lima",
  "Mexico City",
  "Ottawa",
  "Reykjavík",
])

// How long a step of the tour takes, in ms: the leg grows for as long, then draws back for as long.
const STEP = 1250

// The tour rests on one stop. A step adds the next one, so its leg grows
// out of the stop the tour is on while the view of the container turns the
// globe to it; then the stop left behind goes, and the leg draws back
// towards the new one.
export default function RoutesChart3DEnterDemo() {
  const [[tail, head], setSpan] = useState([0, 0])
  const [renderer, setRenderer] = useState<Renderer3D>("svg")
  const shown = tour.concat(tour).slice(tail % tour.length, (tail % tour.length) + head - tail + 1)
  const at = shown[shown.length - 1]

  return (
    <div className="flex flex-col gap-2">
      <ChartContainer3D
        config={chartConfig}
        renderer={renderer}
        animationDuration={STEP}
        view={facing(at.lon, at.lat)}
      >
        <RoutesChart3D data={shown} land={land} lon="lon" lat="lat" id="name" />
      </ChartContainer3D>
      <button
        type="button"
        onClick={() => {
          setSpan(([from, to]) => [from, to + 1])
          setTimeout(() => setSpan(([, to]) => [to, to]), STEP)
        }}
        className="inline-flex h-8 items-center justify-center self-center rounded-md border border-input bg-background px-3 text-xs font-medium hover:bg-accent hover:text-accent-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        {at.name} · Next stop
      </button>
      <RendererSelect renderer={renderer} onChange={setRenderer} />
    </div>
  )
}
