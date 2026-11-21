import { useState } from "react"

import { ChartContainer3D, type Renderer3D } from "@/components/ui/chart-3d"
import { PlacesChart3D } from "@/components/ui/places-chart-3d"
import { land } from "@/docs/examples/land"
import { chartData } from "@/docs/examples/places-chart-3d-demo"
import { compact, placeConfig } from "@/docs/examples/population"
import { Button, RendererSelect } from "@/docs/examples/renderer-select"

// The same places, read two ways: a dot is as large as the people of its
// metro area or of its city proper, and glides from the one to the other.
export default function PlacesChart3DUpdateDemo() {
  const [value, setValue] = useState<"metro" | "city">("metro")
  const [renderer, setRenderer] = useState<Renderer3D>("svg")

  return (
    <div className="flex flex-col gap-2">
      <ChartContainer3D config={placeConfig} renderer={renderer} legend>
        <PlacesChart3D
          data={chartData}
          land={land}
          lon="lon"
          lat="lat"
          value={value}
          series="kind"
          id="name"
          format={{ value: compact }}
        />
      </ChartContainer3D>
      <Button onClick={() => setValue(value === "metro" ? "city" : "metro")}>
        {value === "metro" ? "Show the cities proper" : "Show the metro areas"}
      </Button>
      <RendererSelect renderer={renderer} onChange={setRenderer} />
    </div>
  )
}
