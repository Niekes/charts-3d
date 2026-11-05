import { AreaChart3D } from "@/components/ui/area-chart-3d"
import { chartConfig, chartData } from "@/docs/examples/area-chart-3d-demo"
import { RendererGrid } from "@/docs/examples/renderer-select"

// The same marks on every renderer, side by side: the chart hands them to the container as data.
export default function AreaChart3DRenderersDemo() {
  return (
    <RendererGrid config={chartConfig}>
      <AreaChart3D data={chartData} index="year" titles={{ y: "Share price" }} />
    </RendererGrid>
  )
}
