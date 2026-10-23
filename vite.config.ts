import { fileURLToPath } from "node:url"
import { reactRouter } from "@react-router/dev/vite"
import tailwindcss from "@tailwindcss/vite"
import { fumadocsMdx } from "fumadocs-mdx/vite"
import { remarkAutoTypeTable } from "fumadocs-typescript"
import { defineConfig } from "vite-plus"

// Generated files: the builds, the coverage, the registry JSON, the React Router types and the badges.
const ignorePatterns = [
  "build/**",
  "coverage/**",
  "public/r/**",
  ".react-router/**",
  ".source/**",
  ".github/badges/**",
  "dist/**",
]

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

  // The npm package, `@niekes/charts-3d`, from the same files as the registry.
  pack: {
    entry: ["index.ts"],
    format: ["esm"],
    outDir: "dist",
    platform: "neutral",
    sourcemap: true,
    dts: true,
    // A bundler drops the directive of a module, so the package gets it back
    // on top: the components use hooks, and Next.js has to load them on the client.
    banner: '"use client"',
    inputOptions: {
      // The banner puts the directive back, so the warning that it is dropped is noise.
      onLog(level, log, handler) {
        if (log.code !== "MODULE_LEVEL_DIRECTIVE") handler(level, log)
      },
    },
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
    publint: true,
  },

  test: {
    environment: "node",
    include: ["tests/**/*.test.tsx"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "json-summary", "html"],
      include: ["registry/**/*.tsx"],
      // The registry is the code that lands in other projects: `npm run coverage` fails below this.
      thresholds: { statements: 98, branches: 98, functions: 98, lines: 98 },
    },
  },
})
