import { useState } from "react"

import { ChartContainer3D, type Renderer3D } from "@/components/ui/chart-3d"
import { GlobeChart3D } from "@/components/ui/globe-chart-3d"
import { chartData, step } from "@/docs/examples/globe-chart-3d-demo"
import { land } from "@/docs/examples/land"
import { compact, populationConfig } from "@/docs/examples/population"
import { RendererSelect } from "@/docs/examples/renderer-select"

// The same tiles, read two ways: a tile rises to the people of its metro
// areas or of its cities proper, and glides from the one to the other. Its
// class stays that of the metro areas, so every tile glides and none leaves.
export default function GlobeChart3DUpdateDemo() {
  const [value, setValue] = useState<"metro" | "city">("metro")
  const [renderer, setRenderer] = useState<Renderer3D>("canvas")

  return (
    <div className="flex flex-col gap-2">
      <ChartContainer3D config={populationConfig} renderer={renderer} legend>
        <GlobeChart3D
          data={chartData}
          land={land}
          lon="lon"
          lat="lat"
          value={value}
          series="class"
          label="place"
          step={step}
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
