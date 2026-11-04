import { useState } from "react"

import { ChartContainer3D, type ChartConfig, type Renderer3D } from "@/components/ui/chart-3d"
import { BarChart3D } from "@/components/ui/bar-chart-3d"
import { RendererSelect } from "@/docs/examples/renderer-select"

// Twenty rows of fifteen series - three hundred bars - on a deterministic
// swell, so the page looks the same on every load.
const series = Array.from({ length: 15 }, (_, j) => `s${j + 1}`)

const chartConfig = Object.fromEntries(
  series.map((key, j) => [key, { label: `Series ${j + 1}`, color: `var(--chart-${(j % 5) + 1})` }])
) satisfies ChartConfig

const chartData = Array.from({ length: 20 }, (_, i) => ({
  row: `Row ${i + 1}`,
  ...Object.fromEntries(
    series.map((key, j) => [key, Math.round(80 + 60 * Math.sin(i / 3) * Math.cos(j / 2) + i + j)])
  ),
}))

export default function BarChart3DManyDemo() {
  const [renderer, setRenderer] = useState<Renderer3D>("canvas")

  return (
    <div className="flex flex-col gap-2">
      <ChartContainer3D config={chartConfig} renderer={renderer}>
        <BarChart3D data={chartData} index="row" format={{ x: (row) => row.slice(4) }} />
      </ChartContainer3D>
      <RendererSelect renderer={renderer} onChange={setRenderer} />
    </div>
  )
}
