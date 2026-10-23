import { fileURLToPath } from "node:url"
import { reactRouter } from "@react-router/dev/vite"
import tailwindcss from "@tailwindcss/vite"
import { fumadocsMdx } from "fumadocs-mdx/vite"
import { remarkAutoTypeTable } from "fumadocs-typescript"
import { defineConfig } from "vite-plus"

const ignorePatterns = ["build/**", "coverage/**", "public/r/**", ".react-router/**", ".source/**"]

export default defineConfig({
  // GitHub Pages serves the project under its name, the router knows it as its basename.
  base: "/charts-3d/",
  // The docs plugins stay out of the test run, which renders the registry on its own.
  plugins: process.env.VITEST
    ? []
    : [
        // The props tables are generated from the types at build time.
        fumadocsMdx({ globalOptions: { mdxOptions: { remarkPlugins: [remarkAutoTypeTable] } } }),
        tailwindcss(),
        reactRouter(),
      ],
  resolve: {
    alias: [
      // The examples import the charts the way a project that installed them does.
      {
        find: "@/components/ui",
        replacement: fileURLToPath(new URL("registry/new-york/ui", import.meta.url)),
      },
      { find: "@", replacement: fileURLToPath(new URL(".", import.meta.url)) },
    ],
  },

  // The style of shadcn/ui, because the registry files land in shadcn projects.
  fmt: {
    semi: false,
    singleQuote: false,
    printWidth: 100,
    trailingComma: "es5",
    tabWidth: 2,
    ignorePatterns,
  },
  lint: {
    ignorePatterns,
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    rules: { "vite-plus/prefer-vite-plus-imports": "error" },
    options: { typeAware: true, typeCheck: true },
  },

  test: {
    environment: "node",
    include: ["tests/**/*.test.tsx"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "json-summary", "html"],
      include: ["registry/**/*.tsx"],
    },
  },
})
