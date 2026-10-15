import { createHash, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

const MINIMUM_TOKEN_LENGTH = 16;

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
  return token;
}

function hashesMatch(presented: string, expected: string): boolean {
  const presentedHash = createHash("sha256").update(presented).digest();
  const expectedHash = createHash("sha256").update(expected).digest();
  return timingSafeEqual(presentedHash, expectedHash);
}

export function requireBearerToken(expectedToken: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const header = req.header("authorization");
    const match = header?.match(/^Bearer\s+(\S+)\s*$/i);
    if (!match || !hashesMatch(match[1], expectedToken)) {
      res.setHeader("WWW-Authenticate", 'Bearer realm="mcp"');
      res.status(401).json({ error: "Missing or invalid bearer token" });
      return;
    }
    next();
  };
}
