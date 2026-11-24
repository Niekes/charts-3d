import { useState } from "react"

import { ChartContainer3D, type Renderer3D } from "@/components/ui/chart-3d"
import { DonutChart3D } from "@/components/ui/donut-chart-3d"
import { chartConfig, chartData } from "@/docs/examples/donut-chart-3d-demo"
import { RendererSelect } from "@/docs/examples/renderer-select"

const button =
  "inline-flex h-8 items-center justify-center rounded-md border border-input bg-background px-3 text-xs font-medium hover:bg-accent hover:text-accent-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50"

// The same numbers every time, so the only change is which browsers are there.
export default function DonutChart3DEnterDemo() {
  const [count, setCount] = useState(3)
  const [renderer, setRenderer] = useState<Renderer3D>("svg")

  return (
    <div className="flex flex-col gap-2">
      <ChartContainer3D config={chartConfig} renderer={renderer}>
        <DonutChart3D data={chartData.slice(0, count)} id="browser" value="visitors" />
      </ChartContainer3D>
      <div className="flex gap-2 self-center">
        <button
          type="button"
          disabled={count <= 1}
          onClick={() => setCount((c) => Math.max(1, c - 1))}
          className={button}
        >
          − Browser
        </button>
        <button
          type="button"
          disabled={count >= chartData.length}
          onClick={() => setCount((c) => Math.min(chartData.length, c + 1))}
          className={button}
        >
          + Browser
        </button>
      </div>
      <RendererSelect renderer={renderer} onChange={setRenderer} />
    </div>
  )
}
