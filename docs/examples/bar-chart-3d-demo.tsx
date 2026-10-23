import { ChartContainer3D, type ChartConfig } from "@/components/ui/chart-3d"
import { BarChart3D } from "@/components/ui/bar-chart-3d"

const chartData = [
  { month: "January", desktop: 186, mobile: 80 },
  { month: "February", desktop: 305, mobile: 200 },
  { month: "March", desktop: 237, mobile: 120 },
  { month: "April", desktop: 73, mobile: 190 },
  { month: "May", desktop: 209, mobile: 130 },
  { month: "June", desktop: 214, mobile: 140 },
]

const chartConfig = {
  desktop: { label: "Desktop", color: "var(--chart-1)" },
  mobile: { label: "Mobile", color: "var(--chart-2)" },
} satisfies ChartConfig

export default function BarChart3DDemo() {
  return (
    <ChartContainer3D config={chartConfig} legend>
      <BarChart3D
        data={chartData}
        index="month"
        format={{ x: (month) => month.slice(0, 3) }}
        titles={{ y: "Visitors" }}
      />
    </ChartContainer3D>
  )
}
