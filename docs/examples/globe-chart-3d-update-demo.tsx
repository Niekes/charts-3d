import { useState } from "react"

import { ChartContainer3D, type Renderer3D } from "@/components/ui/chart-3d"
import { GlobeChart3D } from "@/components/ui/globe-chart-3d"
import { chartConfig, chartData } from "@/docs/examples/globe-chart-3d-demo"
import { RendererSelect } from "@/docs/examples/renderer-select"

// The same tiles every time, so they glide in place when the data updates.
export default function GlobeChart3DUpdateDemo() {
  const [data, setData] = useState(chartData)
  const [renderer, setRenderer] = useState<Renderer3D>("svg")

  return (
    <div className="flex flex-col gap-2">
      <ChartContainer3D config={chartConfig} renderer={renderer}>
        <GlobeChart3D data={data} lon="lon" lat="lat" value="population" />
      </ChartContainer3D>
      <button
        type="button"
        onClick={() =>
          setData(
            chartData.map((tile) => ({
              ...tile,
              population: Math.round(tile.population * (0.5 + Math.random())),
            }))
          )
        }
        className="inline-flex h-8 items-center justify-center self-center rounded-md border border-input bg-background px-3 text-xs font-medium hover:bg-accent hover:text-accent-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        Update
      </button>
      <RendererSelect renderer={renderer} onChange={setRenderer} />
    </div>
  )
}
