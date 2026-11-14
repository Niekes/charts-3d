import type { ComponentProps } from "react"

import { ChartContainer3D, type Renderer3D } from "@/components/ui/chart-3d"

const renderers: { id: Renderer3D; label: string }[] = [
  { id: "svg", label: "SVG" },
  { id: "canvas", label: "Canvas" },
]

/** The same scene on every renderer, side by side, for the renderers demos. */
export function RendererGrid({
  children,
  ...container
}: Omit<ComponentProps<typeof ChartContainer3D>, "renderer">) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {renderers.map(({ id, label }) => (
        <figure key={id} className="flex flex-col gap-1">
          <ChartContainer3D {...container} renderer={id}>
            {children}
          </ChartContainer3D>
          <figcaption className="text-center text-xs text-muted-foreground">{label}</figcaption>
        </figure>
      ))}
    </div>
  )
}

/** A labelled select below a demo, over the options of a demo's knob. */
export function Select<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: { id: T; label: string }[]
  onChange: (value: T) => void
}) {
  return (
    <label className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="h-8 rounded-md border border-input bg-background px-2 text-xs font-medium hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        {options.map(({ id, label }) => (
          <option key={id} value={id}>
            {label}
          </option>
        ))}
      </select>
    </label>
  )
}

/** The select over the renderers, below every demo. */
export function RendererSelect({
  renderer,
  onChange,
}: {
  renderer: Renderer3D
  onChange: (renderer: Renderer3D) => void
}) {
  return <Select label="Renderer" value={renderer} options={renderers} onChange={onChange} />
}
