import { useState } from "react"

import { ChartContainer3D, type Renderer3D } from "@/components/ui/chart-3d"
import { AreaChart3D } from "@/components/ui/area-chart-3d"
import { chartConfig, chartData } from "@/docs/examples/area-chart-3d-demo"
import { RendererSelect } from "@/docs/examples/renderer-select"

const button =
  "inline-flex h-8 items-center justify-center rounded-md border border-input bg-background px-3 text-xs font-medium hover:bg-accent hover:text-accent-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50"

// The same twenty years of fixed prices, so the only change is how many of them are there.
export default function AreaChart3DEnterDemo() {
  const [count, setCount] = useState(8)
  const [renderer, setRenderer] = useState<Renderer3D>("svg")

  return (
    <div className="flex flex-col gap-2">
      <ChartContainer3D config={chartConfig} renderer={renderer}>
        <AreaChart3D data={chartData.slice(0, count)} index="year" titles={{ y: "Share price" }} />
      </ChartContainer3D>
      <div className="flex gap-2 self-center">
        {[-1, 1].map((step) => (
          <button
            key={step}
            type="button"
            // At least two years, so there is a line; at most all twenty.
            disabled={count + step < 2 || count + step > chartData.length}
            onClick={() => setCount((c) => Math.min(chartData.length, Math.max(2, c + step)))}
            className={button}
          >
            {step < 0 ? "− Year" : "+ Year"}
          </button>
        ))}
      </div>
      <RendererSelect renderer={renderer} onChange={setRenderer} />
    </div>
  )
}
