import { useState } from "react"

import {
  ChartContainer3D,
  type ChartConfig,
  type Renderer3D,
  type Tooltip3D,
} from "@/components/ui/chart-3d"
import { BarChart3D } from "@/components/ui/bar-chart-3d"
import { RendererSelect } from "@/docs/examples/renderer-select"

const chartData = [
  { month: "January", chrome: 186, safari: 80, ios: 120, android: 95 },
  { month: "February", chrome: 305, safari: 200, ios: 160, android: 140 },
  { month: "March", chrome: 237, safari: 120, ios: 190, android: 150 },
  { month: "April", chrome: 73, safari: 190, ios: 210, android: 170 },
  { month: "May", chrome: 209, safari: 130, ios: 230, android: 160 },
  { month: "June", chrome: 214, safari: 140, ios: 250, android: 205 },
]

const chartConfig = {
  chrome: { label: "Chrome", color: "var(--chart-1)" },
  safari: { label: "Safari", color: "var(--chart-2)" },
  ios: { label: "iOS", color: "var(--chart-3)" },
  android: { label: "Android", color: "var(--chart-4)" },
} satisfies ChartConfig

// The browsers stack on the web, the apps on the phone: a row each along z.
const stack: Record<string, string> = { chrome: "Web", safari: "Web", ios: "App", android: "App" }

// A bar says its own value; the total of its stack joins it below.
function tooltip(tip: Tooltip3D, { entry, key }: { entry: Record<string, unknown>; key: string }) {
  const keys = Object.keys(stack).filter((other) => stack[other] === stack[key])
  const total = keys.reduce((sum, other) => sum + Number(entry[other]), 0)
  return { ...tip, items: [...tip.items, { label: stack[key], value: total }] }
}

export default function BarChart3DStackDemo() {
  const [renderer, setRenderer] = useState<Renderer3D>("svg")

  return (
    <div className="flex flex-col gap-2">
      <ChartContainer3D config={chartConfig} renderer={renderer} legend>
        <BarChart3D
          data={chartData}
          index="month"
          stack={stack}
          format={{ x: (month) => month.slice(0, 3) }}
          titles={{ y: "Visitors" }}
          tooltip={tooltip}
        />
      </ChartContainer3D>
      <RendererSelect renderer={renderer} onChange={setRenderer} />
    </div>
  )
}
