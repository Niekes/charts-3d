import type { Renderer3D } from "@/components/ui/chart-3d"

const renderers: { id: Renderer3D; label: string }[] = [
  { id: "svg", label: "SVG" },
  { id: "canvas", label: "Canvas" },
  { id: "webgl", label: "WebGL" },
]

/** The SVG / Canvas / WebGL switch below a chart, for the renderers demos. */
export function RendererSwitch({
  renderer,
  onChange,
}: {
  renderer: Renderer3D
  onChange: (renderer: Renderer3D) => void
}) {
  return (
    <div className="flex justify-center gap-1">
      {renderers.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          aria-pressed={renderer === id}
          onClick={() => onChange(id)}
          className="inline-flex h-8 items-center justify-center rounded-md border border-input bg-background px-3 text-xs font-medium hover:bg-accent hover:text-accent-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-pressed:bg-accent aria-pressed:text-accent-foreground"
        >
          {label}
        </button>
      ))}
    </div>
  )
}
