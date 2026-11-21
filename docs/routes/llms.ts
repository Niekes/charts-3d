import { absolute, llmsText } from "@/docs/lib/llms"

// llms.txt links every page to its Markdown copy.
export function loader() {
  return new Response(absolute(llmsText.index(), ".md"))
}
