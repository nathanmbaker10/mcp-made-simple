// Starts the HTTP server, lists and calls the greeting tool, then checks stdio.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const token = "test-token-for-local-http-check";
const expectedGreeting = (name) => `Hello, ${name}! How can I help you today?`;

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exitCode = 1;
  throw new Error(message);
}

function assert(condition, message) {
  if (!condition) {
    fail(message);
  }
}

function withTimeout(promise, ms, label) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${ms}ms`));
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

function freePort() {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      if (!address || typeof address === "string") {
        reject(new Error("Could not allocate a port"));
        return;
      }
      const { port } = address;
      probe.close(() => resolve(port));
    });
    probe.on("error", reject);
  });
}

function startServer(port) {
  const child = spawn(process.execPath, ["build/http.js"], {
    cwd: root,
    env: {
      ...process.env,
      PORT: String(port),
      MCP_AUTH_TOKEN: token,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let logs = "";
  child.stdout.on("data", (chunk) => {
    logs += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    logs += chunk.toString();
  });
  return { child, logs: () => logs };
}

async function waitForExit(child, ms) {
  if (child.exitCode !== null) {
    return child.exitCode;
  }
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("process did not exit"));
    }, ms);
    child.once("exit", (code) => {
      clearTimeout(timer);
      resolve(code);
    });
  });
}

async function waitForHealth(url, child, logs) {
  const deadline = Date.now() + 10000;
  let lastError = "no response";
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      fail(`HTTP server exited early (${child.exitCode}):\n${logs()}`);
    }
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
      lastError = `status ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  fail(`Health check did not succeed (${lastError}):\n${logs()}`);
}

function stopChild(child) {
  if (!child || child.exitCode !== null) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
    }, 2000);
    child.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });
    child.kill("SIGTERM");
  });
}

function greetingText(result) {
  const block = result.content?.find((item) => item.type === "text");
  return block && "text" in block ? block.text : "";
}

async function expectGreeting(client, name) {
  const result = await withTimeout(
    client.callTool({ name: "greeting", arguments: { name } }),
    10000,
    `call greeting for ${name}`
  );
  assert(result.isError !== true, `greeting tool returned an error for ${name}: ${JSON.stringify(result)}`);
  assert(
    greetingText(result) === expectedGreeting(name),
    `unexpected greeting text: ${JSON.stringify(result)}`
  );
}

async function listGreetingTool(client, label) {
  const listed = await withTimeout(client.listTools(), 10000, `${label} tools/list`);
  const tool = listed.tools.find((item) => item.name === "greeting");
  assert(tool, `${label} did not list the greeting tool: ${JSON.stringify(listed.tools)}`);
  assert(
    tool.description === "Returns a greeting message to the user",
    `${label} greeting description changed: ${tool.description}`
  );
  assert(
    Array.isArray(tool.inputSchema?.required) && tool.inputSchema.required.includes("name"),
    `${label} greeting schema no longer requires name`
  );
  return tool;
}

async function main() {
  const refusedEnv = {
    ...process.env,
    PORT: "3000",
  };
  delete refusedEnv.MCP_AUTH_TOKEN;
  const refusedChild = spawn(process.execPath, ["build/http.js"], {
    cwd: root,
    env: refusedEnv,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let refusedLogs = "";
  refusedChild.stdout.on("data", (chunk) => {
    refusedLogs += chunk.toString();
  });
  refusedChild.stderr.on("data", (chunk) => {
    refusedLogs += chunk.toString();
  });
  const refusedCode = await waitForExit(refusedChild, 5000);
  assert(refusedCode === 1, `server without a token should exit 1, got ${refusedCode}: ${refusedLogs}`);
  assert(
    refusedLogs.includes("MCP_AUTH_TOKEN"),
    `startup error should mention MCP_AUTH_TOKEN: ${refusedLogs}`
  );
  console.log("ok: HTTP server refuses to start without MCP_AUTH_TOKEN");

  const port = await freePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const started = startServer(port);
  try {
    await waitForHealth(`${baseUrl}/health`, started.child, started.logs);

    const health = await fetch(`${baseUrl}/health`);
    assert(health.status === 200, `GET /health status ${health.status}`);
    const healthBody = await health.json();
    assert(healthBody.status === "ok", `unexpected health body ${JSON.stringify(healthBody)}`);
    console.log("ok: GET /health");

    const home = await fetch(baseUrl);
    assert(home.status === 200, `GET / status ${home.status}`);
    console.log("ok: GET /");

    const missing = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
    });
    assert(missing.status === 401, `missing token should be 401, got ${missing.status}`);
    assert(
      missing.headers.get("www-authenticate")?.includes("Bearer"),
      "header auth 401 should advertise Bearer"
    );
    console.log("ok: POST /mcp without a token returns 401");

    const wrong = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer not-the-token",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
    });
    assert(wrong.status === 401, `wrong token should be 401, got ${wrong.status}`);
    console.log("ok: POST /mcp with the wrong token returns 401");

    const getWithToken = await fetch(`${baseUrl}/mcp`, {
      headers: { authorization: `Bearer ${token}` },
    });
    assert(getWithToken.status === 405, `authenticated GET /mcp should be 405, got ${getWithToken.status}`);
    console.log("ok: authenticated GET /mcp returns 405");

    const client = new Client({ name: "lesson1-http-test", version: "1.0.0" });
    const transport = new StreamableHTTPClientTransport(new URL(`${baseUrl}/mcp`), {
      requestInit: {
        headers: { Authorization: `Bearer ${token}` },
      },
    });
    await withTimeout(client.connect(transport), 10000, "HTTP client connect");
    await listGreetingTool(client, "HTTP");
    console.log("ok: HTTP client listed the greeting tool");
    await expectGreeting(client, "Nathan");
    await expectGreeting(client, "Dad");
    console.log("ok: HTTP client called the greeting tool");

    let rejected = false;
    try {
      const bad = await client.callTool({ name: "greeting", arguments: {} });
      rejected = bad.isError === true;
    } catch {
      rejected = true;
    }
    assert(rejected, "greeting tool accepted a call without a name");
    console.log("ok: greeting tool still requires a name");

    await withTimeout(client.close(), 5000, "HTTP client close");

    const wrongPathToken = "wrong-token-value-xxxx";
    const wrongPath = await fetch(`${baseUrl}/mcp/${wrongPathToken}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
    });
    const wrongPathBody = await wrongPath.text();
    assert(wrongPath.status === 401, `wrong path token should be 401, got ${wrongPath.status}`);
    assert(!wrongPathBody.includes(token), "401 body included the real token");
    assert(!wrongPathBody.includes(wrongPathToken), "401 body echoed the path token");
    assert(
      wrongPath.headers.get("www-authenticate") == null,
      "path 401 should stay quiet so the web app does not start OAuth"
    );
    console.log("ok: POST /mcp/<wrong-token> returns 401");

    for (const candidate of [token.slice(0, -1), `${token}x`]) {
      const partial = await fetch(`${baseUrl}/mcp/${candidate}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
      });
      assert(partial.status === 401, `partial path token should be 401, got ${partial.status}`);
    }
    console.log("ok: partial path tokens return 401");

    const pathGet = await fetch(`${baseUrl}/mcp/${token}`);
    assert(pathGet.status === 405, `GET /mcp/<token> should be 405, got ${pathGet.status}`);
    console.log("ok: GET /mcp/<token> returns 405");

    const initializeBody = JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: { name: "lesson1-http-test", version: "1.0.0" },
      },
    });
    const slashed = await fetch(`${baseUrl}/mcp/${token}/`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
      },
      body: initializeBody,
    });
    assert(slashed.status === 200, `trailing slash should still authenticate, got ${slashed.status}`);
    console.log("ok: /mcp/<token>/ still accepts the token");

    const query = await fetch(`${baseUrl}/mcp?token=${encodeURIComponent(token)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: initializeBody,
    });
    assert(query.status === 401, `query token should be ignored, got ${query.status}`);
    console.log("ok: ?token= is ignored");

    const pathClient = new Client({ name: "lesson1-http-path-test", version: "1.0.0" });
    const pathTransport = new StreamableHTTPClientTransport(new URL(`${baseUrl}/mcp/${token}`));
    await withTimeout(pathClient.connect(pathTransport), 10000, "path URL client connect");
    await listGreetingTool(pathClient, "HTTP path");
    await expectGreeting(pathClient, "Dad");
    console.log("ok: HTTP client listed and called greeting using /mcp/<token>");
    await withTimeout(pathClient.close(), 5000, "path URL client close");
  } finally {
    await stopChild(started.child);
  }

  const stdioClient = new Client({ name: "lesson1-stdio-test", version: "1.0.0" });
  const stdioTransport = new StdioClientTransport({
    command: process.execPath,
    args: ["build/index.js"],
    cwd: root,
    stderr: "pipe",
  });
  try {
    await withTimeout(stdioClient.connect(stdioTransport), 10000, "stdio client connect");
    await listGreetingTool(stdioClient, "stdio");
    await expectGreeting(stdioClient, "Nathan");
    console.log("ok: stdio client listed and called the greeting tool");
  } finally {
    await withTimeout(stdioClient.close(), 5000, "stdio client close").catch(() => {
      void stdioTransport.close();
    });
  }

  console.log("All remote and stdio checks passed.");
}

const killer = setTimeout(() => {
  console.error("FAIL: test timed out");
  process.exit(1);
}, 45000);

main()
  .catch((error) => {
    if (!process.exitCode) {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    }
  })
  .finally(() => {
    clearTimeout(killer);
  });
