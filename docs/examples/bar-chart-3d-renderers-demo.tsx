import { BarChart3D } from "@/components/ui/bar-chart-3d"
import { chartConfig, chartData } from "@/docs/examples/bar-chart-3d-demo"
import { RendererGrid } from "@/docs/examples/renderer-select"

// The same marks on every renderer, side by side: the chart hands them to the container as data.
export default function BarChart3DRenderersDemo() {
  return (
    <RendererGrid config={chartConfig}>
      <BarChart3D data={chartData} index="month" titles={{ y: "Visitors" }} />
    </RendererGrid>
  )
}
