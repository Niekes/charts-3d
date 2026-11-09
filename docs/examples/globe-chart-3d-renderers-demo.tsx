import { GlobeChart3D } from "@/components/ui/globe-chart-3d"
import { BivariateLegend, bivariateConfig, night } from "@/docs/examples/bivariate"
import { chartData, step } from "@/docs/examples/globe-chart-3d-demo"
import { land } from "@/docs/examples/land"
import { RendererGrid } from "@/docs/examples/renderer-select"

// The same marks on every renderer, side by side: the chart hands them to the container as data.
export default function GlobeChart3DRenderersDemo() {
  return (
    <div className="flex flex-col gap-2">
      <RendererGrid config={bivariateConfig("BuPu")} style={night}>
        <GlobeChart3D
          data={chartData}
          land={land}
          lon="lon"
          lat="lat"
          value="magnitude"
          series="class"
          step={step}
          format={(magnitude) => magnitude.toFixed(1)}
        />
      </RendererGrid>
      <BivariateLegend scheme="BuPu" />
    </div>
  )
}
