import { globSync } from "node:fs"
import { createGetUrl, getSlugs } from "fumadocs-core/source"

const getUrl = createGetUrl("/docs")

// The address of every page, for the routes and the prerender.
export const pageUrls = globSync("**/*.mdx", { cwd: "docs/content" }).map((file) =>
  getUrl(getSlugs(file))
)
