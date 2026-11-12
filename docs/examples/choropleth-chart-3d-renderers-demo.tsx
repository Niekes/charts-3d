import { ChoroplethChart3D } from "@/components/ui/choropleth-chart-3d"
import { chartData } from "@/docs/examples/choropleth-chart-3d-demo"
import { land } from "@/docs/examples/land"
import { compact, night } from "@/docs/examples/population"
import { regionConfig } from "@/docs/examples/regions"
import { RendererGrid } from "@/docs/examples/renderer-select"

// The same marks on every renderer, side by side: the chart hands them to the container as data.
export default function ChoroplethChart3DRenderersDemo() {
  return (
    <RendererGrid config={regionConfig} style={night}>
      <ChoroplethChart3D
        data={chartData}
        land={land}
        id="id"
        value="population"
        series="class"
        label="name"
        format={compact}
      />
    </RendererGrid>
  )
}
