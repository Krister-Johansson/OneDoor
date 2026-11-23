// A fake upstream MCP server protected by OAuth with dynamic client
// registration, for the web flows (T21). It runs the whole flow: /register,
// /authorize (redirects at once with a code, as if the user agreed),
// /token for authorization_code with PKCE S256 and for refresh_token, and
// /mcp, which accepts the access tokens it issued. web may not import server
// code, so this does not reuse server/test/twins.
import { createHash } from "node:crypto"
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http"
import type { AddressInfo } from "node:net"
import { NodeStreamableHTTPServerTransport } from "@modelcontextprotocol/node"
import { McpServer } from "@modelcontextprotocol/server"
import type { Twin } from "./open-twin"

export const OAUTH_TWIN_TOOLS = ["alpha", "beta"]

interface IssuedCode {
  clientId: string
  redirectUri: string
  challenge: string
}

export async function startOAuthTwin(): Promise<Twin> {
  const clients = new Map<string, string[]>()
  const codes = new Map<string, IssuedCode>()
  const accessTokens = new Set<string>()
  const refreshTokens = new Map<string, string>()
  let counter = 0
  const next = (kind: string) => `${kind}-${++counter}`
  let origin = ""

  const json = (res: ServerResponse, status: number, body: unknown) => {
    res.writeHead(status, { "content-type": "application/json" })
    res.end(JSON.stringify(body))
  }
  const readBody = async (req: IncomingMessage) => {
    const chunks: Buffer[] = []
    for await (const chunk of req) chunks.push(chunk as Buffer)
    return Buffer.concat(chunks).toString("utf8")
  }
  const issueTokens = (res: ServerResponse, clientId: string) => {
    const accessToken = next("access")
    const refreshToken = next("refresh")
    accessTokens.add(accessToken)
    refreshTokens.set(refreshToken, clientId)
    json(res, 200, {
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: 3600,
      refresh_token: refreshToken,
    })
  }

  const handle = async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url ?? "/", origin)
    if (url.pathname.startsWith("/.well-known/oauth-protected-resource")) {
      return json(res, 200, {
        resource: `${origin}/mcp`,
        authorization_servers: [origin],
        bearer_methods_supported: ["header"],
      })
    }
    if (url.pathname === "/.well-known/oauth-authorization-server") {
      return json(res, 200, {
        issuer: origin,
        authorization_endpoint: `${origin}/authorize`,
        token_endpoint: `${origin}/token`,
        registration_endpoint: `${origin}/register`,
        response_types_supported: ["code"],
        grant_types_supported: ["authorization_code", "refresh_token"],
        code_challenge_methods_supported: ["S256"],
        token_endpoint_auth_methods_supported: ["none"],
      })
    }
    if (url.pathname === "/register" && req.method === "POST") {
      const metadata = JSON.parse(await readBody(req)) as {
        redirect_uris?: string[]
      }
      const clientId = next("client")
      clients.set(clientId, metadata.redirect_uris ?? [])
      return json(res, 201, {
        ...metadata,
        client_id: clientId,
        token_endpoint_auth_method: "none",
      })
    }
    if (url.pathname === "/authorize") {
      const clientId = url.searchParams.get("client_id") ?? ""
      const redirectUri = url.searchParams.get("redirect_uri") ?? ""
      const challenge = url.searchParams.get("code_challenge") ?? ""
      if (!clients.get(clientId)?.includes(redirectUri) || challenge === "") {
        return json(res, 400, { error: "invalid_request" })
      }
      const code = next("code")
      codes.set(code, { clientId, redirectUri, challenge })
      const target = new URL(redirectUri)
      target.searchParams.set("code", code)
      const state = url.searchParams.get("state")
      if (state !== null) target.searchParams.set("state", state)
      target.searchParams.set("iss", origin)
      res.writeHead(302, { location: target.toString() })
      res.end()
      return
    }
    if (url.pathname === "/token" && req.method === "POST") {
      const form = new URLSearchParams(await readBody(req))
      const clientId = form.get("client_id") ?? ""
      if (form.get("grant_type") === "authorization_code") {
        const issued = codes.get(form.get("code") ?? "")
        codes.delete(form.get("code") ?? "")
        const challenge = createHash("sha256")
          .update(form.get("code_verifier") ?? "")
          .digest("base64url")
        if (
          !issued ||
          issued.clientId !== clientId ||
          issued.redirectUri !== form.get("redirect_uri") ||
          issued.challenge !== challenge
        ) {
          return json(res, 400, { error: "invalid_grant" })
        }
        return issueTokens(res, clientId)
      }
      if (form.get("grant_type") === "refresh_token") {
        const refreshToken = form.get("refresh_token") ?? ""
        if (refreshTokens.get(refreshToken) !== clientId) {
          return json(res, 400, { error: "invalid_grant" })
        }
        refreshTokens.delete(refreshToken)
        return issueTokens(res, clientId)
      }
      return json(res, 400, { error: "unsupported_grant_type" })
    }
    if (url.pathname.startsWith("/mcp")) {
      const token = req.headers.authorization?.replace(/^Bearer /, "")
      if (!token || !accessTokens.has(token)) {
        res.writeHead(401, {
          "www-authenticate": `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource/mcp"`,
        })
        res.end()
        return
      }
      const mcp = new McpServer({ name: "e2e-oauth-twin", version: "1.0.0" })
      for (const name of OAUTH_TWIN_TOOLS) {
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
      await mcp.connect(transport)
      await transport.handleRequest(req, res)
      return
    }
    res.writeHead(404).end()
  }

  const server = createServer((req, res) => {
    handle(req, res).catch(() => {
      if (!res.headersSent) res.writeHead(500)
      res.end()
    })
  })
  await new Promise<void>((resolve) =>
    server.listen(0, "127.0.0.1", () => resolve()),
  )
  const { port } = server.address() as AddressInfo
  origin = `http://127.0.0.1:${port}`
  return {
    url: `${origin}/mcp`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.closeAllConnections()
        server.close((error) => (error ? reject(error) : resolve()))
      }),
  }
}
