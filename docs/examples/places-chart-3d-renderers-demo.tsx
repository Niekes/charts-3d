import { PlacesChart3D } from "@/components/ui/places-chart-3d"
import { land } from "@/docs/examples/land"
import { chartData } from "@/docs/examples/places-chart-3d-demo"
import { compact, night, placeConfig } from "@/docs/examples/population"
import { RendererGrid } from "@/docs/examples/renderer-select"

// The same marks on every renderer, side by side: the chart hands them to the container as data.
export default function PlacesChart3DRenderersDemo() {
  return (
    <RendererGrid config={placeConfig} style={night}>
      <PlacesChart3D
        data={chartData}
        land={land}
        lon="lon"
        lat="lat"
        value="metro"
        series="kind"
        id="name"
        format={compact}
      />
    </RendererGrid>
  )
}
