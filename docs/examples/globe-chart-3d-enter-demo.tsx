import { useState } from "react"

import { ChartContainer3D, type Renderer3D } from "@/components/ui/chart-3d"
import { GlobeChart3D } from "@/components/ui/globe-chart-3d"
import { BivariateLegend, bivariateConfig, night, quakeTiles } from "@/docs/examples/bivariate"
import { land } from "@/docs/examples/land"
import { RendererSelect } from "@/docs/examples/renderer-select"

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

const button =
  "inline-flex h-8 items-center justify-center rounded-md border border-input bg-background px-3 text-xs font-medium hover:bg-accent hover:text-accent-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50"
const step = 2

// The year month by month: the quakes of a month enter as it is added and
// leave as it is taken away, and a tile that was there already grows.
export default function GlobeChart3DEnterDemo() {
  const [months, setMonths] = useState(3)
  const [renderer, setRenderer] = useState<Renderer3D>("svg")

  return (
    <div className="flex flex-col gap-2">
      <ChartContainer3D config={bivariateConfig("BuPu")} renderer={renderer} style={night}>
        <GlobeChart3D
          data={quakeTiles(step, months)}
          land={land}
          lon="lon"
          lat="lat"
          value="magnitude"
          series="class"
          step={step}
          format={(magnitude) => magnitude.toFixed(1)}
        />
      </ChartContainer3D>
      <BivariateLegend scheme="BuPu" />
      <div className="flex items-center gap-2 self-center text-xs text-muted-foreground">
        <button
          type="button"
          disabled={months <= 1}
          onClick={() => setMonths((m) => Math.max(1, m - 1))}
          className={button}
        >
          − Month
        </button>
        <span className="w-20 text-center">
          {months === 1 ? "Jan" : `Jan – ${MONTHS[months - 1]}`}
        </span>
        <button
          type="button"
          disabled={months >= 12}
          onClick={() => setMonths((m) => Math.min(12, m + 1))}
          className={button}
        >
          + Month
        </button>
      </div>
      <RendererSelect renderer={renderer} onChange={setRenderer} />
    </div>
  )
}
