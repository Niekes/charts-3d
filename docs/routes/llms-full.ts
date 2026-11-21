import { absolute, llmsText } from "@/docs/lib/llms"

export async function loader() {
  return new Response(absolute(await llmsText.full()))
}
