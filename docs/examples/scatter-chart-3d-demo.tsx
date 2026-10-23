import { ChartContainer3D, type ChartConfig } from "@/components/ui/chart-3d"
import { ScatterChart3D } from "@/components/ui/scatter-chart-3d"

// Three clusters, deterministic so the page looks the same on every load.
const chartData = ["a", "b", "c"].flatMap((cluster, k) =>
  Array.from({ length: 40 }, (_, i) => ({
    cluster,
    x: 20 * k + 8 * Math.sin(i * 1.3 + k),
    y: 10 + 15 * k + 6 * Math.cos(i * 0.7),
    z: 30 - 10 * k + 7 * Math.sin(i * 2.1),
  }))
)

const chartConfig = {
  a: { label: "Cluster A", color: "var(--chart-1)" },
  b: { label: "Cluster B", color: "var(--chart-2)" },
  c: { label: "Cluster C", color: "var(--chart-4)" },
} satisfies ChartConfig

export default function ScatterChart3DDemo() {
  return (
    <ChartContainer3D config={chartConfig} renderer="canvas" legend>
      <ScatterChart3D data={chartData} x="x" y="y" z="z" series="cluster" />
    </ChartContainer3D>
  )
}
