import type { Keymap3D } from "@/components/ui/chart-3d"

/**
 * The demo default: the chart is inspected on hover, and the camera moves
 * with the keys only - the pointer gestures opt in per chart.
 */
export const inspectOnlyKeymap = {
  dragRotate: false,
  dragPan: false,
  wheelZoom: false,
  doubleClickReset: false,
} satisfies Keymap3D
