import { GlobeChart3D } from "@/components/ui/globe-chart-3d"
import { chartData, step } from "@/docs/examples/globe-chart-3d-demo"
import { land } from "@/docs/examples/land"
import { compact, night, populationConfig } from "@/docs/examples/population"
import { RendererGrid } from "@/docs/examples/renderer-select"

// The same marks on every renderer, side by side: the chart hands them to the container as data.
export default function GlobeChart3DRenderersDemo() {
  return (
    <RendererGrid config={populationConfig} style={night}>
      <GlobeChart3D
        data={chartData}
        land={land}
        lon="lon"
        lat="lat"
        value="metro"
        series="class"
        label="place"
        step={step}
        format={compact}
      />
    </RendererGrid>
  )
}
