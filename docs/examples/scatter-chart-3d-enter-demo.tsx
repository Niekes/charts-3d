import { useState } from "react"

import { ChartContainer3D, type ChartConfig, type Renderer3D } from "@/components/ui/chart-3d"
import { ScatterChart3D } from "@/components/ui/scatter-chart-3d"
import { RendererSelect } from "@/docs/examples/renderer-select"

// A fixed pool of named points, so the only change is which of them are there.
const pool = Array.from({ length: 24 }, (_, i) => ({
  id: `p${i}`,
  cluster: ["a", "b"][i % 2],
  x: 10 + 8 * Math.sin(i * 1.3),
  y: 12 + 6 * Math.cos(i * 0.7) + i,
  z: 20 + 7 * Math.sin(i * 2.1),
}))

const chartConfig = {
  a: { label: "Cluster A", color: "var(--chart-1)" },
  b: { label: "Cluster B", color: "var(--chart-2)" },
} satisfies ChartConfig

const button =
  "inline-flex h-8 items-center justify-center rounded-md border border-input bg-background px-3 text-xs font-medium hover:bg-accent hover:text-accent-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50"

export default function ScatterChart3DEnterDemo() {
  const [count, setCount] = useState(8)
  const [renderer, setRenderer] = useState<Renderer3D>("svg")
  const data = pool.slice(0, count)

  return (
    <div className="flex flex-col gap-2">
      <ChartContainer3D config={chartConfig} renderer={renderer} legend>
        <ScatterChart3D data={data} id="id" x="x" y="y" z="z" series="cluster" />
      </ChartContainer3D>
      <div className="flex gap-2 self-center">
        <button
          type="button"
          disabled={count <= 2}
          onClick={() => setCount((c) => Math.max(2, c - 4))}
          className={button}
        >
          − Points
        </button>
        <button
          type="button"
          disabled={count >= pool.length}
          onClick={() => setCount((c) => Math.min(pool.length, c + 4))}
          className={button}
        >
          + Points
        </button>
      </div>
      <RendererSelect renderer={renderer} onChange={setRenderer} />
    </div>
  )
}
