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

// The tour shows the stop it left and the stop it heads for. A new stop
// grows its leg from the one before it, the stop left behind draws its leg
// back, and the view of the container turns the globe to the new stop.
export default function RoutesChart3DEnterDemo() {
  const [at, setAt] = useState(1)
  const [renderer, setRenderer] = useState<Renderer3D>("svg")
  const [from, to] = [tour[(at - 1) % tour.length], tour[at % tour.length]]

  return (
    <div className="flex flex-col gap-2">
      <ChartContainer3D
        config={chartConfig}
        renderer={renderer}
        animationDuration={1250}
        view={facing(to.lon, to.lat)}
      >
        <RoutesChart3D data={[from, to]} land={land} lon="lon" lat="lat" id="name" />
      </ChartContainer3D>
      <button
        type="button"
        onClick={() => setAt(at + 1)}
        className="inline-flex h-8 items-center justify-center self-center rounded-md border border-input bg-background px-3 text-xs font-medium hover:bg-accent hover:text-accent-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        {from.name} → {to.name} · Next stop
      </button>
      <RendererSelect renderer={renderer} onChange={setRenderer} />
    </div>
  )
}
