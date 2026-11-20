import { useState } from "react"

import { ChartContainer3D, type ChartConfig, type Renderer3D } from "@/components/ui/chart-3d"
import { LineChart3D } from "@/components/ui/line-chart-3d"
import { RendererSelect } from "@/docs/examples/renderer-select"

/** A walk of forty steps through space: every step turns `turn(i)` of a full step along each axis. */
function walk(turn: (i: number) => number) {
  const at = { x: 0, y: 0, z: 0 }
  return Array.from({ length: 40 }, (_, i) => {
    at.x += turn(3 * i)
    at.y += turn(3 * i + 1)
    at.z += turn(3 * i + 2)
    return { ...at }
  })
}

const chartConfig = { walk: { label: "Walk", color: "var(--chart-1)" } } satisfies ChartConfig

export default function LineChart3DUpdateDemo() {
  // The first walk is deterministic, so the page looks the same on every load:
  // the digits far down a sine are as good as random.
  const [data, setData] = useState(() => walk((i) => (Math.sin(i * 12.9898) * 43758.5453) % 1))
  const [renderer, setRenderer] = useState<Renderer3D>("svg")

  return (
    <div className="flex flex-col gap-2">
      <ChartContainer3D config={chartConfig} renderer={renderer}>
        <LineChart3D data={data} x="x" y="y" z="z" />
      </ChartContainer3D>
      <button
        type="button"
        onClick={() => setData(walk(() => 2 * Math.random() - 1))}
        className="inline-flex h-8 items-center justify-center self-center rounded-md border border-input bg-background px-3 text-xs font-medium hover:bg-accent hover:text-accent-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        Update
      </button>
      <RendererSelect renderer={renderer} onChange={setRenderer} />
    </div>
  )
}
