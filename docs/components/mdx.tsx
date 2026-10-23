import { Tab, Tabs } from "fumadocs-ui/components/tabs"
import { TypeTable } from "fumadocs-ui/components/type-table"
import defaultMdxComponents from "fumadocs-ui/mdx"
import type { MDXComponents } from "mdx/types"

export function useMDXComponents(components?: MDXComponents) {
  return { ...defaultMdxComponents, Tab, Tabs, TypeTable, ...components } satisfies MDXComponents
}
