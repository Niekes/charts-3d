import { useState } from "react"

import { ChartContainer3D, type Renderer3D } from "@/components/ui/chart-3d"
import { SurfaceChart3D } from "@/components/ui/surface-chart-3d"
import { chartConfig } from "@/docs/examples/surface-chart-3d-demo"
import { RendererSelect } from "@/docs/examples/renderer-select"

// A lake warming through spring, sampled on the days the boat went out, at the depths of its sensors.
const days = [0, 3, 7, 10, 14, 21, 28, 42, 56]
const depths = [0, 1, 2, 4, 6, 10, 15, 20]

/** The temperature of the water, in °C: the top warms, the deep stays near 4. */
const chartData = depths.map((depth) =>
  days.map((day) => Math.round((4 + (day / 4) * Math.exp(-depth / 5)) * 10) / 10)
)

export default function SurfaceChart3DSpacingDemo() {
  const [renderer, setRenderer] = useState<Renderer3D>("svg")

  return (
    <div className="flex flex-col gap-2">
      <ChartContainer3D
        config={chartConfig}
        renderer={renderer}
        defaultView={{ yaw: Math.PI / 5, tilt: Math.PI / 5 }}
      >
        <SurfaceChart3D
          data={chartData}
          x={days}
          z={depths}
          titles={{ x: "day", y: "temperature", z: "depth" }}
          format={{ y: (v) => `${v} °C`, z: (m) => `${m} m` }}
        />
      </ChartContainer3D>
      <RendererSelect renderer={renderer} onChange={setRenderer} />
    </div>
  )
}
