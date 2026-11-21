import { useState } from "react"

import { ChartContainer3D, type ChartConfig, type Renderer3D } from "@/components/ui/chart-3d"
import { LineChart3D } from "@/components/ui/line-chart-3d"
import { RendererSelect } from "@/docs/examples/renderer-select"

// The Lorenz attractor, three thousand steps of it: deterministic, so the page
// looks the same on every load. Its height is z, which the chart draws along y.
const at = { x: 1, y: 1, z: 20 }
const chartData = Array.from({ length: 3000 }, () => {
  const { x, y, z } = at
  at.x += 0.008 * 10 * (y - x)
  at.y += 0.008 * (x * (28 - z) - y)
  at.z += 0.008 * (x * y - (8 / 3) * z)
  return { x, y: z, z: y }
})

const chartConfig = {
  low: { label: "Lorenz", color: "var(--chart-1)" },
  high: { label: "Lorenz", color: "var(--chart-4)" },
} satisfies ChartConfig

export default function LineChart3DManyDemo() {
  const [renderer, setRenderer] = useState<Renderer3D>("canvas")

  return (
    <div className="flex flex-col gap-2">
      <ChartContainer3D config={chartConfig} renderer={renderer}>
        <LineChart3D data={chartData} x="x" y="y" z="z" colors={["low", "high"]} />
      </ChartContainer3D>
      <RendererSelect renderer={renderer} onChange={setRenderer} />
    </div>
  )
}
