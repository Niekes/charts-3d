import { useState } from "react"

import { ChartContainer3D, type Renderer3D } from "@/components/ui/chart-3d"
import { PlacesChart3D } from "@/components/ui/places-chart-3d"
import { land } from "@/docs/examples/land"
import { chartData } from "@/docs/examples/places-chart-3d-demo"
import { compact, night, placeConfig } from "@/docs/examples/population"
import { RendererSelect } from "@/docs/examples/renderer-select"

// The same places, read two ways: a dot is as large as the people of its
// metro area or of its city proper, and glides from the one to the other.
export default function PlacesChart3DUpdateDemo() {
  const [value, setValue] = useState<"metro" | "city">("metro")
  const [renderer, setRenderer] = useState<Renderer3D>("svg")

  return (
    <div className="flex flex-col gap-2">
      <ChartContainer3D config={placeConfig} renderer={renderer} style={night} legend>
        <PlacesChart3D
          data={chartData}
          land={land}
          lon="lon"
          lat="lat"
          value={value}
          series="kind"
          id="name"
          format={compact}
        />
      </ChartContainer3D>
      <button
        type="button"
        onClick={() => setValue(value === "metro" ? "city" : "metro")}
        className="inline-flex h-8 items-center justify-center self-center rounded-md border border-input bg-background px-3 text-xs font-medium hover:bg-accent hover:text-accent-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        {value === "metro" ? "Show the cities proper" : "Show the metro areas"}
      </button>
      <RendererSelect renderer={renderer} onChange={setRenderer} />
    </div>
  )
}
