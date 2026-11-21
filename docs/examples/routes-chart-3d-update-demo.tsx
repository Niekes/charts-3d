import { useState } from "react"

import { ChartContainer3D, type Renderer3D } from "@/components/ui/chart-3d"
import { RoutesChart3D } from "@/components/ui/routes-chart-3d"
import { land } from "@/docs/examples/land"
import { Button, RendererSelect } from "@/docs/examples/renderer-select"
import { routeConfig, chartView, stops } from "@/docs/examples/routes-chart-3d-demo"

// The same five legs by two plans: a stop keeps its number and moves to another capital.
const plans = [
  ["London", "Reykjavík", "Ottawa", "Havana", "Brasília", "Dakar"],
  ["Lisbon", "London", "Washington,  D.C.", "Mexico City", "Lima", "Cape Town"],
].map((names) => stops("atlantic", names).map((stop, i) => ({ ...stop, number: `Stop ${i + 1}` })))

export default function RoutesChart3DUpdateDemo() {
  const [plan, setPlan] = useState(0)
  const [renderer, setRenderer] = useState<Renderer3D>("svg")

  return (
    <div className="flex flex-col gap-2">
      <ChartContainer3D config={routeConfig} renderer={renderer} defaultView={chartView}>
        <RoutesChart3D data={plans[plan]} land={land} lon="lon" lat="lat" id="number" />
      </ChartContainer3D>
      <Button onClick={() => setPlan(1 - plan)}>Update</Button>
      <RendererSelect renderer={renderer} onChange={setRenderer} />
    </div>
  )
}
