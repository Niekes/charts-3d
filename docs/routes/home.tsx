import { HomeLayout } from "fumadocs-ui/layouts/home"
import { Link } from "react-router"

import { Scanner } from "@/docs/components/scanner"
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
      <div className="relative flex flex-1 flex-col items-center justify-center p-4 text-center">
        <div aria-hidden="true" className="absolute inset-0">
          <Scanner />
        </div>
        <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-fd-foreground/10 bg-fd-background/40 px-8 py-12 shadow-2xl shadow-black/10 backdrop-blur-xl sm:px-12 dark:shadow-black/60">
          <div
            aria-hidden="true"
            className="absolute inset-x-8 top-0 h-px bg-linear-to-r from-transparent via-fd-foreground/40 to-transparent"
          />
          <h1 className="mb-3 bg-linear-to-b from-fd-foreground to-fd-foreground/60 bg-clip-text text-4xl font-bold tracking-tight text-transparent sm:text-5xl">
            charts-3d
          </h1>
          <p className="mb-8 text-fd-muted-foreground">3D charts for shadcn/ui, built on d3-3d.</p>
          <Link
            className="group inline-flex items-center gap-2 rounded-full bg-fd-primary px-5 py-2.5 text-sm font-medium text-fd-primary-foreground shadow-lg transition hover:shadow-xl motion-safe:hover:scale-105"
            to="/docs"
          >
            Get started
            <span
              aria-hidden="true"
              className="transition-transform motion-safe:group-hover:translate-x-0.5"
            >
              →
            </span>
          </Link>
        </div>
      </div>
    </HomeLayout>
  )
}
