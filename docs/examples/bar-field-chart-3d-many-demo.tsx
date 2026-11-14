import { useState } from "react"

import { ChartContainer3D, type Renderer3D } from "@/components/ui/chart-3d"
import { BarFieldChart3D } from "@/components/ui/bar-field-chart-3d"
import { chartConfig, landscape } from "@/docs/examples/bar-field-chart-3d-demo"
import { RendererSelect } from "@/docs/examples/renderer-select"

// A 40 by 40 field - sixteen hundred bars - of the same land at twice the
// detail, its rows and columns numbered.
const chartData = landscape(40, 40, 2 / 39)

export default function BarFieldChart3DManyDemo() {
  const [renderer, setRenderer] = useState<Renderer3D>("canvas")

  return (
    <div className="flex flex-col gap-2">
      <ChartContainer3D config={chartConfig} renderer={renderer}>
        <BarFieldChart3D data={chartData} titles={{ x: "column", z: "row" }} />
      </ChartContainer3D>
      <RendererSelect renderer={renderer} onChange={setRenderer} />
    </div>
  )
}
