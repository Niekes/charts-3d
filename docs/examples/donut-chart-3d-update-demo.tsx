import { useState } from "react"

import { ChartContainer3D, type Renderer3D } from "@/components/ui/chart-3d"
import { DonutChart3D } from "@/components/ui/donut-chart-3d"
import { chartConfig, chartData } from "@/docs/examples/donut-chart-3d-demo"
import { Button, RendererSelect } from "@/docs/examples/renderer-select"

export default function DonutChart3DUpdateDemo() {
  const [data, setData] = useState(chartData)
  const [renderer, setRenderer] = useState<Renderer3D>("svg")

  return (
    <div className="flex flex-col gap-2">
      <ChartContainer3D config={chartConfig} renderer={renderer}>
        <DonutChart3D data={data} id="browser" value="visitors" />
      </ChartContainer3D>
      <Button
        onClick={() =>
          // The same browsers every time, so the slices glide in place.
          setData(
            chartData.map(({ browser }) => ({
              browser,
              visitors: 60 + Math.round(Math.random() * 240),
            }))
          )
        }
      >
        Update
      </Button>
      <RendererSelect renderer={renderer} onChange={setRenderer} />
    </div>
  )
}
