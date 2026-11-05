import { useState } from "react"

import { ChartContainer3D, type ChartConfig, type Renderer3D } from "@/components/ui/chart-3d"
import { AreaChart3D } from "@/components/ui/area-chart-3d"
import { RendererSelect } from "@/docs/examples/renderer-select"

// Twelve sensors over two hundred days - about 2,400 faces on the tops of
// their ribbons - on deterministic waves, so the page looks the same on every load.
const sensors = "ABCDEFGHIJKL".split("")

const chartConfig: ChartConfig = {}
for (const [j, sensor] of sensors.entries()) {
  chartConfig[sensor] = { label: `Sensor ${sensor}`, color: `var(--chart-${(j % 5) + 1})` }
}

const chartData = Array.from({ length: 200 }, (_, i) => {
  const day: Record<string, number | string> = { day: String(i) }
  for (const [j, sensor] of sensors.entries()) {
    day[sensor] = Math.round(60 + 25 * Math.sin(i / 14 + j / 2) + 12 * Math.cos(i / 5 - j) + 2 * j)
  }
  return day
})

export default function AreaChart3DManyDemo() {
  const [renderer, setRenderer] = useState<Renderer3D>("canvas")

  return (
    <div className="flex flex-col gap-2">
      <ChartContainer3D config={chartConfig} renderer={renderer}>
        <AreaChart3D data={chartData} index="day" titles={{ x: "Day" }} />
      </ChartContainer3D>
      <RendererSelect renderer={renderer} onChange={setRenderer} />
    </div>
  )
}
