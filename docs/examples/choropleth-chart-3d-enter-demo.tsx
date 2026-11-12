import { useState } from "react"

import { ChartContainer3D, type Renderer3D } from "@/components/ui/chart-3d"
import { ChoroplethChart3D } from "@/components/ui/choropleth-chart-3d"
import { land } from "@/docs/examples/land"
import { compact, night } from "@/docs/examples/population"
import { regionConfig, regionRows } from "@/docs/examples/regions"
import { RendererSelect, Select } from "@/docs/examples/renderer-select"

// The smallest country shown, from the hundred-million ones down to every country.
const MIN = [100e6, 10e6, 1e6, 0]

// The world country by country: lowering the bar, the smaller countries
// fade in; raising it, they fade back to land. The fifths are taken among
// the countries shown, so a country may change its color as others join.
export default function ChoroplethChart3DEnterDemo() {
  const [min, setMin] = useState(MIN[1])
  const [renderer, setRenderer] = useState<Renderer3D>("svg")

  return (
    <div className="flex flex-col gap-2">
      <ChartContainer3D config={regionConfig} renderer={renderer} style={night} legend>
        <ChoroplethChart3D
          data={regionRows("population", min)}
          land={land}
          id="id"
          value="population"
          series="class"
          label="name"
          format={compact}
        />
      </ChartContainer3D>
      <Select
        label="Countries"
        value={String(min)}
        options={MIN.map((m) => ({
          id: String(m),
          label: m ? `${compact(m)} people and up` : "Every country",
        }))}
        onChange={(v) => setMin(Number(v))}
      />
      <RendererSelect renderer={renderer} onChange={setRenderer} />
    </div>
  )
}
