import { absolute, llmsText, text } from "@/docs/lib/llms"

export async function loader() {
  return text(absolute(await llmsText.full()))
}
