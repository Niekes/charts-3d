import type { Config } from "@react-router/dev/config"
import { glob } from "node:fs/promises"
import { createGetUrl, getSlugs } from "fumadocs-core/source"

const getUrl = createGetUrl("/docs")

// GitHub Pages serves files, so every page is rendered at build time.
export default {
  appDirectory: "docs",
  basename: "/charts-3d/",
  ssr: false,
  async prerender({ getStaticPaths }) {
    const paths = [...getStaticPaths(), "/api/search"]
    for await (const entry of glob("**/*.mdx", { cwd: "docs/content" })) {
      paths.push(getUrl(getSlugs(entry)))
    }
    return paths
  },
} satisfies Config
