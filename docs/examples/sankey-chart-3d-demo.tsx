import { ChartContainer3D, type ChartConfig } from "@/components/ui/chart-3d"
import { SankeyChart3D } from "@/components/ui/sankey-chart-3d"

// The visitors of a month: where they came from, the page they landed on and
// what they did. Returning visitors go straight to the sign-up.
const chartData = [
  { source: "search", target: "home", value: 1200 },
  { source: "search", target: "pricing", value: 500 },
  { source: "social", target: "home", value: 800 },
  { source: "social", target: "pricing", value: 150 },
  { source: "direct", target: "home", value: 400 },
  { source: "direct", target: "pricing", value: 300 },
  { source: "direct", target: "signup", value: 200 },
  { source: "home", target: "signup", value: 600 },
  { source: "home", target: "bounce", value: 1800 },
  { source: "pricing", target: "signup", value: 550 },
  { source: "pricing", target: "bounce", value: 400 },
]

const chartConfig = {
  search: { label: "Search", color: "var(--chart-1)" },
  social: { label: "Social", color: "var(--chart-2)" },
  direct: { label: "Direct", color: "var(--chart-3)" },
  home: { label: "Home", color: "var(--chart-4)" },
  pricing: { label: "Pricing", color: "var(--chart-5)" },
  signup: { label: "Sign-up", color: "var(--chart-2)" },
  bounce: { label: "Bounce", color: "var(--muted-foreground)" },
} satisfies ChartConfig

export default function SankeyChart3DDemo() {
  return (
    <ChartContainer3D config={chartConfig} defaultView={{ yaw: -Math.PI / 6, tilt: Math.PI / 6 }}>
      <SankeyChart3D data={chartData} />
    </ChartContainer3D>
  )
}
