import { SurfaceChart3D } from "@/components/ui/surface-chart-3d"
import { chartConfig, chartData } from "@/docs/examples/surface-chart-3d-demo"
import { RendererGrid } from "@/docs/examples/renderer-select"

// The same marks on every renderer, side by side: the chart hands them to the container as data.
export default function SurfaceChart3DRenderersDemo() {
  return (
    <RendererGrid config={chartConfig} defaultView={{ yaw: Math.PI / 5, tilt: Math.PI / 5 }}>
      <SurfaceChart3D data={chartData} domain={{ x: [-5, 5], z: [-5, 5] }} />
    </RendererGrid>
  )
}
