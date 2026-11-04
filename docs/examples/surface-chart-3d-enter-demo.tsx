import { useState } from "react"

import { ChartContainer3D, type ChartConfig, type Renderer3D } from "@/components/ui/chart-3d"
import { SurfaceChart3D } from "@/components/ui/surface-chart-3d"
import { RendererSelect } from "@/docs/examples/renderer-select"

// The same wave at every size, so a grown grid continues the surface.
const wave = (n: number) =>
  Array.from({ length: n }, (_, r) =>
    Array.from({ length: n }, (_, c) => Math.sin(r * 0.6) * Math.cos(c * 0.6))
  )

const chartConfig = {
  low: { label: "Low", color: "var(--chart-2)" },
  high: { label: "High", color: "var(--chart-1)" },
} satisfies ChartConfig

const button =
  "inline-flex h-8 items-center justify-center rounded-md border border-input bg-background px-3 text-xs font-medium hover:bg-accent hover:text-accent-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50"

export default function SurfaceChart3DEnterDemo() {
  const [size, setSize] = useState(8)
  const [renderer, setRenderer] = useState<Renderer3D>("svg")

  return (
    <div className="flex flex-col gap-2">
      <ChartContainer3D config={chartConfig} renderer={renderer}>
        <SurfaceChart3D data={wave(size)} />
      </ChartContainer3D>
      <div className="flex gap-2 self-center">
        <button
          type="button"
          disabled={size <= 4}
          onClick={() => setSize((n) => Math.max(4, n - 2))}
          className={button}
        >
          − Grid
        </button>
        <button
          type="button"
          disabled={size >= 14}
          onClick={() => setSize((n) => Math.min(14, n + 2))}
          className={button}
        >
          + Grid
        </button>
      </div>
      <RendererSelect renderer={renderer} onChange={setRenderer} />
    </div>
  )
}
