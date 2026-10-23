import { HomeLayout } from "fumadocs-ui/layouts/home"
import { Link } from "react-router"

import { baseOptions } from "@/docs/lib/layout"

export function meta() {
  return [
    { title: "charts-3d" },
    { name: "description", content: "3D charts for shadcn/ui, built on d3-3d." },
  ]
}

export default function Home() {
  return (
    <HomeLayout {...baseOptions()}>
      <div className="flex flex-1 flex-col items-center justify-center p-4 text-center">
        <h1 className="mb-2 text-2xl font-bold">charts-3d</h1>
        <p className="mb-4 text-fd-muted-foreground">3D charts for shadcn/ui, built on d3-3d.</p>
        <Link
          className="rounded-full bg-fd-primary px-4 py-2.5 text-sm font-medium text-fd-primary-foreground"
          to="/docs"
        >
          Get started
        </Link>
      </div>
    </HomeLayout>
  )
}
