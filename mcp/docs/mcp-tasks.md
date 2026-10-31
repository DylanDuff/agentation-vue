# MCP Tasks for `agentation_watch_annotations` (experimental)

Opt-in support for the MCP Tasks extension (protocol revision `2026-07-28`),
so a client can run `agentation_watch_annotations` in the background instead
of holding the agent's turn while it waits.

- Spec: <https://modelcontextprotocol.github.io/ext-tasks/specification/2026-07-28/tasks.html>
- Code: `src/server/mcp-tasks.ts`
- Tests: `test/tasks.test.cjs`

## Enabling it

Off by default. Turn it on with either of:

```bash
agentation-mcp server --tasks
AGENTATION_MCP_TASKS=1 agentation-mcp server
```

For Claude Code:

```bash
claude mcp add agentation -- npx -y agentation-mcp server --tasks
```

Without the flag the server is the same v1 SDK server as before, byte for byte.

## What changes with `--tasks`

The stdio MCP server is built on the v2 SDK (`@modelcontextprotocol/server`),
whose `serveStdio` serves both protocol eras on one connection:

| Client | `agentation_watch_annotations` | Other tools |
|---|---|---|
| 2026-07-28 client that declares `io.modelcontextprotocol/tasks` on the request | Returns a task at once; the batch arrives through `tasks/get` | Answer directly |
| 2026-07-28 client without the extension | Blocking, as today | Answer directly |
| 2025-era client (`initialize` handshake) | Blocking, as today | Answer directly |

Only the watch tool becomes a task. The other tools finish quickly, so a task
would only add round trips.

### Timeouts

A blocking watch defaults to 120s and caps at 300s, because it holds the
agent's turn. A task-backed watch runs in the background, so it defaults to
1800s (30 min) and caps at 3600s. `tools/list` describes the limits that apply
to the client asking. Constants: `BLOCKING_WATCH_LIMITS` in `mcp.ts`,
`TASK_WATCH_LIMITS` in `mcp-tasks.ts`.

A task still ends after one batch (or a quiet timeout), so the agent starts a
new watch after handling each batch. The loop stays, without the agent being
blocked between batches.

### Task lifecycle

- `tools/call` returns `resultType: "task"` with `status: "working"`,
  `ttlMs` (2 hours) and `pollIntervalMs` (2000).
- `tasks/get` returns `completed` with the usual watch result in `result`.
  A tool-level error (`isError: true`) is still `completed`, per the spec. A
  thrown error becomes `failed` with a JSON-RPC `error`.
- `tasks/cancel` marks the task `cancelled` and aborts the SSE watch.
- `tasks/update` is accepted and ignored: watches never ask for input.
- Unknown or expired task ids get `-32602`. Task methods from a client that
  did not declare the extension get `-32021`.
- Tasks live in memory in the MCP process. Expired ones are swept every
  minute; all are aborted on exit.

## Client support

Claude Code speaks `2026-07-28` to this server (verified with v2.1.316: it
opens with `server/discover`). It only declares the Tasks extension when its
Tasks beta is enabled for the account, in interactive sessions. It does not
for `claude -p`, and the article that announced the beta also lists subagents,
the VS Code extension and the desktop app as unsupported. When the extension
is not declared you get the blocking watch, as today.

## Checking it works

The server logs one line to stderr per watch call:

```
[MCP] agentation_watch_annotations started as task <id>
[MCP] agentation_watch_annotations is blocking: the client did not declare the Tasks extension
```

In Claude Code, run `claude --debug` and look for these lines, or check that
the tool call returns right away and the agent keeps working until the batch
arrives.

## Known limits

- Only the stdio server supports Tasks. The HTTP `/mcp` endpoint in `http.ts`
  still uses the v1 SDK and always blocks.
- No push notifications (`subscriptions/listen`). Clients poll `tasks/get`,
  which is the spec's default.
