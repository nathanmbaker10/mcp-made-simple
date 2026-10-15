import { createHash, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

const MINIMUM_TOKEN_LENGTH = 16;

// Hex tokens (and the characters below) can be one URL path segment.
const PATH_SAFE_TOKEN = /^[A-Za-z0-9_-]+$/;

export function readAuthToken(): string {
  const token = process.env.MCP_AUTH_TOKEN?.trim();
  if (!token || token.length < MINIMUM_TOKEN_LENGTH) {
    console.error(
      "Refusing to start: set MCP_AUTH_TOKEN to a random string at least 16 characters long."
    );
    console.error(
      'Example: export MCP_AUTH_TOKEN="$(node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))")"'
    );
    process.exit(1);
  }
  if (!PATH_SAFE_TOKEN.test(token)) {
    console.error(
      "MCP_AUTH_TOKEN includes characters that cannot be a single URL path segment. The Gemini web app URL needs a hex token from the command above. The Authorization header can still use this value."
    );
  }
  return token;
}

function expectedHash(token: string): Buffer {
  return createHash("sha256").update(token, "utf8").digest();
}

// Hash both sides so timingSafeEqual always compares equal-length digests.
function matchesHash(presented: string, hash: Buffer): boolean {
  const presentedHash = createHash("sha256").update(presented, "utf8").digest();
  return timingSafeEqual(presentedHash, hash);
}

function sendUnauthorized(res: Response, advertiseBearer: boolean): void {
  if (advertiseBearer) {
    res.setHeader("WWW-Authenticate", 'Bearer realm="mcp"');
  }
  res.status(401).json({ error: "Missing or invalid token" });
}

function bearerValue(req: Request): string | undefined {
  const header = req.header("authorization");
  const match = header?.match(/^Bearer\s+(\S+)\s*$/i);
  return match?.[1];
}

export function requireBearerToken(expectedToken: string) {
  const hash = expectedHash(expectedToken);
  return (req: Request, res: Response, next: NextFunction): void => {
    const presented = bearerValue(req);
    // Always hash, including when the header is absent.
    const ok = matchesHash(presented ?? "", hash) && presented !== undefined;
    if (!ok) {
      sendUnauthorized(res, true);
      return;
    }
    next();
  };
}

export function requirePathToken(expectedToken: string) {
  const hash = expectedHash(expectedToken);
  return (req: Request, res: Response, next: NextFunction): void => {
    const raw = req.params.token;
    const presented = typeof raw === "string" ? raw : "";
    if (!matchesHash(presented, hash)) {
      // No WWW-Authenticate here. A 401 with that header makes Gemini start
      // an OAuth prompt, and the web app dialog cannot send a bearer header.
      sendUnauthorized(res, false);
      return;
    }
    next();
  };
}
