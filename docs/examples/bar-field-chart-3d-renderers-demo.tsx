import { BarFieldChart3D } from "@/components/ui/bar-field-chart-3d"
import { chartConfig, chartData, format } from "@/docs/examples/bar-field-chart-3d-demo"
import { RendererGrid } from "@/docs/examples/renderer-select"

// The same marks on every renderer, side by side: the chart hands them to the container as data.
export default function BarFieldChart3DRenderersDemo() {
  return (
    <RendererGrid config={chartConfig} defaultView={{ yaw: Math.PI / 5, tilt: Math.PI / 5 }}>
      <BarFieldChart3D data={chartData} domain={{ x: [-1, 1], z: [-1, 1] }} format={format} />
    </RendererGrid>
  )
}
