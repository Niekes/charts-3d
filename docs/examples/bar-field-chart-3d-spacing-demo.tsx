import { useState } from "react"

import { ChartContainer3D, type Renderer3D } from "@/components/ui/chart-3d"
import { BarFieldChart3D } from "@/components/ui/bar-field-chart-3d"
import { chartConfig } from "@/docs/examples/bar-field-chart-3d-demo"
import { RendererSelect } from "@/docs/examples/renderer-select"

// Wells downstream of a field, sampled at the distances and depths they were drilled to.
const distances = [0, 1, 2, 4, 7, 10]
const depths = [5, 10, 20, 40]

/** The nitrate in the water, in mg/l: it thins out with distance and depth. */
const chartData = depths.map((depth) =>
  distances.map((km) => Math.round(5 + 60 * Math.exp(-km / 4 - depth / 20)))
)

export default function BarFieldChart3DSpacingDemo() {
  const [renderer, setRenderer] = useState<Renderer3D>("svg")

  return (
    <div className="flex flex-col gap-2">
      <ChartContainer3D
        config={chartConfig}
        renderer={renderer}
        defaultView={{ yaw: Math.PI / 5, tilt: Math.PI / 5 }}
      >
        <BarFieldChart3D
          data={chartData}
          x={distances}
          z={depths}
          titles={{ x: "distance", y: "nitrate", z: "depth" }}
          format={{ x: (km) => `${km} km`, y: (v) => `${v} mg/l`, z: (m) => `${m} m` }}
        />
      </ChartContainer3D>
      <RendererSelect renderer={renderer} onChange={setRenderer} />
    </div>
  )
}
