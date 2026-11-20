import { useState } from "react"

import { ChartContainer3D, type ChartConfig, type Renderer3D } from "@/components/ui/chart-3d"
import { LineChart3D } from "@/components/ui/line-chart-3d"
import { RendererSelect } from "@/docs/examples/renderer-select"

// Two strands winding around each other, half a turn apart, as they rise.
export const chartData = ["a", "b"].flatMap((strand, k) =>
  Array.from({ length: 60 }, (_, i) => {
    const turn = i * 0.25 + k * Math.PI
    return { strand, x: 10 * Math.cos(turn), y: i / 2, z: 10 * Math.sin(turn) }
  })
)

export const chartConfig = {
  a: { label: "Strand A", color: "var(--chart-1)" },
  b: { label: "Strand B", color: "var(--chart-2)" },
} satisfies ChartConfig

export default function LineChart3DDemo() {
  const [renderer, setRenderer] = useState<Renderer3D>("svg")

  return (
    <div className="flex flex-col gap-2">
      <ChartContainer3D config={chartConfig} renderer={renderer} legend>
        <LineChart3D data={chartData} x="x" y="y" z="z" series="strand" />
      </ChartContainer3D>
      <RendererSelect renderer={renderer} onChange={setRenderer} />
    </div>
  )
}
