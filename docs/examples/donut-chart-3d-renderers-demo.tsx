import { DonutChart3D } from "@/components/ui/donut-chart-3d"
import { chartConfig, chartData } from "@/docs/examples/donut-chart-3d-demo"
import { RendererGrid } from "@/docs/examples/renderer-select"

// The same marks on every renderer, side by side: the chart hands them to the container as data.
export default function DonutChart3DRenderersDemo() {
  return (
    <RendererGrid config={chartConfig}>
      <DonutChart3D data={chartData} id="browser" value="visitors" />
    </RendererGrid>
  )
}
