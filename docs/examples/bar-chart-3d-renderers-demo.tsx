import { useState } from "react"

import { ChartContainer3D, type Renderer3D } from "@/components/ui/chart-3d"
import { BarChart3D } from "@/components/ui/bar-chart-3d"
import { chartConfig, chartData } from "@/docs/examples/bar-chart-3d-demo"
import { RendererSwitch } from "@/docs/examples/renderer-switch"

// The same marks on every renderer: the chart hands them to the container as data.
export default function BarChart3DRenderersDemo() {
  const [renderer, setRenderer] = useState<Renderer3D>("svg")

  return (
    <div className="flex flex-col gap-2">
      <ChartContainer3D config={chartConfig} renderer={renderer} legend>
        <BarChart3D data={chartData} index="month" titles={{ y: "Visitors" }} />
      </ChartContainer3D>
      <RendererSwitch renderer={renderer} onChange={setRenderer} />
    </div>
  )
}
