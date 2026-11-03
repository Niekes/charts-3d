import { useState } from "react"

import { ChartContainer3D, type Renderer3D } from "@/components/ui/chart-3d"
import { SurfaceChart3D } from "@/components/ui/surface-chart-3d"
import { chartConfig, chartData } from "@/docs/examples/surface-chart-3d-demo"
import { RendererSwitch } from "@/docs/examples/renderer-switch"

// The same marks on every renderer: the chart hands them to the container as data.
export default function SurfaceChart3DRenderersDemo() {
  const [renderer, setRenderer] = useState<Renderer3D>("webgl")

  return (
    <div className="flex flex-col gap-2">
      <ChartContainer3D
        config={chartConfig}
        renderer={renderer}
        defaultView={{ yaw: Math.PI / 5, tilt: Math.PI / 5 }}
      >
        <SurfaceChart3D data={chartData} domain={{ x: [-5, 5], z: [-5, 5] }} />
      </ChartContainer3D>
      <RendererSwitch renderer={renderer} onChange={setRenderer} />
    </div>
  )
}
