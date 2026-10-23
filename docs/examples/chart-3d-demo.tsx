import { box, cubes3D, sort } from "d3-3d"

import {
  Axes3D,
  ChartContainer3D,
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

// Your own shape on the camera of the container: one cube in the chart box.
function Cube() {
  const { camera } = useChart3D()
  const cubes = cubes3D().camera(camera)
  const [cube] = cubes.data([box({ x: 0, y: 0.5, z: 0, width: 1, height: 1, depth: 1 })])

  return cube.faces
    .filter((face) => face.ccw)
    .sort(sort)
    .map((face) => (
      <path key={face.face} d={cubes.draw(face)} fill={shade(face, "var(--color-cube)")} />
    ))
}

export default function Chart3DDemo() {
  return (
    <ChartContainer3D config={chartConfig}>
      <Axes3D spec={spec} world={world} />
      <Cube />
    </ChartContainer3D>
  )
}
