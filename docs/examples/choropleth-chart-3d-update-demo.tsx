import { useState } from "react"

import { ChartContainer3D, type Renderer3D } from "@/components/ui/chart-3d"
import { ChoroplethChart3D } from "@/components/ui/choropleth-chart-3d"
import { land } from "@/docs/examples/land"
import { compact } from "@/docs/examples/population"
import { regionConfig, regionRows } from "@/docs/examples/regions"
import { Button, RendererSelect } from "@/docs/examples/renderer-select"

// The same countries in the fifths of their people or of their GDP: a
// country that changes its fifth fades from the one color to the other.
export default function ChoroplethChart3DUpdateDemo() {
  const [value, setValue] = useState<"population" | "gdp">("population")
  const [renderer, setRenderer] = useState<Renderer3D>("svg")

  return (
    <div className="flex flex-col gap-2">
      <ChartContainer3D config={regionConfig} renderer={renderer} legend>
        <ChoroplethChart3D
          data={regionRows(value)}
          land={land}
          id="id"
          value={value}
          series="class"
          label="name"
          format={{ value: (v) => (value === "population" ? compact(v) : `$${compact(v * 1e6)}`) }}
        />
      </ChartContainer3D>
      <Button onClick={() => setValue(value === "population" ? "gdp" : "population")}>
        {value === "population" ? "Show the GDP" : "Show the people"}
      </Button>
      <RendererSelect renderer={renderer} onChange={setRenderer} />
    </div>
  )
}
