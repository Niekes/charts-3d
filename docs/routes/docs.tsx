import { use } from "react"
import { useFumadocsLoader } from "fumadocs-core/source/client"
import { DocsLayout } from "fumadocs-ui/layouts/docs"
import { DocsBody, DocsDescription, DocsPage, DocsTitle } from "fumadocs-ui/layouts/docs/page"

import { useMDXComponents } from "@/docs/components/mdx"
import { baseOptions } from "@/docs/lib/layout"
import { docs, source } from "@/docs/lib/source"
import type { Route } from "./+types/docs"

export async function loader({ params }: Route.LoaderArgs) {
  const page = source.getPage(params["*"].split("/").filter(Boolean))
  if (!page) throw new Response("Not found", { status: 404 })

  return { path: page.path, pageTree: await source.serializePageTree(source.getPageTree()) }
}

function Content({ path }: { path: string }) {
  const page = docs.getPage(path)
  if (!page) throw new Error(`unknown page: ${path}`)

  const { toc } = use(page.load())
  const Mdx = page.body

  return (
    <DocsPage toc={toc}>
      <title>{`${page.title} · charts-3d`}</title>
      <meta name="description" content={page.description} />
      <DocsTitle>{page.title}</DocsTitle>
      <DocsDescription>{page.description}</DocsDescription>
      <DocsBody>
        <Mdx components={useMDXComponents()} />
      </DocsBody>
    </DocsPage>
  )
}

export default function Page({ loaderData }: Route.ComponentProps) {
  const { path, pageTree } = useFumadocsLoader(loaderData)

  return (
    <DocsLayout {...baseOptions()} tree={pageTree}>
      <Content path={path} />
    </DocsLayout>
  )
}
