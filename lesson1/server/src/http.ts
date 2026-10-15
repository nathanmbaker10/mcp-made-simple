// Streamable HTTP entry point for the Lesson 1 greeting server.
// Local IDE use stays on stdio: `npm start` still runs src/index.ts.

import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import type { Request, Response } from "express";
import { readAuthToken, requireBearerToken, requirePathToken } from "./auth.js";
import { createGreetingServer } from "./createServer.js";

const token = readAuthToken();

function listenPort(): number {
  const raw = process.env.PORT ?? "3000";
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    console.error(`Invalid PORT: ${raw}`);
    process.exit(1);
  }
  return port;
}

// host: "0.0.0.0" skips the SDK's localhost-only host check. The listen()
// call below is what actually binds every interface so Render can connect.
// The public hostname is assigned at deploy time, so this lesson does not
// allow-list hosts. /mcp requires a bearer token. /mcp/<token> is the same
// check for clients that can only send a URL.
const app = createMcpExpressApp({ host: "0.0.0.0" });

app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok" });
});

app.get("/", (_req: Request, res: Response) => {
  res
    .type("text")
    .send(
      [
        "MCP greeting server is running.",
        "Health check: GET /health",
        "Gemini CLI: POST /mcp with Authorization: Bearer <token>",
        "Gemini web app: POST /mcp/<token>",
        "",
      ].join("\n")
    );
});

function methodNotAllowed(_req: Request, res: Response): void {
  res.status(405).json({
    jsonrpc: "2.0",
    error: {
      code: -32000,
      message: "Method not allowed.",
    },
    id: null,
  });
}

async function handleMcpPost(req: Request, res: Response): Promise<void> {
  // Stateless mode: a new server handles each request, which fits a
  // greeting tool and a host that may sleep between calls.
  const server = createGreetingServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  const cleanup = () => {
    void transport.close();
    void server.close();
  };
  res.on("close", cleanup);

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error(
      "Error handling MCP request:",
      error instanceof Error ? error.message : error
    );
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message: "Internal server error",
        },
        id: null,
      });
    }
  }
}

const bearerAuth = requireBearerToken(token);
const pathAuth = requirePathToken(token);

app.get("/mcp", bearerAuth, methodNotAllowed);
app.delete("/mcp", bearerAuth, methodNotAllowed);
app.post("/mcp", bearerAuth, handleMcpPost);

// Gemini's web app can only send the server URL, so the token is the last
// path segment. Header auth on /mcp stays available for Gemini CLI.
app.get("/mcp/:token", pathAuth, methodNotAllowed);
app.delete("/mcp/:token", pathAuth, methodNotAllowed);
app.post("/mcp/:token", pathAuth, handleMcpPost);

const port = listenPort();
const httpServer = app.listen(port, "0.0.0.0");

httpServer.on("error", (error: NodeJS.ErrnoException) => {
  console.error("Failed to start HTTP server:", error);
  process.exit(1);
});

httpServer.on("listening", () => {
  console.error(`MCP greeting server listening on http://127.0.0.1:${port}`);
  console.error("Health check: GET /health");
  console.error("MCP endpoint: POST /mcp (bearer header) and POST /mcp/<token>");
});

function shutdown(): void {
  httpServer.close(() => {
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 2000).unref();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
