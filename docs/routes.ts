import { globSync } from "node:fs"
import { index, route, type RouteConfig } from "@react-router/dev/routes"
import { createGetUrl, getSlugs } from "fumadocs-core/source"

const getUrl = createGetUrl("/docs")

// The router matches no suffix after a splat, so the Markdown copy of every page is a route of its own.
const markdown = globSync("**/*.mdx", { cwd: "docs/content" }).map((file) => {
  const url = getUrl(getSlugs(file))
  return route(`${url.slice(1)}.md`, "routes/markdown.ts", { id: `markdown${url}` })
})

export default [
  index("routes/home.tsx"),
  route("docs/*", "routes/docs.tsx"),
  ...markdown,
  route("llms.txt", "routes/llms.ts"),
  route("llms-full.txt", "routes/llms-full.ts"),
  route("api/search", "routes/search.ts"),
  route("*", "routes/not-found.tsx"),
] satisfies RouteConfig
