"use client"

import * as React from "react"
import { cubes3D, sort, type Camera3DInstance, type Cube, type CubeFace, type Point3D } from "d3-3d"

import {
  Labels3D,
  Marks3D,
  center,
  cubeMarks,
  useChart3D,
  useTween,
  type ChartConfig,
  type Label3D,
} from "@/registry/new-york/ui/chart-3d"

export type SankeyChart3DProps = {
  /** One entry per flow. `source` and `target` are keys of the chart config, which names and colors the nodes. */
  data: { source: string; target: string; value: number }[]
  /**
   * The width of a node, as a share of the distance between two columns.
   * @defaultValue 0.2
   */
  nodeWidth?: number
  /**
   * The gap between two nodes of a column, as a share of the height.
   * @defaultValue 0.05
   */
  nodePadding?: number
  /** Formats the values in the tooltip. */
  format?: (value: number) => React.ReactNode
}

// The depth of a node in world units, and the share of it a flow takes.
const DEPTH = 0.4
const RIBBON = 0.7
// The slices of a flow from one column to the next: the more, the smoother it bends.
const SEGMENTS = 16

/**
 * A node of the layout, from its top `y0` to its bottom `y1` in the world. A
 * node with a `flow` is a waypoint, where a flow that skips a column passes it.
 */
type SankeyNode = {
  id: string
  column: number
  value: number
  y0: number
  y1: number
  incoming: Hop[]
  outgoing: Hop[]
  flow?: Flow
}

/** An entry of `data` between its two nodes. */
type Flow = { key: string; source: SankeyNode; target: SankeyNode; value: number }

/** The part of a flow from one column to the next, from the middle of its slot at the source, `y0`, to the one at the target, `y1`. */
type Hop = { flow: Flow; source: SankeyNode; target: SankeyNode; y0: number; y1: number }

/**
 * A part of the chart in the world: a node, or a slice of a flow that has come
 * the share `t` of its way there. `band` is the middle of the slab between two
 * planes x = const that the part lies in.
 */
type Piece = Point3D[] & { key: string; band: number; node?: SankeyNode; flow?: Flow; t: number }

/**
 * Flows from left to right: every node a box in its column, as high as the
 * larger of what flows in and what flows out, and every flow a band from node
 * to node, as thick as its value, that turns from the color of its source to
 * the color of its target.
 */
export function SankeyChart3D({
  data,
  nodeWidth = 0.2,
  nodePadding = 0.05,
  format = (value) => value,
}: SankeyChart3DProps) {
  const { config, camera } = useChart3D()
  // The values glide flow by flow, a new one growing from 0; the layout follows them.
  const values = useTween(Object.fromEntries(data.map((d, i) => [String(i), d.value])), 0)
  const flows = data.map((d, i) => ({ ...d, value: values[String(i)] }))
  const { nodes, columns, ky } = sankeyLayout(flows, nodePadding)
  const pieces = depthSort(
    cubes3D()
      .camera(camera)
      .data(sankeyPieces(nodes, columns, ky, nodeWidth)),
    camera
  )
  // The labels sit outside: left of the nodes in the left half, right of the others.
  const labels = pieces.flatMap(({ key, faces, node }) =>
    node
      ? [
          nodeLabel(
            key,
            faces,
            node.column < (columns - 1) / 2 ? "left" : "right",
            style(config, node).label
          ),
        ]
      : []
  )

  return (
    <>
      <Marks3D marks={pieces.flatMap((piece) => pieceMarks(piece, config, format))} />
      <Labels3D labels={labels} />
    </>
  )
}

/** The label and the color of a node, from the chart config. */
function style(config: ChartConfig, node: SankeyNode) {
  return {
    label: config[node.id]?.label ?? node.id,
    color: config[node.id] ? `var(--color-${node.id})` : "var(--muted-foreground)",
  }
}

/**
 * The marks of a piece, each with its tooltip: the faces of a node, or the
 * faces of a slice of a flow, in the color it has turned to there.
 */
function pieceMarks(
  { key, faces, node, flow, t }: Cube<Point3D, Piece>,
  config: ChartConfig,
  format: (value: number) => React.ReactNode
) {
  const at = center(faces.find((face) => face.face === "top")!)
  if (node) {
    const { label, color } = style(config, node)
    return cubeMarks(key, faces, color, {
      at,
      items: [{ label, value: format(node.value), color }],
    })
  }
  const source = style(config, flow!.source)
  const target = style(config, flow!.target)
  const item = {
    label: (
      <>
        {source.label} → {target.label}
      </>
    ),
    value: format(flow!.value),
    color: source.color,
  }
  // The ends of a slice are joints, inside the flow or against a node.
  const sides = faces.filter((face) => face.face !== "left" && face.face !== "right")
  // A flow is softer than the nodes, a quarter towards the background, so that they stand out of it.
  const gradient = `color-mix(in oklch, color-mix(in oklch, ${target.color} ${t}%, ${source.color}) 75%, var(--background))`
  return cubeMarks(key, sides, gradient, { at, items: [item] })
}

/** The nodes of `data`, waypoints included, stacked in their columns, and `ky`, the world units per value. */
function sankeyLayout(data: SankeyChart3DProps["data"], nodePadding: number) {
  const { nodes, flows, columns } = sankeyColumns(data)
  const all = sankeyHops(nodes, flows)
  const ky = stackColumns(all, columns, nodePadding)
  stackHops(all, ky)
  return { nodes: all, columns, ky }
}

function newNode(id: string, column: number, flow?: Flow): SankeyNode {
  return { id, column, value: 0, y0: 0, y1: 0, incoming: [], outgoing: [], flow }
}

function middle(node: SankeyNode) {
  return (node.y0 + node.y1) / 2
}

/**
 * The nodes of `data` in the order they first appear, and the flows between
 * them, without the ones of no value. The column of a node is the longest
 * path to it from a source; the sinks move to the last column.
 */
function sankeyColumns(data: SankeyChart3DProps["data"]) {
  const nodes = new Map<string, SankeyNode>()
  const node = (id: string) => {
    if (!nodes.has(id)) nodes.set(id, newNode(id, 0))
    return nodes.get(id)!
  }
  const flows = data
    .filter((d) => d.value > 0)
    .map((d, i) => ({
      key: String(i),
      source: node(d.source),
      target: node(d.target),
      value: d.value,
    }))

  // Bellman-Ford for the longest paths: a pass more than there are nodes means a cycle.
  for (let pass = 0; flows.some((f) => f.target.column <= f.source.column); pass += 1) {
    if (pass === nodes.size) throw new Error("SankeyChart3D: the flows form a cycle")
    for (const f of flows) f.target.column = Math.max(f.target.column, f.source.column + 1)
  }
  const last = Math.max(0, ...flows.map((f) => f.target.column))
  const sources = new Set(flows.map((f) => f.source))
  for (const n of nodes.values()) if (!sources.has(n)) n.column = last
  return { nodes: [...nodes.values()], flows, columns: last + 1 }
}

/**
 * Splits every flow into hops from one column to the next. A flow that skips a
 * column passes it at a waypoint, a node of its own, so it has a slot in every
 * column it crosses and never runs through another node.
 */
function sankeyHops(nodes: SankeyNode[], flows: Flow[]) {
  const all = [...nodes]
  for (const flow of flows) {
    let source = flow.source
    for (let column = source.column + 1; column <= flow.target.column; column += 1) {
      const target =
        column < flow.target.column ? newNode(`${flow.key}:${column}`, column, flow) : flow.target
      if (target.flow) all.push(target)
      const hop = { flow, source, target, y0: 0, y1: 0 }
      source.outgoing.push(hop)
      target.incoming.push(hop)
      source = target
    }
  }
  return all
}

/**
 * Sizes the nodes to the largest scale at which every column fits, and stacks
 * each column from the top, centered. A column after the first orders its nodes
 * by the mean height of their sources, which uncrosses most flows. Returns the
 * scale, world units per value.
 */
function stackColumns(nodes: SankeyNode[], columns: number, nodePadding: number) {
  const total = (hops: Hop[]) => hops.reduce((sum, hop) => sum + hop.flow.value, 0)
  for (const node of nodes) node.value = Math.max(total(node.incoming), total(node.outgoing))
  const stacks = Array.from({ length: columns }, (_, c) => nodes.filter((n) => n.column === c))
  const sum = (stack: SankeyNode[]) => stack.reduce((s, n) => s + n.value, 0)
  // A crowded column narrows the gaps, so that its nodes keep a height.
  const pad = Math.min(2 * nodePadding, 2 / Math.max(1, ...stacks.map((s) => s.length)))
  const ky = Math.min(...stacks.map((s) => (2 - pad * (s.length - 1)) / sum(s)))
  const mean = (node: SankeyNode) =>
    node.incoming.reduce((s, hop) => s + hop.flow.value * middle(hop.source), 0) /
    total(node.incoming)

  for (const [c, stack] of stacks.entries()) {
    if (c > 0) stack.sort((a, b) => mean(a) - mean(b))
    let y = -(sum(stack) * ky + pad * (stack.length - 1)) / 2
    for (const node of stack) {
      node.y0 = y
      node.y1 = y + node.value * ky
      y = node.y1 + pad
    }
  }
  return ky
}

/**
 * Stacks the hops at every node from its top: the ones that leave it in the
 * order of their targets, the ones that arrive in the order of their sources,
 * so that the hops of a node do not cross.
 */
function stackHops(nodes: SankeyNode[], ky: number) {
  for (const node of nodes) {
    let y = node.y0
    for (const hop of node.outgoing.sort((a, b) => middle(a.target) - middle(b.target))) {
      hop.y0 = y + (hop.flow.value * ky) / 2
      y += hop.flow.value * ky
    }
    y = node.y0
    for (const hop of node.incoming.sort((a, b) => middle(a.source) - middle(b.source))) {
      hop.y1 = y + (hop.flow.value * ky) / 2
      y += hop.flow.value * ky
    }
  }
}

/**
 * The pieces of the chart: a box per node, a flat slice of its flow per
 * waypoint and `SEGMENTS` slices per hop. The columns stand from x = -1 to 1,
 * a node the share `nodeWidth` of the distance between two of them wide.
 */
function sankeyPieces(nodes: SankeyNode[], columns: number, ky: number, nodeWidth: number) {
  const step = 2 / Math.max(1, columns - 1)
  const x = (column: number) => -1 + column * step
  const half = (nodeWidth * step) / 2
  // How far a flow has come at `at`, from the side of its source to the side of its target, in percent.
  const share = (flow: Flow, at: number) => {
    const from = x(flow.source.column) + half
    return Math.round(((at - from) / (x(flow.target.column) - half - from)) * 100)
  }

  return nodes.flatMap((node): Piece[] => {
    const band = x(node.column)
    const own = node.flow
      ? { key: `way:${node.id}`, band, flow: node.flow, t: share(node.flow, band) }
      : { key: `node:${node.id}`, band, node, t: 0 }
    const depth = node.flow ? RIBBON * DEPTH : DEPTH
    const box = slab(band - half, middle(node), band + half, middle(node), node.y1 - node.y0, depth)
    return [
      Object.assign(box, own),
      ...node.outgoing.flatMap((hop) =>
        hopPieces(hop, band + half, x(node.column + 1) - half, ky, share)
      ),
    ]
  })
}

/**
 * The slices of a hop from `x0` to `x1`, along an S-curve that leaves and
 * arrives level, so that the hops of a flow join without a kink. Every hop
 * between the same two columns has the same slices.
 */
function hopPieces(
  hop: Hop,
  x0: number,
  x1: number,
  ky: number,
  share: (flow: Flow, at: number) => number
): Piece[] {
  const x = (k: number) => x0 + ((x1 - x0) * k) / SEGMENTS
  const y = (k: number) => {
    const t = k / SEGMENTS
    return hop.y0 + (hop.y1 - hop.y0) * t * t * (3 - 2 * t)
  }
  return Array.from({ length: SEGMENTS }, (_, k) => {
    const band = (x(k) + x(k + 1)) / 2
    return Object.assign(
      slab(x(k), y(k), x(k + 1), y(k + 1), hop.flow.value * ky, RIBBON * DEPTH),
      {
        key: `hop:${hop.flow.key}:${hop.source.column}:${k}`,
        band,
        flow: hop.flow,
        t: share(hop.flow, band),
      }
    )
  })
}

/** The corners of a slab from `x0` to `x1`, its middle at `y0` and `y1`, `height` high and `depth` deep, in the order of box(). */
function slab(x0: number, y0: number, x1: number, y1: number, height: number, depth: number) {
  return [depth / 2, -depth / 2].flatMap((z) => [
    { x: x0, y: y0 - height / 2, z },
    { x: x0, y: y0 + height / 2, z },
    { x: x1, y: y1 + height / 2, z },
    { x: x1, y: y1 - height / 2, z },
  ])
}

/**
 * The pieces in the order to paint them. The slabs of the columns and of the
 * slices lie between planes x = const, so they paint from the slab farthest
 * from the eye to the nearest, which is exact; within a slab, where the pieces
 * lie one above the other, by depth.
 */
function depthSort<P extends { band: number; centroid: Point3D }>(
  pieces: P[],
  camera: Camera3DInstance
) {
  const { x: vx } = camera.viewDirection()
  // The x of the eye: ±Infinity for an orthographic camera, NaN for one that looks along the planes.
  const eye = vx * camera.perspective()
  const far = (x: number) => (Number.isFinite(eye) ? Math.abs(x - eye) : -x * Math.sign(vx))
  // ponytail: two hops that cross between the same columns pass through each other, the upper
  // in front; a lane in z per source would part them if the order of stackColumns leaves many.
  return pieces.sort((a, b) => far(b.band) - far(a.band) || sort(a, b))
}

/**
 * The label of a node beside its `outer` face, pushed away from the other side,
 * so that it stays outside whichever way the camera turns.
 */
function nodeLabel(
  key: string,
  faces: CubeFace[],
  outer: "left" | "right",
  text: React.ReactNode
): Label3D {
  const side = (name: "left" | "right") => center(faces.find((face) => face.face === name)!)
  const at = side(outer)
  const away =
    Math.sign(at.x - side(outer === "left" ? "right" : "left").x) || (outer === "left" ? -1 : 1)
  return { key, at: { x: at.x + 8 * away, y: at.y }, text, anchor: away < 0 ? "end" : "start" }
}
