<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/benjitaylor/agentation/main/mcp/logo-dark.svg">
  <img src="https://raw.githubusercontent.com/benjitaylor/agentation/main/mcp/logo.svg" alt="Agentation MCP" width="240">
</picture>

<br>

[![npm version](https://img.shields.io/npm/v/agentation-mcp)](https://www.npmjs.com/package/agentation-mcp)
[![downloads](https://img.shields.io/npm/dm/agentation-mcp)](https://www.npmjs.com/package/agentation-mcp)

**[Agentation](https://agentation.com)** is an agent-agnostic visual feedback tool. Click elements on your page, add notes, and copy structured output that helps AI coding agents find the exact code you're referring to.

The MCP (Model Context Protocol) server connects Agentation to Claude Code, Codex, Gemini CLI, Grok Build, and other compatible agents, so they can receive and respond to your annotations directly.

## Runtime requirement

Node.js 24 LTS is recommended; Node.js 22 LTS is also supported. The minimum is Node.js 20, which remains compatible but is no longer maintained by Node.js. The browser toolbar has no Node.js runtime requirement.

The previous MCP release advertised Node.js 18, but its SQLite dependency already required Node.js 20 or newer. This release corrects that metadata; it does not introduce a new SQLite runtime minimum.

## Installation

```bash
npm install agentation-mcp
# or
pnpm add agentation-mcp
```

## Quick Start

### 1. Add to your agent

The fastest way to configure Agentation across any supported agent:

```bash
npx add-mcp "npx -y agentation-mcp server"
```

Uses [add-mcp](https://github.com/neondatabase/add-mcp) to detect supported installed clients. The [setup guide](https://agentation.com/install#agent-integration) also includes direct commands for Claude Code, Codex, Gemini CLI, and Grok Build.

Or for Claude Code specifically:

```bash
claude mcp add agentation -- npx -y agentation-mcp server
```


### 2. Start your agent

Restart the agent after registering the server. It launches Agentation as a
local stdio MCP process; keep that agent session running while annotating.
The server provides both:
- **HTTP server** (port 4747) - receives annotations from the browser toolbar
- **MCP server** (stdio) - exposes tools for your connected agent

### 3. Connect the browser toolbar

```tsx
<Agentation endpoint="http://localhost:4747" />
```

Use the same server URL as the agent, including a custom port if configured.
Without `endpoint`, the toolbar saves feedback locally for manual copying.

### 4. Verify browser-to-agent delivery

```bash
npx agentation-mcp doctor
# Custom server:
npx agentation-mcp doctor --http-url http://localhost:4747
```

Doctor checks services, not browser delivery. Add one test annotation in the app,
then ask your agent to call `agentation_get_all_pending`. Confirm its exact
comment and page. If it is missing, check the component endpoint and that both
clients point to the same server.

## CLI Commands

```bash
agentation-mcp init                    # Setup wizard (registers via claude mcp add)
agentation-mcp server [options]        # Start the annotation server
agentation-mcp doctor                  # Check your setup
agentation-mcp help                    # Show help
```

### Server Options

```bash
--port <port>      # HTTP server port (default: 4747)
--mcp-only         # Skip HTTP server, only run MCP on stdio
--http-url <url>   # HTTP server URL for MCP to fetch from
--host <address>   # Interface to bind (default: loopback only)
--tasks            # Experimental: run watch_annotations as an MCP Task (see below)
```

## MCP Tools

The MCP server exposes these tools to AI agents:

| Tool | Description |
|------|-------------|
| `agentation_list_sessions` | List all active annotation sessions |
| `agentation_get_session` | Get a session with all its annotations |
| `agentation_get_pending` | Get pending annotations for a session |
| `agentation_get_all_pending` | Get pending annotations across all sessions |
| `agentation_acknowledge` | Mark an annotation as acknowledged |
| `agentation_resolve` | Mark an annotation as resolved |
| `agentation_dismiss` | Dismiss an annotation with a reason |
| `agentation_reply` | Add a reply to an annotation thread |
| `agentation_watch_annotations` | Block until new annotations appear, then return batch |

## HTTP API

The HTTP server provides a REST API for the browser toolbar:

### Sessions
- `POST /sessions` - Create a new session
- `GET /sessions` - List all sessions
- `GET /sessions/:id` - Get session with annotations

### Annotations
- `POST /sessions/:id/annotations` - Add annotation. Idempotent by `id`: posting an annotation that already exists returns it with `200` instead of creating a duplicate
- `GET /annotations/:id` - Get annotation
- `PATCH /annotations/:id` - Update annotation
- `DELETE /annotations/:id` - Delete annotation
- `GET /sessions/:id/pending` - Get pending annotations
- `GET /pending` - Get all pending annotations

### Events (SSE)
- `GET /sessions/:id/events` - Session event stream
- `GET /events` - Global event stream (optionally filter with `?domain=...`)

### Health
- `GET /health` - Health check
- `GET /status` - Server status

## Hands-Free Mode

Use `agentation_watch_annotations` in a loop for automatic feedback processing -- the agent picks up new annotations as they're created:

1. Agent calls `agentation_watch_annotations` (blocks until annotations appear)
2. Annotations arrive -- agent receives batch after collection window
3. Agent processes each annotation:
   - `agentation_acknowledge` -- mark as seen
   - Make code changes
   - `agentation_resolve` -- mark as done with summary
4. Agent calls `agentation_watch_annotations` again (loop)

Example CLAUDE.md instructions:

```markdown
When I say "watch mode", call agentation_watch_annotations in a loop.
For each annotation: acknowledge it, make the fix, then resolve it with a summary.
Continue watching until I say stop or timeout is reached.
```

### MCP Tasks (experimental)

Start the server with `--tasks` (or `AGENTATION_MCP_TASKS=1`) to let clients that support the MCP Tasks extension run `agentation_watch_annotations` in the background. The call returns at once, the agent keeps working, and the batch arrives when the client polls the task. Clients without Tasks support keep the blocking watch. See [docs/mcp-tasks.md](./docs/mcp-tasks.md).

## Webhooks

Configure webhooks to receive notifications when users request agent action:

```bash
# Single webhook
export AGENTATION_WEBHOOK_URL=https://your-server.com/webhook

# Multiple webhooks (comma-separated)
export AGENTATION_WEBHOOKS=https://server1.com/hook,https://server2.com/hook
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `AGENTATION_STORE` | Storage backend (`memory` or `sqlite`) | `sqlite` |
| `AGENTATION_WEBHOOK_URL` | Single webhook URL | - |
| `AGENTATION_WEBHOOKS` | Comma-separated webhook URLs | - |
| `AGENTATION_EVENT_RETENTION_DAYS` | Days to keep SQLite events | `7` |
| `AGENTATION_CORS_ORIGINS` | Allowed browser origins; see below | dev-server origins |
| `AGENTATION_HOST` | Interface to bind; a non-loopback address enables remote clients | loopback only |
| `AGENTATION_MCP_TASKS` | Set to `1` to enable MCP Tasks for `agentation_watch_annotations` ([docs](./docs/mcp-tasks.md)) | off |

## Programmatic Usage

```typescript
import { startHttpServer, startMcpServer } from 'agentation-mcp';

// Start HTTP server on port 4747
startHttpServer(4747);

// Start MCP server (connects via stdio)
await startMcpServer('http://localhost:4747');
```

## Storage

By default, data is persisted to SQLite at `~/.agentation/store.db`. To use in-memory storage:

```bash
AGENTATION_STORE=memory agentation-mcp server
```

## Network access

The server is for the browser on the same machine. By default it only answers
clients connecting over loopback that address a local hostname (`localhost`,
`127.0.0.1`, `[::1]` or `*.localhost`), so other devices on the network and
DNS-rebinding pages get HTTP 403. To serve other machines deliberately, bind a
specific interface with `--host` or `AGENTATION_HOST`:

```sh
agentation-mcp server --host 0.0.0.0
```

The bundled stdio tools follow that address automatically unless `--http-url`
is set.

Pages served from that machine's private address are already allowed by the
default origin policy below; use `AGENTATION_CORS_ORIGINS` for public origins.

### Containers, Codespaces and remote dev

When the browser reaches the server through a port forward or a container
bridge, the connection is not loopback and the page origin is public. Allow
both explicitly:

```sh
AGENTATION_CORS_ORIGINS='https://your-forwarded-app-origin' agentation-mcp server --host 0.0.0.0
```

`agentation-mcp doctor` reports the address it can reach the server on.

## Browser origins

`AGENTATION_CORS_ORIGINS` controls which browser origins may call the HTTP server.
It applies to normal responses, errors, preflight requests, event streams, MCP
transport and cloud proxy routes. A disallowed Origin receives HTTP 403 before
the request can change data or be forwarded.

```sh
AGENTATION_CORS_ORIGINS='http://localhost:3000,https://preview.example.com' agentation-mcp server
```

Use exact HTTP(S) origins, including the port when present. Paths, credentials,
query strings, regular expressions and a wildcard mixed with other origins are
rejected at startup. A trailing slash is accepted and normalized.

When unset, dev-server origins are allowed: `localhost`, `*.localhost`,
`127.0.0.1`, `[::1]`, private-network addresses (`10.*`, `192.168.*`,
`172.16-31.*`) and `.local`, `.test` or `.internal` hostnames, over HTTP or
HTTPS on any port. Set the variable to add anything else, or to `*` to allow
every origin. An explicitly empty value rejects every browser Origin. Requests without an Origin, such as ordinary CLI
clients, remain allowed. CORS is a browser access policy, not authentication.

## Webhook delivery

Configure destinations with `AGENTATION_WEBHOOK_URL` or comma-separated
`AGENTATION_WEBHOOKS`. Repeated destinations are sent only once per action.
Action responses do not wait for delivery to complete.

Network failures, request timeouts, HTTP 429 and 5xx responses are retried.
Other unsuccessful responses stop immediately. Each retry sends the same JSON
body and `X-Agentation-Delivery-Id` header. Receivers should use that ID to avoid
processing a delivery twice: a timeout can occur after the receiver accepted it.

| Variable | Default | Meaning |
| --- | --- | --- |
| `AGENTATION_WEBHOOK_MAX_RETRIES` | `3` | Additional attempts after the first; 0 disables retries, maximum 10. |
| `AGENTATION_WEBHOOK_BASE_DELAY_MS` | `1000` | Initial exponential backoff, with up to 25% positive jitter. |
| `AGENTATION_WEBHOOK_MAX_DELAY_MS` | `30000` | Maximum time between attempts, including jitter. |
| `AGENTATION_WEBHOOK_TIMEOUT_MS` | `10000` | Per-request timeout. |

Retry-After is respected for retryable HTTP responses. If it exceeds the maximum
delay, delivery stops rather than retrying before the requested time. Timing
values must be positive integers no larger than 2,147,483,647 milliseconds;
invalid values fall back to their defaults.

Delivery is best effort and held in memory. It is not a durable queue and does
not promise exactly-once processing. Closing the server cancels requests and
pending retries; restarting does not resume them. Request timers are cleared
after every attempt and pending timers do not keep the process alive.

## In-memory event history

These limits apply when using the memory store. They bound replay history, not
the current sessions or annotations. SQLite storage is unchanged by these
settings.

| Variable | Default | Meaning |
| --- | --- | --- |
| `AGENTATION_MAX_EVENTS` | `10000` | Maximum retained events; oldest events are removed first. |
| `AGENTATION_EVENT_TTL_MS` | `3600000` | Event lifetime in milliseconds, default one hour. |
| `AGENTATION_CLEANUP_INTERVAL_MS` | `300000` | Background cleanup interval, default five minutes. |

All three values must be positive safe integers. The cleanup interval must also
fit the timer limit above. Invalid values fall back to their defaults. Reads
remove expired events immediately, without waiting for the next cleanup tick.
Pruning does not reset event sequence numbers. Closing the store clears its
cleanup timer, which does not keep an otherwise idle process running.

## Embedding the HTTP server

`startHttpServer(port)` returns the Node HTTP server. Existing callers can ignore
the return value; embedded callers can use `server.close()` to stop accepting
requests and cancel outstanding webhook deliveries.

## License

PolyForm Shield 1.0.0
