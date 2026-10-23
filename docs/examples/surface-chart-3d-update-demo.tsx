import { useState } from "react"

import { ChartContainer3D, type ChartConfig } from "@/components/ui/chart-3d"
import { SurfaceChart3D } from "@/components/ui/surface-chart-3d"

// Interfering waves along both axes, deterministic so the page looks the same on every load.
const chartData = Array.from({ length: 24 }, (_, row) =>
  Array.from({ length: 24 }, (_, column) => Math.sin(column / 3.5) * Math.cos(row / 3.5))
)

// A wave from a random center, at a random frequency.
const randomWave = () => {
  const [x, y] = [Math.random() * 24, Math.random() * 24]
  const f = 1.4 + Math.random() * 2.4
  return Array.from({ length: 24 }, (_, row) =>
    Array.from({ length: 24 }, (_, column) => Math.cos(Math.hypot(column - x, row - y) / f))
  )
}

const chartConfig = {
  low: { label: "Low", color: "var(--chart-3)" },
  high: { label: "High", color: "var(--chart-5)" },
} satisfies ChartConfig

export default function SurfaceChart3DUpdateDemo() {
  const [data, setData] = useState(chartData)

  return (
    <div className="flex flex-col gap-2">
      <ChartContainer3D config={chartConfig} defaultView={{ yaw: Math.PI / 5, tilt: Math.PI / 5 }}>
        <SurfaceChart3D data={data} domain={{ x: [-5, 5], z: [-5, 5] }} />
      </ChartContainer3D>
      <button
        type="button"
        onClick={() => setData(randomWave())}
        className="inline-flex h-8 items-center justify-center self-center rounded-md border border-input bg-background px-3 text-xs font-medium hover:bg-accent hover:text-accent-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        Update
      </button>
    </div>
  )
}
