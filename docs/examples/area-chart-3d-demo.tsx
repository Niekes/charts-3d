import { useState } from "react"

import { ChartContainer3D, type ChartConfig, type Renderer3D } from "@/components/ui/chart-3d"
import { AreaChart3D } from "@/components/ui/area-chart-3d"
import { RendererSelect } from "@/docs/examples/renderer-select"

// The share prices of two fictional companies over twenty years.
const acme = [12, 15, 19, 14, 18, 24, 29, 26, 31, 37, 35, 41, 46, 40, 34, 43, 49, 45, 52, 56]
const competitor = [8, 10, 9, 13, 16, 14, 18, 22, 20, 17, 23, 27, 25, 30, 33, 29, 35, 38, 36, 41]

export const chartData = acme.map((price, i) => ({
  year: String(2006 + i),
  acme: price,
  competitor: competitor[i],
}))

export const chartConfig = {
  acme: { label: "ACME Corp.", color: "var(--chart-1)" },
  competitor: { label: "Competitor", color: "var(--chart-2)" },
} satisfies ChartConfig

export default function AreaChart3DDemo() {
  const [renderer, setRenderer] = useState<Renderer3D>("svg")

  return (
    <div className="flex flex-col gap-2">
      <ChartContainer3D config={chartConfig} renderer={renderer} legend>
        <AreaChart3D
          data={chartData}
          index="year"
          format={{ y: (price) => `$${price}` }}
          titles={{ y: "Share price" }}
        />
      </ChartContainer3D>
      <RendererSelect renderer={renderer} onChange={setRenderer} />
    </div>
  )
}
