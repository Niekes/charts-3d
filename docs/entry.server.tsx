import { renderToReadableStream } from "react-dom/server"
import { ServerRouter, type EntryContext } from "react-router"

// The default web entry of React Router without its bot detection: the docs
// are only rendered at build time, and a prerendered page always waits for
// all of its content.
export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  routerContext: EntryContext
) {
  const body = await renderToReadableStream(
    <ServerRouter context={routerContext} url={request.url} />,
    {
      onError(error: unknown) {
        responseStatusCode = 500
        console.error(error)
      },
    }
  )
  await body.allReady

  responseHeaders.set("Content-Type", "text/html")
  return new Response(body, { headers: responseHeaders, status: responseStatusCode })
}
