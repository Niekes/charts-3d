import { useState } from "react"

import { ChartContainer3D, type ChartConfig, type Renderer3D } from "@/components/ui/chart-3d"
import { LineChart3D } from "@/components/ui/line-chart-3d"
import { RendererSelect } from "@/docs/examples/renderer-select"

// A fixed spiral of named points, so the only change is which of them are there.
const pool = Array.from({ length: 48 }, (_, i) => ({
  id: `p${i}`,
  x: (4 + i / 4) * Math.cos(i * 0.4),
  y: i / 2,
  z: (4 + i / 4) * Math.sin(i * 0.4),
}))

const chartConfig = { path: { label: "Path", color: "var(--chart-1)" } } satisfies ChartConfig

export default function LineChart3DEnterDemo() {
  // The line is the points from `start` up to `end`.
  const [[start, end], setSpan] = useState<number[]>([0, 12])
  const [renderer, setRenderer] = useState<Renderer3D>("svg")
  const steps = [
    { label: "− Start", to: [start + 4, end], on: end - start > 4 },
    { label: "+ End", to: [start, end + 4], on: end < pool.length },
  ]

  return (
    <div className="flex flex-col gap-2">
      <ChartContainer3D config={chartConfig} renderer={renderer}>
        <LineChart3D data={pool.slice(start, end)} id="id" x="x" y="y" z="z" />
      </ChartContainer3D>
      <div className="flex gap-2 self-center">
        {steps.map(({ label, to, on }) => (
          <button
            key={label}
            type="button"
            disabled={!on}
            onClick={() => setSpan(to)}
            className="inline-flex h-8 items-center justify-center rounded-md border border-input bg-background px-3 text-xs font-medium hover:bg-accent hover:text-accent-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50"
          >
            {label}
          </button>
        ))}
      </div>
      <RendererSelect renderer={renderer} onChange={setRenderer} />
    </div>
  )
}
