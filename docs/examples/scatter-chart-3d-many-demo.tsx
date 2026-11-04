import { useState } from "react"

import { ChartContainer3D, type ChartConfig, type Renderer3D } from "@/components/ui/chart-3d"
import { ScatterChart3D } from "@/components/ui/scatter-chart-3d"
import { RendererSelect } from "@/docs/examples/renderer-select"

// Five thousand points on a swirl, deterministic: the golden angle spreads
// them evenly without a random, so the page looks the same on every load.
const chartData = Array.from({ length: 5000 }, (_, i) => {
  const angle = i * 2.399963
  const radius = 40 * Math.sqrt(i / 5000)
  return {
    cluster: ["a", "b", "c"][i % 3],
    x: Math.round(50 + radius * Math.cos(angle)),
    y: Math.round(50 + 20 * Math.sin(angle * 2) + radius / 4),
    z: Math.round(50 + radius * Math.sin(angle)),
  }
})

const chartConfig = {
  a: { label: "Cluster A", color: "var(--chart-1)" },
  b: { label: "Cluster B", color: "var(--chart-2)" },
  c: { label: "Cluster C", color: "var(--chart-4)" },
} satisfies ChartConfig

export default function ScatterChart3DManyDemo() {
  const [renderer, setRenderer] = useState<Renderer3D>("canvas")

  return (
    <div className="flex flex-col gap-2">
      <ChartContainer3D config={chartConfig} renderer={renderer}>
        <ScatterChart3D data={chartData} x="x" y="y" z="z" series="cluster" radius={2} />
      </ChartContainer3D>
      <RendererSelect renderer={renderer} onChange={setRenderer} />
    </div>
  )
}
