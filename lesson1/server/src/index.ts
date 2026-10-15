// 0. Import dependencies
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createGreetingServer } from "./createServer.js";

// 4. Start the MCP server on stdin/stdout for local IDE use.
// Remote access uses src/http.ts (`npm run start:http`).
async function main() {
  const server = createGreetingServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MCP server is running on stdin/stdout");
}

main();
