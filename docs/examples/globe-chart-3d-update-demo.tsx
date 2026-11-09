import { useState } from "react"

import { ChartContainer3D, type Renderer3D } from "@/components/ui/chart-3d"
import { GlobeChart3D } from "@/components/ui/globe-chart-3d"
import { BivariateLegend, bivariateConfig, night } from "@/docs/examples/bivariate"
import { chartData, step } from "@/docs/examples/globe-chart-3d-demo"
import { land } from "@/docs/examples/land"
import { RendererSelect } from "@/docs/examples/renderer-select"

// The same tiles, read two ways: a tile rises to its strongest quake, or to
// how many it holds, and glides from the one to the other.
export default function GlobeChart3DUpdateDemo() {
  const [value, setValue] = useState<"magnitude" | "quakes">("magnitude")
  const [renderer, setRenderer] = useState<Renderer3D>("svg")

  return (
    <div className="flex flex-col gap-2">
      <ChartContainer3D config={bivariateConfig("BuPu")} renderer={renderer} style={night}>
        <GlobeChart3D
          data={chartData}
          land={land}
          lon="lon"
          lat="lat"
          value={value}
          series="class"
          step={step}
          format={(v) => (value === "magnitude" ? v.toFixed(1) : v)}
        />
      </ChartContainer3D>
      <BivariateLegend scheme="BuPu" />
      <button
        type="button"
        onClick={() => setValue(value === "magnitude" ? "quakes" : "magnitude")}
        className="inline-flex h-8 items-center justify-center self-center rounded-md border border-input bg-background px-3 text-xs font-medium hover:bg-accent hover:text-accent-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        {value === "magnitude" ? "Show the number of quakes" : "Show the strongest quake"}
      </button>
      <RendererSelect renderer={renderer} onChange={setRenderer} />
    </div>
  )
}
