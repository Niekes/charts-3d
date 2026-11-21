import { useState } from "react"

import { ChartContainer3D, type ChartConfig, type Renderer3D } from "@/components/ui/chart-3d"
import { BarChart3D } from "@/components/ui/bar-chart-3d"
import { Button, RendererSelect } from "@/docs/examples/renderer-select"

// The same months every time, so the bars glide in place when the data updates.
const months = ["January", "February", "March", "April", "May", "June"]
const desktop = [186, 305, 237, 73, 209, 214]
const mobile = [80, 200, 120, 190, 130, 140]
const chartData = months.map((month, i) => ({ month, desktop: desktop[i], mobile: mobile[i] }))

const chartConfig = {
  desktop: { label: "Desktop", color: "var(--chart-1)" },
  mobile: { label: "Mobile", color: "var(--chart-2)" },
} satisfies ChartConfig

export default function BarChart3DUpdateDemo() {
  const [data, setData] = useState(chartData)
  const [renderer, setRenderer] = useState<Renderer3D>("svg")

  return (
    <div className="flex flex-col gap-2">
      <ChartContainer3D config={chartConfig} renderer={renderer}>
        <BarChart3D data={data} index="month" titles={{ y: "Sessions" }} />
      </ChartContainer3D>
      <Button
        onClick={() =>
          setData(
            months.map((month) => ({
              month,
              desktop: 100 + Math.round(Math.random() * 300),
              mobile: 80 + Math.round(Math.random() * 160),
            }))
          )
        }
      >
        Update
      </Button>
      <RendererSelect renderer={renderer} onChange={setRenderer} />
    </div>
  )
}
