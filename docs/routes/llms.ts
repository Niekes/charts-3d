import { absolute, llmsText, text } from "@/docs/lib/llms"

// llms.txt links every page to its Markdown copy.
export function loader() {
  return text(absolute(llmsText.index(), ".md"))
}
