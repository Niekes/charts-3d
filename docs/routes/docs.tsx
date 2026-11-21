import { use } from "react"
import { useFumadocsLoader } from "fumadocs-core/source/client"
import { DocsLayout } from "fumadocs-ui/layouts/notebook"
import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
  EditOnGitHub,
  MarkdownCopyButton,
  ViewOptionsPopover,
} from "fumadocs-ui/layouts/notebook/page"

import { useMDXComponents } from "@/docs/components/mdx"
import { baseOptions, githubUrl } from "@/docs/lib/layout"
import { docs, source } from "@/docs/lib/source"
import type { Route } from "./+types/docs"

export async function loader({ params }: Route.LoaderArgs) {
  const page = source.getPage(params["*"].split("/").filter(Boolean))
  if (!page) throw new Response("Not found", { status: 404 })

  return {
    path: page.path,
    url: page.url,
    pageTree: await source.serializePageTree(source.getPageTree()),
  }
}

function Content({ path, url }: { path: string; url: string }) {
  const page = docs.getPage(path)
  if (!page) throw new Error(`unknown page: ${path}`)

  const { toc } = use(page.load())
  const Mdx = page.body
  // The Markdown of every page is prerendered beside it, see routes.ts.
  const markdownUrl = `${url}.md`
  const sourceUrl = `${githubUrl}/blob/master/docs/content/${path}`

  return (
    <DocsPage toc={toc}>
      <title>{`${page.title} · charts-3d`}</title>
      <meta name="description" content={page.description} />
      <DocsTitle>{page.title}</DocsTitle>
      <DocsDescription className="mb-0">{page.description}</DocsDescription>
      <div className="flex flex-row items-center gap-2 border-b pb-6">
        <MarkdownCopyButton markdownUrl={markdownUrl} />
        <ViewOptionsPopover markdownUrl={markdownUrl} githubUrl={sourceUrl} />
      </div>
      <DocsBody>
        <Mdx components={useMDXComponents()} />
      </DocsBody>
      <EditOnGitHub href={sourceUrl} />
    </DocsPage>
  )
}

export default function Page({ loaderData }: Route.ComponentProps) {
  const { path, url, pageTree } = useFumadocsLoader(loaderData)
  const base = baseOptions()

  return (
    <DocsLayout {...base} nav={{ ...base.nav, mode: "top" }} tabMode="navbar" tree={pageTree}>
      <Content path={path} url={url} />
    </DocsLayout>
  )
}
