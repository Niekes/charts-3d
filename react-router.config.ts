import type { Config } from "@react-router/dev/config"

import { pageUrls } from "./docs/lib/pages"

// GitHub Pages serves files, so every page is rendered at build time.
export default {
  appDirectory: "docs",
  basename: "/charts-3d/",
  ssr: false,
  prerender: ({ getStaticPaths }) => [...getStaticPaths(), "/api/search", ...pageUrls],
} satisfies Config
