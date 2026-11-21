import { useState } from "react"

import { ChartContainer3D, type Renderer3D } from "@/components/ui/chart-3d"
import { BarFieldChart3D } from "@/components/ui/bar-field-chart-3d"
import {
  HILLS,
  chartConfig,
  chartData,
  format,
  landscape,
} from "@/docs/examples/bar-field-chart-3d-demo"
import { Button, RendererSelect } from "@/docs/examples/renderer-select"

// The same hills, moved across the field and grown or sunk.
const moved = () =>
  landscape(
    21,
    21,
    0.1,
    HILLS.map((hill) => ({
      ...hill,
      x: Math.random() * 1.6 - 0.8,
      z: Math.random() * 1.6 - 0.8,
      h: 150 + Math.random() * 600,
    }))
  )

export default function BarFieldChart3DUpdateDemo() {
  const [data, setData] = useState(chartData)
  const [renderer, setRenderer] = useState<Renderer3D>("svg")

  return (
    <div className="flex flex-col gap-2">
      <ChartContainer3D
        config={chartConfig}
        renderer={renderer}
        defaultView={{ yaw: Math.PI / 5, tilt: Math.PI / 5 }}
      >
        <BarFieldChart3D data={data} domain={{ x: [-1, 1], z: [-1, 1] }} format={format} />
      </ChartContainer3D>
      <Button onClick={() => setData(moved())}>Update</Button>
      <RendererSelect renderer={renderer} onChange={setRenderer} />
    </div>
  )
}
