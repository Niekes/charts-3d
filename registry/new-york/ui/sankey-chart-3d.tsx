"use client"

import * as React from "react"
import { cubes3D, sort, type Camera3DInstance, type Cube, type CubeFace, type Point3D } from "d3-3d"

import {
  Labels3D,
  Marks3D,
  center,
  cubeMarks,
  useChart3D,
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
// The depth between the middles of two lanes, where flows that cross pass one another.
const SPACING = 0.36

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

/**
 * The part of a flow from one column to the next, from the middle of its slot
 * at the source, `y0`, to the one at the target, `y1`. A hop that crosses
 * others belongs to their `knot` and moves to the depth `z` while it passes them.
 */
type Hop = {
  flow: Flow
  source: SankeyNode
  target: SankeyNode
  y0: number
  y1: number
  z: number
  knot?: Knot
}

/**
 * Hops of one gap that cross, directly or through one another. Their lanes
 * hold from the cross-section `from` to `to`, counted in slices, and `first`,
 * the topmost at the source, stands for the height of the knot.
 */
type Knot = { from: number; to: number; first: Hop }

/**
 * A part of the chart in the world: a node, or a slice of a flow that has come
 * the share `t` of its way there. `band` is the middle of the slab between two
 * planes x = const that the part lies in; `row`, `lane` and `level`, the height
 * of its knot, the depth of its lane and its own height, order it within the slab.
 */
type Piece = Point3D[] & {
  key: string
  band: number
  row: number
  lane: number
  level: number
  node?: SankeyNode
  flow?: Flow
  t: number
}

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
  const { nodes, columns, ky } = sankeyLayout(data, nodePadding)
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
            style(config, node).label,
            links(node)
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
 * The keys of the flows at a node. Its marks and its label carry them, so the
 * focus on the node lights its flows and the nodes at their other ends, and
 * the focus on a flow lights its two nodes.
 */
function links(node: SankeyNode) {
  return [...new Set([...node.incoming, ...node.outgoing].map((hop) => hop.flow.key))]
}

/**
 * The marks of a piece, each with its tooltip and its groups: the faces of a
 * node, or the faces of a slice of a flow, in the color it has turned to there.
 */
function pieceMarks(
  { key, faces, node, flow, t }: Cube<Point3D, Piece>,
  config: ChartConfig,
  format: (value: number) => React.ReactNode
) {
  const at = center(faces.find((face) => face.face === "top")!)
  if (node) {
    const { label, color } = style(config, node)
    const groups = links(node)
    return cubeMarks(key, faces, color, {
      at,
      items: [{ label, value: format(node.value), color }],
    }).map((mark) => ({ ...mark, groups }))
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
  return cubeMarks(key, sides, gradient, { at, items: [item] }).map((mark) => ({
    ...mark,
    groups: [flow!.key],
  }))
}

/** The nodes of `data`, waypoints included, stacked in their columns, and `ky`, the world units per value. */
function sankeyLayout(data: SankeyChart3DProps["data"], nodePadding: number) {
  const { nodes, flows, columns } = sankeyColumns(data)
  const all = sankeyHops(nodes, flows)
  const ky = stackColumns(all, columns, nodePadding)
  stackHops(all, ky)
  weaveHops(all, columns, ky)
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
      const hop = { flow, source, target, y0: 0, y1: 0, z: 0 }
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
 * Parts the hops that cross, gap by gap. The hops of a gap that cross, directly
 * or through one another, form a knot. The knots of a gap lie one above the
 * other across the whole gap; only the hops within a knot move apart in depth.
 */
function weaveHops(nodes: SankeyNode[], columns: number, ky: number) {
  for (let column = 0; column < columns - 1; column += 1) {
    const hops = nodes
      .filter((node) => node.column === column)
      .flatMap((node) => node.outgoing)
      .sort((a, b) => a.y0 - b.y0)
    const rank = new Map([...hops].sort((a, b) => a.y1 - b.y1).map((hop, i) => [hop, i]))
    // A knot closes where the hops that leave first are also the ones that arrive first.
    let start = 0
    let reach = 0
    hops.forEach((hop, i) => {
      reach = Math.max(reach, rank.get(hop)!)
      if (reach > i) return
      if (i > start) knotHops(hops.slice(start, i + 1), ky)
      start = i + 1
    })
  }
}

/**
 * The lanes of a knot. Every hop takes the lowest lane that no hop crossing it
 * holds, which needs the fewest, and the lightest lane goes to the front. The
 * hops hold their lanes over the slices where any two of them overlap, so
 * their depth is constant there, and leave the rest for the way in and out.
 */
function knotHops(hops: Hop[], ky: number) {
  const lanes: number[] = []
  // In the order of their sources, a hop crosses every earlier one that arrives below it.
  for (const [i, hop] of hops.entries()) {
    const taken = hops.slice(0, i).flatMap((above, j) => (above.y1 > hop.y1 ? [lanes[j]] : []))
    let lane = 0
    while (taken.includes(lane)) lane += 1
    lanes.push(lane)
  }
  const count = Math.max(...lanes) + 1
  const load = (lane: number) =>
    hops.reduce((sum, hop, i) => sum + (lanes[i] === lane ? hop.flow.value : 0), 0)
  const front = Array.from({ length: count }, (_, lane) => lane).sort((a, b) => load(a) - load(b))
  const slices = hops.flatMap((a, i) =>
    hops.slice(i + 1).flatMap((b) => (a.y1 > b.y1 ? overlaps(a, b, ky) : []))
  )
  const knot = { from: Math.min(...slices), to: Math.max(...slices) + 1, first: hops[0] }
  for (const [i, hop] of hops.entries()) {
    hop.z = ((count - 1) / 2 - front.indexOf(lanes[i])) * SPACING
    hop.knot = knot
  }
}

/**
 * The slices in which two hops, `a` and `b`, overlap in height. Along a slice
 * their distance runs straight from one cross-section to the next, so they
 * overlap in it if they are closer than half their thicknesses at one of its
 * ends, or pass each other within it.
 */
function overlaps(a: Hop, b: Hop, ky: number) {
  const apart = (k: number) => a.y0 - b.y0 + (a.y1 - b.y1 - (a.y0 - b.y0)) * ease(k / SEGMENTS)
  const near = ((a.flow.value + b.flow.value) * ky) / 2
  return Array.from({ length: SEGMENTS }, (_, k) => k).filter(
    (k) =>
      Math.abs(apart(k)) < near ||
      Math.abs(apart(k + 1)) < near ||
      Math.sign(apart(k)) !== Math.sign(apart(k + 1))
  )
}

/** The S-curve of a flow, from 0 at t = 0 to 1 at t = 1, level at both ends. */
function ease(t: number) {
  return t * t * (3 - 2 * t)
}

/**
 * How far a hop of `knot` has moved into its lane at the cross-section `k`:
 * not at all at a node, fully between the borders of the knot, and along the
 * S-curve in between. A knot that starts at a node starts there in its lanes.
 */
function bump(k: number, knot?: Knot) {
  if (!knot) return 0
  if (k < knot.from) return ease(k / knot.from)
  if (k > knot.to) return ease((SEGMENTS - k) / (SEGMENTS - knot.to))
  return 1
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
    const y = middle(node)
    const own = node.flow
      ? { key: `way:${node.id}`, band, flow: node.flow, t: share(node.flow, band) }
      : { key: `node:${node.id}`, band, node, t: 0 }
    const depth = node.flow ? RIBBON * DEPTH : DEPTH
    const box = slab(
      { x: band - half, y, z: 0 },
      { x: band + half, y, z: 0 },
      node.y1 - node.y0,
      depth
    )
    return [
      Object.assign(box, own, { row: y, lane: 0, level: y }),
      ...node.outgoing.flatMap((hop) =>
        hopPieces(hop, band + half, x(node.column + 1) - half, ky, share)
      ),
    ]
  })
}

/**
 * The slices of a hop from `x0` to `x1`, along an S-curve that leaves and
 * arrives level, so that the hops of a flow join without a kink. A hop of a
 * knot moves into its lane and back along the same curve. Every hop between
 * the same two columns has the same slices.
 */
function hopPieces(
  hop: Hop,
  x0: number,
  x1: number,
  ky: number,
  share: (flow: Flow, at: number) => number
): Piece[] {
  const at = (of: Hop, k: number) => ({
    x: x0 + ((x1 - x0) * k) / SEGMENTS,
    y: of.y0 + (of.y1 - of.y0) * ease(k / SEGMENTS),
    z: of.z * bump(k, of.knot),
  })
  const { knot } = hop
  return Array.from({ length: SEGMENTS }, (_, k) => {
    const [from, to] = [at(hop, k), at(hop, k + 1)]
    const first = knot ? [at(knot.first, k), at(knot.first, k + 1)] : [from, to]
    const band = (from.x + to.x) / 2
    return Object.assign(slab(from, to, hop.flow.value * ky, RIBBON * DEPTH), {
      key: `hop:${hop.flow.key}:${hop.source.column}:${k}`,
      band,
      flow: hop.flow,
      t: share(hop.flow, band),
      row: (first[0].y + first[1].y) / 2,
      // Between the borders of its knot a hop holds its lane, so there the lanes part the hops.
      lane: knot && k >= knot.from && k < knot.to ? hop.z : 0,
      level: (from.y + to.y) / 2,
    })
  })
}

/**
 * The corners of a slab from the cross-section around `from` to the one around
 * `to`, `height` high and `depth` deep, in the order of box(). The two are
 * equal rectangles, so the faces stay planar and the slab convex.
 */
function slab(from: Point3D, to: Point3D, height: number, depth: number) {
  return [depth / 2, -depth / 2].flatMap((dz) => [
    { x: from.x, y: from.y - height / 2, z: from.z + dz },
    { x: from.x, y: from.y + height / 2, z: from.z + dz },
    { x: to.x, y: to.y + height / 2, z: to.z + dz },
    { x: to.x, y: to.y - height / 2, z: to.z + dz },
  ])
}

/**
 * The pieces in the order to paint them, by the first plane that parts two of
 * them: the slabs of the columns and slices lie between planes x = const; the
 * knots of a slice, one above the other; the lanes of a knot, where its hops
 * hold them, one behind the other; and the hops of a lane, or of a knot
 * outside its borders, which do not overlap there, one above the other. Each
 * key paints the part farther from the eye first, so the order is exact for
 * every eye, and keys of numbers cannot form a cycle.
 */
function depthSort<
  P extends Pick<Piece, "band" | "row" | "lane" | "level"> & { centroid: Point3D },
>(pieces: P[], camera: Camera3DInstance) {
  const view = camera.viewDirection()
  const perspective = camera.perspective()
  // The distance from the eye along one axis: the eye sits at perspective · view, at infinity for
  // an orthographic camera, where NaN means it looks along the axis and the axis decides nothing.
  const far = (at: number, v: number) => {
    const eye = v * perspective
    return Number.isFinite(eye) ? Math.abs(at - eye) : -at * Math.sign(v)
  }
  return pieces.sort(
    (a, b) =>
      far(b.band, view.x) - far(a.band, view.x) ||
      far(b.row, view.y) - far(a.row, view.y) ||
      far(b.lane, view.z) - far(a.lane, view.z) ||
      far(b.level, view.y) - far(a.level, view.y) ||
      sort(a, b)
  )
}

/**
 * The label of a node beside its `outer` face, pushed away from the other side,
 * so that it stays outside whichever way the camera turns. It carries the
 * groups of the node, so it fades with the node.
 */
function nodeLabel(
  key: string,
  faces: CubeFace[],
  outer: "left" | "right",
  text: React.ReactNode,
  groups: string[]
): Label3D {
  const side = (name: "left" | "right") => center(faces.find((face) => face.face === name)!)
  const at = side(outer)
  const away =
    Math.sign(at.x - side(outer === "left" ? "right" : "left").x) || (outer === "left" ? -1 : 1)
  const anchor = away < 0 ? "end" : "start"
  return { key, at: { x: at.x + 8 * away, y: at.y }, text, anchor, groups }
}
