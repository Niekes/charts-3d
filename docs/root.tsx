import { RootProvider } from "fumadocs-ui/provider/react-router"
import { isRouteErrorResponse, Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router"

import NotFound from "./routes/not-found"
import type { Route } from "./+types/root"
import "./app.css"

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body className="flex min-h-screen flex-col">
        <RootProvider search={{ options: { type: "static", api: "/charts-3d/api/search" } }}>
          {children}
        </RootProvider>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  )
}

export default function App() {
  return <Outlet />
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  if (isRouteErrorResponse(error) && error.status === 404) return <NotFound />
  return (
    <main className="mx-auto w-full max-w-[1400px] p-4 pt-16">
      <h1>Error</h1>
      <p>{error instanceof Error ? error.message : "An unexpected error occurred."}</p>
    </main>
  )
}
