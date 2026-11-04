import type { Renderer3D } from "@/components/ui/chart-3d"

const renderers: { id: Renderer3D; label: string }[] = [
  { id: "svg", label: "SVG" },
  { id: "canvas", label: "Canvas" },
  { id: "webgl", label: "WebGL" },
]

/** The select over the renderers, for the renderers demos. */
export function RendererSelect({
  renderer,
  onChange,
}: {
  renderer: Renderer3D
  onChange: (renderer: Renderer3D) => void
}) {
  return (
    <label className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
      Renderer
      <select
        value={renderer}
        onChange={(e) => onChange(e.target.value as Renderer3D)}
        className="h-8 rounded-md border border-input bg-background px-2 text-xs font-medium hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        {renderers.map(({ id, label }) => (
          <option key={id} value={id}>
            {label}
          </option>
        ))}
      </select>
    </label>
  )
}
