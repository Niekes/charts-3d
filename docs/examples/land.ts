import { feature } from "topojson-client"
import type { GeometryCollection, Topology } from "topojson-specification"
import raw from "world-atlas/countries-110m.json?raw"

// The land of world-atlas at 110m, its `countries`, from TopoJSON to the
// GeoJSON the globe takes: the land of every globe demo. Read as text and
// parsed, because a JSON import types the fields as plain strings and arrays
// where the topology type wants their literals and tuples.
const world = JSON.parse(raw) as Topology
export const land = feature(world, world.objects.countries as GeometryCollection)
