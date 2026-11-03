import { useState } from "react"

import { ChartContainer3D, type Renderer3D } from "@/components/ui/chart-3d"
import { inspectOnlyKeymap } from "@/docs/examples/inspect-only-keymap"
import { ScatterChart3D } from "@/components/ui/scatter-chart-3d"
import { chartConfig, chartData } from "@/docs/examples/scatter-chart-3d-demo"
import { RendererSwitch } from "@/docs/examples/renderer-switch"

// The same marks on every renderer: the chart hands them to the container as data.
export default function ScatterChart3DRenderersDemo() {
  const [renderer, setRenderer] = useState<Renderer3D>("canvas")

  return (
    <div className="flex flex-col gap-2">
      <ChartContainer3D keymap={inspectOnlyKeymap} config={chartConfig} renderer={renderer} legend>
        <ScatterChart3D data={chartData} x="x" y="y" z="z" series="cluster" />
      </ChartContainer3D>
      <RendererSwitch renderer={renderer} onChange={setRenderer} />
    </div>
  )
}
