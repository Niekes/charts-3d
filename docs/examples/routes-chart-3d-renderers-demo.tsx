import { RoutesChart3D } from "@/components/ui/routes-chart-3d"
import { land } from "@/docs/examples/land"
import { RendererGrid } from "@/docs/examples/renderer-select"
import { chartConfig, chartData, chartView } from "@/docs/examples/routes-chart-3d-demo"

// The same routes on every renderer, side by side: the chart hands its marks to the container as data.
export default function RoutesChart3DRenderersDemo() {
  return (
    <RendererGrid config={chartConfig} defaultView={chartView}>
      <RoutesChart3D data={chartData} land={land} lon="lon" lat="lat" id="name" series="route" />
    </RendererGrid>
  )
}
