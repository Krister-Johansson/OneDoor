// A fake upstream MCP server for the web flows. It needs no credentials and
// has two tools. web may not import server code, so this does not reuse
// server/test/twins.
import { createServer } from "node:http"
import type { AddressInfo } from "node:net"
import { NodeStreamableHTTPServerTransport } from "@modelcontextprotocol/node"
import { McpServer } from "@modelcontextprotocol/server"

export interface Twin {
  // The MCP endpoint, for example http://127.0.0.1:51234/mcp.
  url: string
  close(): Promise<void>
}

export const OPEN_TWIN_TITLE = "E2E Twin"
export const OPEN_TWIN_TOOLS = ["echo", "reverse"]

// Listens on 127.0.0.1 on a free port and answers MCP over Streamable HTTP,
// statelessly: a new server per request.
export async function startOpenTwin(): Promise<Twin> {
  const server = createServer((req, res) => {
    if (!req.url?.startsWith("/mcp")) {
      res.writeHead(404).end()
      return
    }
    const mcp = new McpServer({
      name: "e2e-twin",
      title: OPEN_TWIN_TITLE,
      version: "1.0.0",
    })
    for (const name of OPEN_TWIN_TOOLS) {
      mcp.registerTool(
        name,
        { description: `The ${name} tool.` },
        async () => ({
          content: [{ type: "text", text: name }],
        }),
      )
    }
    const transport = new NodeStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    })
    res.on("close", () => {
      void transport.close()
      void mcp.close()
    })
    mcp
      .connect(transport)
      .then(() => transport.handleRequest(req, res))
      .catch(() => {
        if (!res.headersSent) res.writeHead(500)
        res.end()
      })
  })
  await new Promise<void>((resolve) =>
    server.listen(0, "127.0.0.1", () => resolve()),
  )
  const { port } = server.address() as AddressInfo
  return {
    url: `http://127.0.0.1:${port}/mcp`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.closeAllConnections()
        server.close((error) => (error ? reject(error) : resolve()))
      }),
  }
}
