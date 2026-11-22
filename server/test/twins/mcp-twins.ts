// Fake upstream MCP servers for tests. Human-owned (server/AGENTS.md); first
// written by an agent for T11 with the owner's permission.
//
// Every twin listens on 127.0.0.1 on a free port and returns its URL and a
// close function. Tests never reach the real network.
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http';
import type { AddressInfo } from 'node:net';
import { NodeStreamableHTTPServerTransport } from '@modelcontextprotocol/node';
import { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';

export interface Twin {
  // The MCP endpoint, for example http://127.0.0.1:51234/mcp.
  url: string;
  // The origin, for example http://127.0.0.1:51234.
  origin: string;
  close(): Promise<void>;
}

type Handler = (
  req: IncomingMessage,
  res: ServerResponse,
  origin: string,
) => void | Promise<void>;

async function listen(handler: Handler): Promise<Twin> {
  let origin = '';
  const server = createServer((req, res) => {
    Promise.resolve(handler(req, res, origin)).catch(() => {
      if (!res.headersSent) res.writeHead(500);
      res.end();
    });
  });
  await new Promise<void>((resolve) =>
    server.listen(0, '127.0.0.1', () => resolve()),
  );
  const { port } = server.address() as AddressInfo;
  origin = `http://127.0.0.1:${port}`;
  return {
    url: `${origin}/mcp`,
    origin,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.closeAllConnections();
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}

interface McpTwinOptions {
  name: string;
  title?: string;
  description?: string;
  // Icon URLs the server lists in its serverInfo.
  iconUrls?: string[];
  toolNames: string[];
}

// Answers MCP over Streamable HTTP, statelessly: a new server per request.
async function serveMcp(
  req: IncomingMessage,
  res: ServerResponse,
  options: McpTwinOptions,
): Promise<void> {
  const server = new McpServer({
    name: options.name,
    title: options.title,
    description: options.description,
    icons: options.iconUrls?.map((src) => ({ src })),
    version: '1.2.3',
  });
  for (const toolName of options.toolNames) {
    server.registerTool(
      toolName,
      {
        description: `The ${toolName} tool of ${options.name}.`,
        inputSchema: z.object({ text: z.string() }),
      },
      async ({ text }) => ({ content: [{ type: 'text', text }] }),
    );
  }
  const transport = new NodeStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });
  res.on('close', () => {
    void transport.close();
    void server.close();
  });
  await server.connect(transport);
  await transport.handleRequest(req, res);
}

function notFound(res: ServerResponse): void {
  res.writeHead(404, { 'content-type': 'text/plain' });
  res.end('Not found');
}

// An MCP server that needs no credentials.
export function startOpenTwin(): Promise<Twin> {
  return listen(async (req, res) => {
    if (!req.url?.startsWith('/mcp')) return notFound(res);
    await serveMcp(req, res, {
      name: 'open-twin',
      title: 'Open Twin',
      description: 'A fake MCP server without authentication.',
      toolNames: ['echo', 'reverse'],
    });
  });
}

// An MCP server that needs `<headerName>: <expectedValue>` and answers 401
// otherwise. It has six tools, so a check can show the first five.
export function startApiKeyTwin(
  headerName = 'authorization',
  expectedValue = 'Bearer twin-key',
): Promise<Twin> {
  return listen(async (req, res) => {
    if (!req.url?.startsWith('/mcp')) return notFound(res);
    if (req.headers[headerName.toLowerCase()] !== expectedValue) {
      res.writeHead(401, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'invalid_token' }));
      return;
    }
    await serveMcp(req, res, {
      name: 'api-key-twin',
      title: 'API Key Twin',
      toolNames: ['one', 'two', 'three', 'four', 'five', 'six'],
    });
  });
}

// An MCP server protected by OAuth that offers dynamic client registration:
// it answers 401 with the protected resource metadata URL, and serves that
// metadata and its authorization server metadata.
export function startOAuthTwin(): Promise<Twin> {
  return listen((req, res, origin) => {
    const json = (body: unknown) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(body));
    };
    if (req.url?.startsWith('/.well-known/oauth-protected-resource')) {
      return json({
        resource: `${origin}/mcp`,
        authorization_servers: [origin],
        bearer_methods_supported: ['header'],
      });
    }
    if (req.url === '/.well-known/oauth-authorization-server') {
      return json({
        issuer: origin,
        authorization_endpoint: `${origin}/authorize`,
        token_endpoint: `${origin}/token`,
        registration_endpoint: `${origin}/register`,
        response_types_supported: ['code'],
        grant_types_supported: ['authorization_code', 'refresh_token'],
        code_challenge_methods_supported: ['S256'],
        token_endpoint_auth_methods_supported: ['none'],
      });
    }
    if (req.url?.startsWith('/mcp')) {
      res.writeHead(401, {
        'www-authenticate': `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource/mcp"`,
      });
      res.end();
      return;
    }
    notFound(res);
  });
}

// Redirects every request to `location` with the given status. `location`
// may be built from the twin's own origin, for example to redirect in a loop.
export function startRedirectTwin(
  location: string | ((origin: string) => string),
  status = 307,
): Promise<Twin> {
  return listen((_req, res, origin) => {
    res.writeHead(status, {
      location: typeof location === 'string' ? location : location(origin),
    });
    res.end();
  });
}

// Answers every request with a body of `bytes` bytes.
export function startLargeResponseTwin(bytes: number): Promise<Twin> {
  return listen((_req, res) => {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(`"${'a'.repeat(Math.max(0, bytes - 2))}"`);
  });
}

// Answers with plain HTML: a web server, not an MCP server.
export function startHtmlTwin(): Promise<Twin> {
  return listen((_req, res) => {
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end('<html><body>Hello</body></html>');
  });
}

// A 1x1 PNG.
export const TWIN_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

// The start of an ICO file: reserved 0, type 1, one image.
export const TWIN_ICO = Buffer.from([
  0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x10, 0x10, 0x00, 0x00,
]);

export interface IconTwinOptions {
  // What the icon in serverInfo (/icon.png) serves: a PNG, HTML labelled as
  // image/png, a 300 KB PNG, or no icon in serverInfo at all.
  mcpIcon: 'png' | 'html' | 'oversized' | 'none';
  // What /favicon.ico serves.
  favicon: 'ico' | 'none';
}

// An MCP server without authentication whose icons can be good or bad, for
// the icon rules (REQ-CONN-070, REQ-CONN-071).
export function startIconTwin(options: IconTwinOptions): Promise<Twin> {
  return listen(async (req, res, origin) => {
    if (req.url === '/icon.png' && options.mcpIcon !== 'none') {
      res.writeHead(200, { 'content-type': 'image/png' });
      if (options.mcpIcon === 'png') return void res.end(TWIN_PNG);
      if (options.mcpIcon === 'html') {
        return void res.end(
          '<!doctype html><html><body>Not an image</body></html>',
        );
      }
      const big = Buffer.alloc(300 * 1024);
      TWIN_PNG.copy(big);
      return void res.end(big);
    }
    if (req.url === '/favicon.ico' && options.favicon === 'ico') {
      res.writeHead(200, { 'content-type': 'image/x-icon' });
      return void res.end(TWIN_ICO);
    }
    if (req.url?.startsWith('/mcp')) {
      await serveMcp(req, res, {
        name: 'icon-twin',
        title: 'Icon Twin',
        iconUrls: options.mcpIcon === 'none' ? [] : [`${origin}/icon.png`],
        toolNames: ['echo'],
      });
      return;
    }
    notFound(res);
  });
}
