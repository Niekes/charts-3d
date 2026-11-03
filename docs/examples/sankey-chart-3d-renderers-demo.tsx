import { useState } from "react"

import { ChartContainer3D, type Renderer3D } from "@/components/ui/chart-3d"
import { inspectOnlyKeymap } from "@/docs/examples/inspect-only-keymap"
import { SankeyChart3D } from "@/components/ui/sankey-chart-3d"
import { chartConfig, chartData } from "@/docs/examples/sankey-chart-3d-demo"
import { RendererSwitch } from "@/docs/examples/renderer-switch"

// The same marks on every renderer: the chart hands them to the container as data.
export default function SankeyChart3DRenderersDemo() {
  const [renderer, setRenderer] = useState<Renderer3D>("svg")

  return (
    <div className="flex flex-col gap-2">
      <ChartContainer3D
        keymap={inspectOnlyKeymap}
        config={chartConfig}
        renderer={renderer}
        defaultView={{ yaw: -Math.PI / 6, tilt: Math.PI / 6 }}
      >
        <SankeyChart3D data={chartData} />
      </ChartContainer3D>
      <RendererSwitch renderer={renderer} onChange={setRenderer} />
    </div>
  )
}
