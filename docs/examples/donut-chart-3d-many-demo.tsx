import { useState } from "react"

import { ChartContainer3D, type ChartConfig, type Renderer3D } from "@/components/ui/chart-3d"
import { DonutChart3D } from "@/components/ui/donut-chart-3d"
import { places } from "@/docs/examples/places"
import { RendererSelect } from "@/docs/examples/renderer-select"

// The thousand most populous places of Natural Earth, largest first: a slice
// each, as wide as its share of their people, the capitals in a color of their own.
const chartData = [...places]
  .sort((a, b) => b[2] - a[2])
  .slice(0, 1000)
  .map(([, , people, , name, capital]) => ({ name, people, kind: capital ? "capital" : "city" }))

const chartConfig = {
  capital: { label: "Capital", color: "var(--chart-1)" },
  city: { label: "City", color: "var(--chart-2)" },
} satisfies ChartConfig

export default function DonutChart3DManyDemo() {
  const [renderer, setRenderer] = useState<Renderer3D>("canvas")

  return (
    <div className="flex flex-col gap-2">
      <ChartContainer3D config={chartConfig} renderer={renderer} legend>
        <DonutChart3D data={chartData} id="name" value="people" series="kind" />
      </ChartContainer3D>
      <RendererSelect renderer={renderer} onChange={setRenderer} />
    </div>
  )
}
