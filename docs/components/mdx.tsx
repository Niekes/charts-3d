import type { ComponentProps } from "react"
import { Card, Cards } from "fumadocs-ui/components/card"
import { Tab, Tabs } from "fumadocs-ui/components/tabs"
import { TypeTable } from "fumadocs-ui/components/type-table"
import { useTreeContext, useTreePath } from "fumadocs-ui/contexts/tree"
import defaultMdxComponents from "fumadocs-ui/mdx"
import type { MDXComponents } from "mdx/types"

// The preview shows a chart as it looks in a project, without the typography of the page.
function PreviewTab(props: ComponentProps<typeof Tab>) {
  return <Tab className={props.value === "Preview" ? "not-prose" : undefined} {...props} />
}

// The overview of a tab: a card per other page in it, so a new chart shows up by itself.
function PageCards() {
  const { root } = useTreeContext()
  const here = useTreePath().at(-1)
  const current = here?.type === "page" ? here.url : undefined

  return (
    <Cards>
      {root.children.map(
        (node) =>
          node.type === "page" &&
          node.url !== current && (
            <Card key={node.url} title={node.name} description={node.description} href={node.url} />
          )
      )}
    </Cards>
  )
}

export function useMDXComponents(components?: MDXComponents) {
  return {
    ...defaultMdxComponents,
    PageCards,
    Tab: PreviewTab,
    Tabs,
    TypeTable,
    ...components,
  } satisfies MDXComponents
}
