import { HomeLayout } from "fumadocs-ui/layouts/home"
import { DefaultNotFound } from "fumadocs-ui/layouts/home/not-found"

import { baseOptions } from "@/docs/lib/layout"

export function meta() {
  return [{ title: "Not Found" }]
}

export default function NotFound() {
  return (
    <HomeLayout {...baseOptions()}>
      <DefaultNotFound />
    </HomeLayout>
  )
}
