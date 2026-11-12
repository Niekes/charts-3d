import { useState } from "react"

import { ChartContainer3D, type Renderer3D } from "@/components/ui/chart-3d"
import { ChoroplethChart3D } from "@/components/ui/choropleth-chart-3d"
import { chartData } from "@/docs/examples/choropleth-chart-3d-demo"
import { land } from "@/docs/examples/land"
import { compact, night } from "@/docs/examples/population"
import { regionConfig } from "@/docs/examples/regions"
import { RendererSelect } from "@/docs/examples/renderer-select"

// Every country colored, on canvas. The size of a choropleth is its land's,
// not its data's: the 177 regions of world-atlas at 110m are 10,600 points,
// cut at the horizon on every turn of the camera. At 50m they are 100,000,
// and the cut alone took 100 ms a frame, so the demo stays at 110m.
export default function ChoroplethChart3DManyDemo() {
  const [renderer, setRenderer] = useState<Renderer3D>("canvas")

  return (
    <div className="flex flex-col gap-2">
      <ChartContainer3D config={regionConfig} renderer={renderer} style={night}>
        <ChoroplethChart3D
          data={chartData}
          land={land}
          id="id"
          value="population"
          series="class"
          label="name"
          format={compact}
        />
      </ChartContainer3D>
      <RendererSelect renderer={renderer} onChange={setRenderer} />
    </div>
  )
}
