import { useState } from "react"

import { ChartContainer3D, type ChartConfig, type Renderer3D } from "@/components/ui/chart-3d"
import { GlobeChart3D } from "@/components/ui/globe-chart-3d"
import { land } from "@/docs/examples/land"
import { RendererSelect } from "@/docs/examples/renderer-select"

// A year of disasters with fixed numbers, so the only change is which of
// them are there: an event is a tile of its type, its strength the height.
const events = [
  { lon: 142, lat: 38, type: "quake", strength: 90 },
  { lon: -74, lat: 18, type: "quake", strength: 70 },
  { lon: 90, lat: 24, type: "flood", strength: 80 },
  { lon: -90, lat: 30, type: "storm", strength: 60 },
  { lon: 125, lat: 12, type: "storm", strength: 85 },
  { lon: 10, lat: 50, type: "flood", strength: 40 },
  { lon: 30, lat: 40, type: "quake", strength: 75 },
  { lon: -77, lat: 1, type: "quake", strength: 50 },
  { lon: 100, lat: 15, type: "flood", strength: 55 },
  { lon: -65, lat: 20, type: "storm", strength: 95 },
  { lon: 85, lat: 28, type: "quake", strength: 80 },
  { lon: 150, lat: -25, type: "flood", strength: 45 },
  { lon: 40, lat: -15, type: "storm", strength: 65 },
  { lon: -70, lat: -33, type: "quake", strength: 85 },
  { lon: 115, lat: 5, type: "flood", strength: 50 },
  { lon: 170, lat: -40, type: "quake", strength: 60 },
]

const chartConfig = {
  quake: { label: "Earthquake", color: "var(--chart-1)" },
  flood: { label: "Flood", color: "var(--chart-2)" },
  storm: { label: "Storm", color: "var(--chart-3)" },
} satisfies ChartConfig

const button =
  "inline-flex h-8 items-center justify-center rounded-md border border-input bg-background px-3 text-xs font-medium hover:bg-accent hover:text-accent-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50"

export default function GlobeChart3DEnterDemo() {
  const [count, setCount] = useState(6)
  const [renderer, setRenderer] = useState<Renderer3D>("svg")

  return (
    <div className="flex flex-col gap-2">
      <ChartContainer3D config={chartConfig} renderer={renderer} legend>
        <GlobeChart3D
          data={events.slice(0, count)}
          land={land}
          lon="lon"
          lat="lat"
          value="strength"
          series="type"
          step={10}
        />
      </ChartContainer3D>
      <div className="flex gap-2 self-center">
        <button
          type="button"
          disabled={count <= 1}
          onClick={() => setCount((c) => Math.max(1, c - 1))}
          className={button}
        >
          − Event
        </button>
        <button
          type="button"
          disabled={count >= events.length}
          onClick={() => setCount((c) => Math.min(events.length, c + 1))}
          className={button}
        >
          + Event
        </button>
      </div>
      <RendererSelect renderer={renderer} onChange={setRenderer} />
    </div>
  )
}
