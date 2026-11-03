import { box, cubes3D, sort } from "d3-3d"

import {
  Axes3D,
  ChartContainer3D,
  Marks3D,
  shade,
  useChart3D,
  type ChartConfig,
} from "@/components/ui/chart-3d"

const chartConfig = { cube: { label: "Cube", color: "var(--chart-1)" } } satisfies ChartConfig

const spec = {
  x: { domain: [-1, 1], ticks: [-1, 0, 1] },
  y: { domain: [-1, 1], ticks: [-1, 0, 1] },
  z: { domain: [-1, 1], ticks: [-1, 0, 1] },
}
const world = { x: (v: number) => v, y: (v: number) => -v, z: (v: number) => v }

// Your own shape on the camera of the container: one cube in the chart box,
// handed to Marks3D, so it draws with every renderer.
function Cube() {
  const { camera } = useChart3D()
  const [cube] = cubes3D()
    .camera(camera)
    .data([box({ x: 0, y: 0.5, z: 0, width: 1, height: 1, depth: 1 })])

  return (
    <Marks3D
      marks={cube.faces
        .filter((face) => face.ccw)
        .sort(sort)
        .map((face) => ({
          key: face.face,
          points: face.map((p) => p.projected),
          fill: shade(face, "var(--color-cube)"),
        }))}
    />
  )
}

export default function Chart3DDemo() {
  return (
    <ChartContainer3D config={chartConfig}>
      <Axes3D spec={spec} world={world} />
      <Cube />
    </ChartContainer3D>
  )
}
