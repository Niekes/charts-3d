import { useState } from "react"

import { ChartContainer3D, type ChartConfig, type Renderer3D } from "@/components/ui/chart-3d"
import { SurfaceChart3D } from "@/components/ui/surface-chart-3d"
import { RendererSelect } from "@/docs/examples/renderer-select"

// An 80 by 80 grid - over six thousand cells - of two crossing ripples.
const chartData = Array.from({ length: 80 }, (_, row) =>
  Array.from(
    { length: 80 },
    (_, column) =>
      Math.cos(Math.hypot(column - 39.5, row - 39.5) / 4) +
      0.4 * Math.sin(column / 6) * Math.cos(row / 6)
  )
)

const chartConfig = {
  low: { label: "Low", color: "var(--chart-3)" },
  high: { label: "High", color: "var(--chart-5)" },
} satisfies ChartConfig

export default function SurfaceChart3DManyDemo() {
  const [renderer, setRenderer] = useState<Renderer3D>("canvas")

  return (
    <div className="flex flex-col gap-2">
      <ChartContainer3D
        config={chartConfig}
        renderer={renderer}
        defaultView={{ yaw: Math.PI / 5, tilt: Math.PI / 5 }}
      >
        <SurfaceChart3D data={chartData} domain={{ x: [-10, 10], z: [-10, 10] }} />
      </ChartContainer3D>
      <RendererSelect renderer={renderer} onChange={setRenderer} />
    </div>
  )
}
