import { useState } from "react"

import { ChartContainer3D, type ChartConfig, type Renderer3D } from "@/components/ui/chart-3d"
import { BarFieldChart3D } from "@/components/ui/bar-field-chart-3d"
import { RendererSelect } from "@/docs/examples/renderer-select"

/** Three hills on a gentle swell. */
export const HILLS = [
  { x: -0.35, z: -0.3, r: 0.4, h: 550 },
  { x: 0.45, z: 0.35, r: 0.3, h: 400 },
  { x: 0.4, z: -0.55, r: 0.2, h: 300 },
]

/**
 * The height of the land, in meters, of a grid of `rows` by `columns` from
 * the corner at -1, -1, its bars `step` apart: the bar at row r and column c
 * stands at the same place whatever the size, so a grown grid continues the land.
 */
export function landscape(rows: number, columns = rows, step = 0.1, hills = HILLS) {
  return Array.from({ length: rows }, (_, r) =>
    Array.from({ length: columns }, (_, c) => {
      const [x, z] = [-1 + step * c, -1 + step * r]
      const swell = 25 * (1 + Math.sin(7 * x) * Math.cos(6 * z))
      const peaks = hills.map(
        (hill) => hill.h * Math.exp(-((x - hill.x) ** 2 + (z - hill.z) ** 2) / hill.r ** 2)
      )
      return Math.round(30 + swell + peaks.reduce((a, b) => a + b, 0))
    })
  )
}

export const chartData = landscape(21)

export const chartConfig = {
  low: { label: "Low", color: "var(--chart-3)" },
  high: { label: "High", color: "var(--chart-1)" },
} satisfies ChartConfig

export const format = { y: (meters: number) => `${meters} m` }

export default function BarFieldChart3DDemo() {
  const [renderer, setRenderer] = useState<Renderer3D>("svg")

  return (
    <div className="flex flex-col gap-2">
      <ChartContainer3D
        config={chartConfig}
        renderer={renderer}
        defaultView={{ yaw: Math.PI / 5, tilt: Math.PI / 5 }}
      >
        <BarFieldChart3D data={chartData} domain={{ x: [-1, 1], z: [-1, 1] }} format={format} />
      </ChartContainer3D>
      <RendererSelect renderer={renderer} onChange={setRenderer} />
    </div>
  )
}
