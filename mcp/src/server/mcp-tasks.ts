/**
 * Opt-in MCP Tasks support for agentation_watch_annotations.
 *
 * Built on the v2 MCP SDK, which serves both protocol eras on one stdio
 * connection. A client that declares the Tasks extension on a 2026-07-28
 * request gets a task back from agentation_watch_annotations and polls it
 * with tasks/get, so the agent keeps working while the watch runs. Every
 * other tool, and every client without Tasks support, gets the same
 * blocking behaviour as the default server.
 *
 * Spec: https://modelcontextprotocol.github.io/ext-tasks/specification/2026-07-28/tasks.html
 * See docs/mcp-tasks.md for how to try it.
 */

import { randomUUID } from "node:crypto";
import {
  MissingRequiredClientCapabilityError,
  ProtocolError,
  Server,
  type Tool,
} from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { z } from "zod/v4";
import { buildTools, error, handleTool, type ToolResult, type WatchLimits } from "./mcp.js";

export const TASKS_EXTENSION = "io.modelcontextprotocol/tasks";
const CLIENT_CAPABILITIES_KEY = "io.modelcontextprotocol/clientCapabilities";

const WATCH_TOOL = "agentation_watch_annotations";

/** A task-backed watch runs in the background, so it can wait far longer. */
export const TASK_WATCH_LIMITS: WatchLimits = {
  defaultTimeoutSeconds: 1800,
  maxTimeoutSeconds: 3600,
};

/** Tasks outlive the longest watch, so the result can still be fetched. */
const TASK_TTL_MS = 2 * 60 * 60 * 1000;
const POLL_INTERVAL_MS = 2000;
const CLEANUP_INTERVAL_MS = 60 * 1000;

const INVALID_PARAMS = -32602;
const INTERNAL_ERROR = -32603;

type TaskStatus = "working" | "input_required" | "completed" | "cancelled" | "failed";

type TaskRecord = {
  taskId: string;
  status: TaskStatus;
  statusMessage?: string;
  createdAt: string;
  lastUpdatedAt: string;
  ttlMs: number;
  pollIntervalMs: number;
  result?: ToolResult;
  error?: { code: number; message: string };
  controller: AbortController;
};

// -----------------------------------------------------------------------------
// Task Registry
// -----------------------------------------------------------------------------

/**
 * In-memory task store. Tasks live in this MCP process, which is what a
 * stdio server needs: the client that created a task is the one polling it.
 */
export class TaskRegistry {
  private tasks = new Map<string, TaskRecord>();

  /** Start a background tool run and return its task in the working state. */
  create(run: (signal: AbortSignal) => Promise<ToolResult>): TaskRecord {
    const now = new Date().toISOString();
    const task: TaskRecord = {
      taskId: randomUUID(),
      status: "working",
      statusMessage: "Watching for new annotations.",
      createdAt: now,
      lastUpdatedAt: now,
      ttlMs: TASK_TTL_MS,
      pollIntervalMs: POLL_INTERVAL_MS,
      controller: new AbortController(),
    };
    this.tasks.set(task.taskId, task);

    run(task.controller.signal).then(
      (result) => this.settle(task, { status: "completed", result }),
      (err) => this.settle(task, {
        status: "failed",
        statusMessage: "The watch failed.",
        error: { code: INTERNAL_ERROR, message: err instanceof Error ? err.message : "Unknown error" },
      })
    );
    return task;
  }

  /** Look up a live task, or throw the spec's invalid-params error. */
  get(taskId: string): TaskRecord {
    const task = this.tasks.get(taskId);
    if (!task || this.isExpired(task)) {
      throw new ProtocolError(INVALID_PARAMS, "Failed to retrieve task: Task not found");
    }
    return task;
  }

  /** Cooperative cancel: stop the watch and report the task as cancelled. */
  cancel(taskId: string): void {
    const task = this.get(taskId);
    if (task.status !== "working") return;
    this.settle(task, { status: "cancelled", statusMessage: "The watch was cancelled." });
    task.controller.abort();
  }

  /** Drop expired tasks, aborting any that are somehow still running. */
  sweep(): void {
    for (const [taskId, task] of this.tasks) {
      if (!this.isExpired(task)) continue;
      task.controller.abort();
      this.tasks.delete(taskId);
    }
  }

  /** Cancel every task, for shutdown. */
  close(): void {
    for (const task of this.tasks.values()) task.controller.abort();
    this.tasks.clear();
  }

  private settle(task: TaskRecord, update: Partial<TaskRecord>): void {
    // The first terminal state wins, so a late result never revives a cancelled task.
    if (task.status !== "working") return;
    Object.assign(task, update, { lastUpdatedAt: new Date().toISOString() });
    if (update.status === "completed") delete task.statusMessage;
  }

  private isExpired(task: TaskRecord): boolean {
    return Date.now() - Date.parse(task.createdAt) > task.ttlMs;
  }
}

/** The wire shape of a task, without the server's private fields. */
export function taskWire(task: TaskRecord) {
  const { controller: _controller, result, error: taskError, ...wire } = task;
  return {
    ...wire,
    ...(task.status === "completed" && result ? { result } : {}),
    ...(task.status === "failed" && taskError ? { error: taskError } : {}),
  };
}

// -----------------------------------------------------------------------------
// Server
// -----------------------------------------------------------------------------

/** Whether this request's per-request envelope declares the Tasks extension. */
function declaresTasks(envelope: Record<string, unknown> | undefined): boolean {
  const capabilities = envelope?.[CLIENT_CAPABILITIES_KEY] as
    | { extensions?: Record<string, unknown> }
    | undefined;
  return capabilities?.extensions?.[TASKS_EXTENSION] !== undefined;
}

/** Task methods are only for clients that declared the extension. */
function requireTasks(envelope: Record<string, unknown> | undefined): void {
  if (!declaresTasks(envelope)) {
    throw new MissingRequiredClientCapabilityError({
      requiredCapabilities: { extensions: { [TASKS_EXTENSION]: {} } },
    });
  }
}

const TaskIdParams = z.object({ taskId: z.string() }).passthrough();

/**
 * Build one MCP server instance. serveStdio calls this once per connection
 * and pins the instance to whichever protocol era the client opens with.
 */
export function createTaskMcpServer(registry: TaskRegistry): Server {
  const server = new Server(
    { name: "agentation", version: "0.0.1" },
    { capabilities: { tools: {}, extensions: { [TASKS_EXTENSION]: {} } } }
  );
  // The tool definitions are plain JSON Schema; widen them to the SDK's type.
  const blockingTools = buildTools() as unknown as Tool[];
  const taskTools = buildTools(TASK_WATCH_LIMITS) as unknown as Tool[];

  server.setRequestHandler("tools/list", async (_request, ctx) => ({
    tools: declaresTasks(ctx.mcpReq.envelope) ? taskTools : blockingTools,
  }));

  server.setRequestHandler("tools/call", async (request, ctx) => {
    const { name, arguments: args } = request.params;
    if (name === WATCH_TOOL && declaresTasks(ctx.mcpReq.envelope)) {
      const task = registry.create((signal) => handleTool(name, args, signal, TASK_WATCH_LIMITS));
      console.error(`[MCP] ${WATCH_TOOL} started as task ${task.taskId}`);
      // The SDK types tools/call results as CallToolResult; a task result is
      // the 2026-07-28 alternative it passes through to the wire unchanged.
      return { resultType: "task", ...taskWire(task) } as never;
    }
    if (name === WATCH_TOOL) {
      console.error(`[MCP] ${WATCH_TOOL} is blocking: the client did not declare the Tasks extension`);
    }
    try {
      return await handleTool(name, args, ctx.mcpReq.signal);
    } catch (err) {
      return error(err instanceof Error ? err.message : "Unknown error");
    }
  });

  server.setRequestHandler("tasks/get", { params: TaskIdParams }, async ({ taskId }, ctx) => {
    requireTasks(ctx.mcpReq.envelope);
    return taskWire(registry.get(taskId));
  });

  server.setRequestHandler("tasks/cancel", { params: TaskIdParams }, async ({ taskId }, ctx) => {
    requireTasks(ctx.mcpReq.envelope);
    registry.cancel(taskId);
    return {};
  });

  // Watches never ask for input, so there is never an outstanding request to
  // answer. The spec says to ignore such responses, after checking the task.
  server.setRequestHandler("tasks/update", { params: TaskIdParams }, async ({ taskId }, ctx) => {
    requireTasks(ctx.mcpReq.envelope);
    registry.get(taskId);
    return {};
  });

  return server;
}

/**
 * Serve the task-capable MCP server on stdio.
 * The HTTP server URL and API key come from the shared mcp.ts configuration.
 */
export function startTaskMcpServer(): void {
  const registry = new TaskRegistry();
  const sweeper = setInterval(() => registry.sweep(), CLEANUP_INTERVAL_MS);
  sweeper.unref();

  serveStdio(() => createTaskMcpServer(registry), {
    onerror: (err) => console.error("[MCP] Tasks server error:", err),
  });

  process.once("exit", () => {
    clearInterval(sweeper);
    registry.close();
  });
}
