import { ScatterChart3D } from "@/components/ui/scatter-chart-3d"
import { chartConfig, chartData } from "@/docs/examples/scatter-chart-3d-demo"
import { RendererGrid } from "@/docs/examples/renderer-select"

// The same marks on every renderer, side by side: the chart hands them to the container as data.
export default function ScatterChart3DRenderersDemo() {
  return (
    <RendererGrid config={chartConfig}>
      <ScatterChart3D data={chartData} x="x" y="y" z="z" series="cluster" />
    </RendererGrid>
  )
}
