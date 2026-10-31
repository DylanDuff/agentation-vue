#!/usr/bin/env node
/**
 * Agentation Server
 *
 * Runs both:
 * - HTTP server for the React component to POST annotations
 * - MCP server for Claude Code to read and act on annotations
 *
 * Usage:
 *   npx agentation-mcp server [--port 4747] [--mcp-only] [--http-url URL] [--tasks]
 *   agentation-mcp server [--port 4747] [--mcp-only] [--http-url URL] [--tasks]
 *
 * Options:
 *   --port <number>   HTTP server port (default: 4747)
 *   --mcp-only        Skip HTTP server, only run MCP on stdio (for Claude Code MCP config)
 *   --http-url <url>  HTTP server URL for MCP to fetch from (default: http://localhost:4747)
 *   --tasks           Opt in to MCP Tasks for watch_annotations (or AGENTATION_MCP_TASKS=1)
 */

import { startHttpServer } from "./http.js";
import { startMcpServer, setApiKey } from "./mcp.js";

// Re-export for programmatic use
export { startHttpServer, setCloudApiKey } from "./http.js";
export { startMcpServer, setApiKey } from "./mcp.js";
export * from "./store.js";

// -----------------------------------------------------------------------------
// CLI Argument Parsing
// -----------------------------------------------------------------------------

function parseArgs(): { port: number; mcpOnly: boolean; httpUrl: string; tasks: boolean } {
  const args = process.argv.slice(2);
  let port = 4747;
  let mcpOnly = false;
  let tasks = process.env.AGENTATION_MCP_TASKS === "1";
  let httpUrl = "http://localhost:4747";

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--port" && args[i + 1]) {
      const parsed = parseInt(args[i + 1], 10);
      if (!isNaN(parsed) && parsed > 0 && parsed < 65536) {
        port = parsed;
        // Also update httpUrl if port changes and httpUrl wasn't explicitly set
        if (!args.includes("--http-url")) {
          httpUrl = `http://localhost:${port}`;
        }
      }
      i++;
    }
    if (args[i] === "--mcp-only") {
      mcpOnly = true;
    }
    if (args[i] === "--tasks") {
      tasks = true;
    }
    if (args[i] === "--http-url" && args[i + 1]) {
      httpUrl = args[i + 1];
      i++;
    }
  }

  return { port, mcpOnly, httpUrl, tasks };
}

// -----------------------------------------------------------------------------
// Main
// -----------------------------------------------------------------------------

async function main(): Promise<void> {
  const { port, mcpOnly, httpUrl, tasks } = parseArgs();

  // Start HTTP server (for browser clients) - skip if --mcp-only
  if (!mcpOnly) {
    startHttpServer(port);
  }

  // Start MCP server (for Claude Code via stdio)
  // MCP fetches from HTTP server (single source of truth)
  await startMcpServer(httpUrl, { tasks });
}

