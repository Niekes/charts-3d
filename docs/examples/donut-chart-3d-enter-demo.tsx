import { useState } from "react"

import { ChartContainer3D, type ChartConfig, type Renderer3D } from "@/components/ui/chart-3d"
import { DonutChart3D } from "@/components/ui/donut-chart-3d"
import { RendererSelect } from "@/docs/examples/renderer-select"

// Fixed numbers, so the only change is which browsers are there.
const browsers = [
  { browser: "chrome", visitors: 275 },
  { browser: "safari", visitors: 200 },
  { browser: "firefox", visitors: 187 },
  { browser: "edge", visitors: 173 },
  { browser: "opera", visitors: 120 },
  { browser: "brave", visitors: 98 },
  { browser: "other", visitors: 90 },
]

const chartConfig = {
  chrome: { label: "Chrome", color: "var(--chart-1)" },
  safari: { label: "Safari", color: "var(--chart-2)" },
  firefox: { label: "Firefox", color: "var(--chart-3)" },
  edge: { label: "Edge", color: "var(--chart-4)" },
  opera: { label: "Opera", color: "var(--chart-5)" },
  brave: { label: "Brave", color: "var(--chart-1)" },
  other: { label: "Other", color: "var(--chart-2)" },
} satisfies ChartConfig

const button =
  "inline-flex h-8 items-center justify-center rounded-md border border-input bg-background px-3 text-xs font-medium hover:bg-accent hover:text-accent-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50"

export default function DonutChart3DEnterDemo() {
  const [count, setCount] = useState(4)
  const [renderer, setRenderer] = useState<Renderer3D>("svg")

  return (
    <div className="flex flex-col gap-2">
      <ChartContainer3D config={chartConfig} renderer={renderer}>
        <DonutChart3D data={browsers.slice(0, count)} id="browser" value="visitors" />
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
          disabled={count >= browsers.length}
          onClick={() => setCount((c) => Math.min(browsers.length, c + 1))}
          className={button}
        >
          + Browser
        </button>
      </div>
      <RendererSelect renderer={renderer} onChange={setRenderer} />
    </div>
  )
}
