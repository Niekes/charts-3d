import { llms } from "fumadocs-core/source"

import { source } from "@/docs/lib/source"

const site = "https://niekes.github.io/charts-3d"

export const llmsText = llms(source, {
  renderPage: async (page) =>
    `# ${page.data.title}\n\n> ${page.data.description}\n\n${await page.data.getText("processed")}`,
})

// The pages link from the root of the site, which GitHub Pages serves under /charts-3d.
export function absolute(markdown: string, suffix = "") {
  return markdown.replace(/\]\(\/docs([^)#]*)/g, `](${site}/docs$1${suffix}`)
}

export function text(body: string, type = "text/plain") {
  return new Response(body, { headers: { "Content-Type": `${type}; charset=utf-8` } })
}
