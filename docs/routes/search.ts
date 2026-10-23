import { createFromSource } from "fumadocs-core/search/server"

import { source } from "@/docs/lib/source"

const server = createFromSource(source, { language: "english" })

// Prerendered into a file: the search runs in the browser on the exported index.
export async function loader() {
  return server.staticGET()
}
