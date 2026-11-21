import { absolute, llmsText, markdownSource } from "@/docs/lib/llms"
import type { Route } from "./+types/markdown"

// /docs.md is the introduction, /docs/<slugs>.md every other page.
export async function loader({ url }: Route.LoaderArgs) {
  const match = url.pathname.match(/\/docs(\/.*)?\.md$/)
  const page = match && markdownSource.getPage((match[1] ?? "").split("/").filter(Boolean))
  if (!page) throw new Response("Not found", { status: 404 })

  return new Response(absolute(await llmsText.page(page)))
}
