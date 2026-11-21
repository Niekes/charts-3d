import { loader } from "fumadocs-core/source"
import { defineDocs } from "fumadocs-mdx/macro"

export const docs = defineDocs({
  dir: "docs/content",
  docs: {
    async: true,
    // The processed Markdown feeds the .md copy of every page and llms-full.txt.
    postprocess: {
      includeProcessedMarkdown: {
        headingIds: false,
        // An example keeps its code and drops its live preview; the other tabs keep their labels.
        filterElement(node) {
          if (node.type !== "mdxJsxFlowElement") return true
          const value = node.attributes.find((a) => "name" in a && a.name === "value")?.value
          if (node.name?.endsWith("Demo") || value === "Preview") return false
          return node.name === "Tabs" || value === "Code" ? "children-only" : true
        },
      },
    },
  },
})

export const source = loader({ source: docs.toFumadocsSource(), baseUrl: "/docs" })
