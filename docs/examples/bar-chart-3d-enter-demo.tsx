import { useState } from "react"

import { ChartContainer3D, type ChartConfig, type Renderer3D } from "@/components/ui/chart-3d"
import { BarChart3D } from "@/components/ui/bar-chart-3d"
import { RendererSelect } from "@/docs/examples/renderer-select"

// A year of fixed numbers, so the only change is which months are there.
const months = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]
const desktop = [186, 305, 237, 73, 209, 214, 165, 289, 132, 247, 190, 310]
const mobile = [80, 200, 120, 190, 130, 140, 170, 95, 150, 110, 205, 160]

const chartConfig = {
  desktop: { label: "Desktop", color: "var(--chart-1)" },
  mobile: { label: "Mobile", color: "var(--chart-2)" },
} satisfies ChartConfig

const button =
  "inline-flex h-8 items-center justify-center rounded-md border border-input bg-background px-3 text-xs font-medium hover:bg-accent hover:text-accent-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50"

export default function BarChart3DEnterDemo() {
  const [count, setCount] = useState(4)
  const [renderer, setRenderer] = useState<Renderer3D>("svg")
  const data = months
    .slice(0, count)
    .map((month, i) => ({ month, desktop: desktop[i], mobile: mobile[i] }))

  return (
    <div className="flex flex-col gap-2">
      <ChartContainer3D config={chartConfig} renderer={renderer}>
        <BarChart3D data={data} index="month" titles={{ y: "Sessions" }} />
      </ChartContainer3D>
      <div className="flex gap-2 self-center">
        <button
          type="button"
          disabled={count <= 2}
          onClick={() => setCount((c) => Math.max(2, c - 1))}
          className={button}
        >
          − Month
        </button>
        <button
          type="button"
          disabled={count >= months.length}
          onClick={() => setCount((c) => Math.min(months.length, c + 1))}
          className={button}
        >
          + Month
        </button>
      </div>
      <RendererSelect renderer={renderer} onChange={setRenderer} />
    </div>
  )
}
