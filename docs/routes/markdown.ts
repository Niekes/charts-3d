import { absolute, llmsText, text } from "@/docs/lib/llms"
import { source } from "@/docs/lib/source"
import type { Route } from "./+types/markdown"

// /docs.md is the introduction, /docs/<slugs>.md every other page.
export async function loader({ request }: Route.LoaderArgs) {
  const [, rest = ""] = new URL(request.url).pathname.match(/\/docs(\/.*)?\.md$/) ?? []
  const page = source.getPage(rest.split("/").filter(Boolean))
  if (!page) throw new Response("Not found", { status: 404 })

  return text(absolute(await llmsText.page(page)), "text/markdown")
}
