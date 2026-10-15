// Shared MCP server used by both transports:
// - stdio (src/index.ts) for a local IDE on this computer
// - Streamable HTTP (src/http.ts) for a remote client such as Gemini CLI

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { greetingToolDefinition, handleGreeting } from "./tools/greeting.js";

export function createGreetingServer(): Server {
  // 1. Create an MCP server instance
  const server = new Server(
    {
      name: "mcp-hello-world-server",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // 2. Define the list of tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [greetingToolDefinition],
    };
  });

  // 3. Add tool call logic
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    switch (name) {
      case "greeting":
        return handleGreeting(args);
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  });

  return server;
}
