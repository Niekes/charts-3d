import { useState } from "react"

import { ChartContainer3D, type Renderer3D } from "@/components/ui/chart-3d"
import { BarFieldChart3D } from "@/components/ui/bar-field-chart-3d"
import { chartConfig, format, landscape } from "@/docs/examples/bar-field-chart-3d-demo"
import { RendererSelect } from "@/docs/examples/renderer-select"

const button =
  "inline-flex h-8 items-center justify-center rounded-md border border-input bg-background px-3 text-xs font-medium hover:bg-accent hover:text-accent-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50"

const [MIN, MAX] = [4, 16]

// The land is the same at every size: a bar keeps its value, only which bars are there changes.
export default function BarFieldChart3DEnterDemo() {
  const [size, setSize] = useState({ rows: 8, columns: 8 })
  const [renderer, setRenderer] = useState<Renderer3D>("svg")
  const steps = (["rows", "columns"] as const).flatMap((side) =>
    [-2, 2].map((by) => ({ side, by, n: size[side] + by }))
  )

  return (
    <div className="flex flex-col gap-2">
      <ChartContainer3D
        config={chartConfig}
        renderer={renderer}
        defaultView={{ yaw: Math.PI / 5, tilt: Math.PI / 5 }}
      >
        <BarFieldChart3D data={landscape(size.rows, size.columns)} format={format} />
      </ChartContainer3D>
      <div className="flex gap-2 self-center">
        {steps.map(({ side, by, n }) => (
          <button
            key={`${side}${by}`}
            type="button"
            disabled={n < MIN || n > MAX}
            onClick={() => setSize({ ...size, [side]: n })}
            className={button}
          >
            {by < 0 ? "−" : "+"} {side === "rows" ? "Rows" : "Columns"}
          </button>
        ))}
      </div>
      <RendererSelect renderer={renderer} onChange={setRenderer} />
    </div>
  )
}
