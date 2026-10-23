import { ChartContainer3D, type ChartConfig } from "@/components/ui/chart-3d"
import { SurfaceChart3D } from "@/components/ui/surface-chart-3d"

// A ripple: the cosine of the distance from the middle of the grid.
const chartData = Array.from({ length: 24 }, (_, row) =>
  Array.from({ length: 24 }, (_, column) => Math.cos(Math.hypot(column - 11.5, row - 11.5) / 2.2))
)

const chartConfig = {
  low: { label: "Low", color: "var(--chart-3)" },
  high: { label: "High", color: "var(--chart-5)" },
} satisfies ChartConfig

export default function SurfaceChart3DDemo() {
  return (
    <ChartContainer3D config={chartConfig} defaultView={{ yaw: Math.PI / 5, tilt: Math.PI / 5 }}>
      <SurfaceChart3D data={chartData} domain={{ x: [-5, 5], z: [-5, 5] }} />
    </ChartContainer3D>
  )
}
