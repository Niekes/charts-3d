import { useState } from "react"

import { ChartContainer3D, type Renderer3D } from "@/components/ui/chart-3d"
import { AreaChart3D } from "@/components/ui/area-chart-3d"
import { chartConfig, chartData } from "@/docs/examples/area-chart-3d-demo"
import { Button, RendererSelect } from "@/docs/examples/renderer-select"

/** A random walk of share prices, one per year, that stays between 2 and 58. */
function walk() {
  let price = 5 + Math.random() * 10
  return chartData.map(() => (price = Math.min(58, Math.max(2, price - 5 + Math.random() * 12))))
}

export default function AreaChart3DUpdateDemo() {
  const [data, setData] = useState(chartData)
  const [renderer, setRenderer] = useState<Renderer3D>("svg")

  return (
    <div className="flex flex-col gap-2">
      <ChartContainer3D config={chartConfig} renderer={renderer}>
        <AreaChart3D data={data} index="year" titles={{ y: "Share price" }} />
      </ChartContainer3D>
      <Button
        onClick={() => {
          const [acme, competitor] = [walk(), walk()]
          setData(
            chartData.map(({ year }, i) => ({ year, acme: acme[i], competitor: competitor[i] }))
          )
        }}
      >
        Update
      </Button>
      <RendererSelect renderer={renderer} onChange={setRenderer} />
    </div>
  )
}
