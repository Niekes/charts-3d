import type { ComponentProps } from "react"
import { Tab, Tabs } from "fumadocs-ui/components/tabs"
import { TypeTable } from "fumadocs-ui/components/type-table"
import defaultMdxComponents from "fumadocs-ui/mdx"
import type { MDXComponents } from "mdx/types"

// The preview shows a chart as it looks in a project, without the typography of the page.
function PreviewTab(props: ComponentProps<typeof Tab>) {
  return <Tab className={props.value === "Preview" ? "not-prose" : undefined} {...props} />
}

export function useMDXComponents(components?: MDXComponents) {
  return {
    ...defaultMdxComponents,
    Tab: PreviewTab,
    Tabs,
    TypeTable,
    ...components,
  } satisfies MDXComponents
}
