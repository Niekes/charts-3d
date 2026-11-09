import { GlobeChart3D } from "@/components/ui/globe-chart-3d"
import { chartConfig, chartData } from "@/docs/examples/globe-chart-3d-demo"
import { RendererGrid } from "@/docs/examples/renderer-select"

// The same marks on every renderer, side by side: the chart hands them to the container as data.
export default function GlobeChart3DRenderersDemo() {
  return (
    <RendererGrid config={chartConfig}>
      <GlobeChart3D data={chartData} lon="lon" lat="lat" value="population" />
    </RendererGrid>
  )
}
