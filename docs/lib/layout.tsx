import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared"

export const githubUrl = "https://github.com/niekes/charts-3d"

export function baseOptions(): BaseLayoutProps {
  return {
    nav: { title: "charts-3d" },
    githubUrl,
    links: [{ text: "Sponsor", url: "https://github.com/sponsors/niekes", external: true }],
  }
}
