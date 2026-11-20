import { LineChart3D } from "@/components/ui/line-chart-3d"
import { chartConfig, chartData } from "@/docs/examples/line-chart-3d-demo"
import { RendererGrid } from "@/docs/examples/renderer-select"

// The same lines on every renderer, side by side: the chart hands its marks to the container as data.
export default function LineChart3DRenderersDemo() {
  return (
    <RendererGrid config={chartConfig}>
      <LineChart3D data={chartData} x="x" y="y" z="z" series="strand" />
    </RendererGrid>
  )
}
