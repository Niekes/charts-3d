import { llms, loader } from "fumadocs-core/source"
import { renderPlaceholder } from "fumadocs-core/mdx-plugins/remark-llms.runtime"
import { getPageTreePeers } from "fumadocs-core/page-tree"
import { defineDocs } from "fumadocs-mdx/macro"

// The pages again, with their processed Markdown: a collection of its own, read
// only at build time, keeps that Markdown out of the scripts of the pages.
const markdownDocs = defineDocs({
  dir: "docs/content",
  docs: {
    postprocess: {
      includeProcessedMarkdown: {
        headingIds: false,
        mdxAsPlaceholder: ["PageCards"],
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

export const markdownSource = loader({ source: markdownDocs.toFumadocsSource(), baseUrl: "/docs" })

const site = "https://niekes.github.io/charts-3d"

export const llmsText = llms(markdownSource, {
  renderPage: async (page) => {
    const body = await renderPlaceholder(await page.data.getText("processed"), {
      // The overview lists the other pages of its tab, as its cards do.
      PageCards: () =>
        getPageTreePeers(markdownSource.getPageTree(), page.url)
          .map((peer) => `- [${String(peer.name)}](${peer.url}): ${String(peer.description)}`)
          .join("\n"),
    })
    return `# ${page.data.title}\n\n> ${page.data.description}\n\n${body}`
  },
})

// The pages link from the root of the site, which GitHub Pages serves under /charts-3d.
export function absolute(markdown: string, suffix = "") {
  return markdown.replace(/(\]\(|href=")\/docs([^)#"]*)/g, `$1${site}/docs$2${suffix}`)
}
