import { useState } from "react"

import { ChartContainer3D, type ChartConfig } from "@/components/ui/chart-3d"
import { SankeyChart3D } from "@/components/ui/sankey-chart-3d"

// The traffic of a docs site: where the visitors came from, the page they
// landed on and what they did there.
const flow = (source: string, target: string, value: number) => ({ source, target, value })
const chartData = [
  flow("organic", "landing", 900),
  flow("organic", "docs", 400),
  flow("ads", "landing", 600),
  flow("ads", "pricing", 250),
  flow("landing", "signup", 500),
  flow("docs", "signup", 300),
  flow("docs", "bounce", 100),
  flow("pricing", "signup", 150),
]

// The same flows, every value somewhere between half again and half as much.
const randomFlows = () =>
  chartData.map((f) => flow(f.source, f.target, Math.round(f.value * (0.6 + Math.random() * 0.8))))

const chartConfig = {
  organic: { label: "Organic", color: "var(--chart-1)" },
  ads: { label: "Ads", color: "var(--chart-2)" },
  landing: { label: "Landing", color: "var(--chart-3)" },
  docs: { label: "Docs", color: "var(--chart-4)" },
  pricing: { label: "Pricing", color: "var(--chart-5)" },
  signup: { label: "Sign-up", color: "var(--chart-2)" },
  bounce: { label: "Bounce", color: "var(--muted-foreground)" },
} satisfies ChartConfig

export default function SankeyChart3DUpdateDemo() {
  const [data, setData] = useState(chartData)

  return (
    <div className="flex flex-col gap-2">
      <ChartContainer3D config={chartConfig} defaultView={{ yaw: -Math.PI / 6, tilt: Math.PI / 6 }}>
        <SankeyChart3D data={data} />
      </ChartContainer3D>
      <button
        type="button"
        onClick={() => setData(randomFlows())}
        className="inline-flex h-8 items-center justify-center self-center rounded-md border border-input bg-background px-3 text-xs font-medium hover:bg-accent hover:text-accent-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        Update
      </button>
    </div>
  )
}
