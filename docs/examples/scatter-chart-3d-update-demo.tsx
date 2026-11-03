import { useState } from "react"

import { ChartContainer3D, type ChartConfig } from "@/components/ui/chart-3d"
import { ScatterChart3D } from "@/components/ui/scatter-chart-3d"

// Three clusters around deterministic centers, so the page looks the same on every load.
const cluster = (id: string, at: number[]) =>
  Array.from({ length: 40 }, (_, i) => ({
    cluster: id,
    x: at[0] + 8 * Math.sin(i * 1.3),
    y: at[1] + 6 * Math.cos(i * 0.7),
    z: at[2] + 7 * Math.sin(i * 2.1),
  }))
const chartData = ["a", "b", "c"].flatMap((id, k) =>
  cluster(id, [4 + 20 * k, 16 + 15 * k, 34 - 12 * k])
)

const chartConfig = {
  a: { label: "Cluster A", color: "var(--chart-1)" },
  b: { label: "Cluster B", color: "var(--chart-2)" },
  c: { label: "Cluster C", color: "var(--chart-4)" },
} satisfies ChartConfig

export default function ScatterChart3DUpdateDemo() {
  const [data, setData] = useState(chartData)

  return (
    <div className="flex flex-col gap-2">
      <ChartContainer3D config={chartConfig} renderer="canvas" legend>
        <ScatterChart3D data={data} x="x" y="y" z="z" series="cluster" />
      </ChartContainer3D>
      <button
        type="button"
        onClick={() =>
          setData(
            ["a", "b", "c"].flatMap((id, k) =>
              cluster(id, [
                4 + 20 * k + Math.random() * 10,
                16 + 15 * k + Math.random() * 8,
                34 - 12 * k + Math.random() * 6,
              ])
            )
          )
        }
        className="inline-flex h-8 items-center justify-center self-center rounded-md border border-input bg-background px-3 text-xs font-medium hover:bg-accent hover:text-accent-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        Update
      </button>
    </div>
  )
}
