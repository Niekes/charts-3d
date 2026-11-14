import { useState } from "react"

import { ChartContainer3D, type Renderer3D } from "@/components/ui/chart-3d"
import { ChoroplethChart3D } from "@/components/ui/choropleth-chart-3d"
import { land } from "@/docs/examples/land"
import { compact } from "@/docs/examples/population"
import { regionConfig, regionRows } from "@/docs/examples/regions"
import { RendererSelect } from "@/docs/examples/renderer-select"

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
          format={(v) => (value === "population" ? compact(v) : `$${compact(v * 1e6)}`)}
        />
      </ChartContainer3D>
      <button
        type="button"
        onClick={() => setValue(value === "population" ? "gdp" : "population")}
        className="inline-flex h-8 items-center justify-center self-center rounded-md border border-input bg-background px-3 text-xs font-medium hover:bg-accent hover:text-accent-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        {value === "population" ? "Show the GDP" : "Show the people"}
      </button>
      <RendererSelect renderer={renderer} onChange={setRenderer} />
    </div>
  )
}
