// End-to-end checks for the opt-in MCP Tasks server (`server --mcp-only --tasks`):
// a raw JSON-RPC client drives the CLI over stdio against a fake annotation API.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { resolve } = require('node:path');
const { spawn } = require('node:child_process');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { setTimeout: delay } = require('node:timers/promises');

const TASKS = 'io.modelcontextprotocol/tasks';
const WATCH = 'agentation_watch_annotations';
const annotation = { id: 'task-note', sessionId: 'task-session', comment: 'Tighten spacing', element: 'button', elementPath: '#cta', status: 'pending' };

// Fake HTTP API: no pending annotations, and an SSE stream the test can push to.
async function annotationApi(t) {
  const streams = new Set();
  const server = http.createServer((req, res) => {
    if (req.url.endsWith('/pending')) {
      res.end(JSON.stringify({ count: 0, annotations: [] }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/event-stream' });
    res.flushHeaders();
    streams.add(res);
    req.on('close', () => streams.delete(res));
  });
  await new Promise(done => server.listen(0, '127.0.0.1', done));
  t.after(() => {
    for (const res of streams) res.destroy();
    server.close();
  });
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    streams,
    async connected() {
      while (streams.size === 0) await delay(10);
    },
    send() {
      const event = { type: 'annotation.created', sessionId: annotation.sessionId, sequence: 1, payload: annotation };
      for (const res of streams) res.write(`data: ${JSON.stringify(event)}\n\n`);
    },
  };
}

// The test build swaps in a disposable SQLite store, which needs a path.
const directory = mkdtempSync(join(tmpdir(), 'agentation-tasks-'));
process.on('exit', () => rmSync(directory, { recursive: true, force: true }));

// Line-delimited JSON-RPC over the CLI's stdio.
function startServer(t, httpUrl, flags = ['--tasks']) {
  const child = spawn(process.execPath, [resolve('.test-dist/cli-review.js'), 'server', '--mcp-only', '--http-url', httpUrl, ...flags], {
    stdio: ['pipe', 'pipe', 'ignore'],
    env: { ...process.env, AGENTATION_TEST_DB_PATH: join(directory, 'test.db') },
  });
  t.after(() => child.kill());
  const waiting = new Map();
  let buffer = '';
  let nextId = 0;
  child.stdout.on('data', chunk => {
    buffer += chunk;
    let index;
    while ((index = buffer.indexOf('\n')) >= 0) {
      const message = JSON.parse(buffer.slice(0, index));
      buffer = buffer.slice(index + 1);
      waiting.get(message.id)?.(message);
    }
  });
  return {
    request(method, params) {
      const id = ++nextId;
      child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
      return new Promise(done => waiting.set(id, done));
    },
    notify(method, params) {
      child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method, params }) + '\n');
    },
  };
}

// The 2026-07-28 per-request envelope, with or without the Tasks extension.
const envelope = withTasks => ({
  'io.modelcontextprotocol/protocolVersion': '2026-07-28',
  'io.modelcontextprotocol/clientInfo': { name: 'tasks-test', version: '1.0.0' },
  'io.modelcontextprotocol/clientCapabilities': withTasks ? { extensions: { [TASKS]: {} } } : {},
});
const watchParams = (withTasks, args = {}) => ({
  name: WATCH,
  arguments: { sessionId: annotation.sessionId, batchWindowSeconds: 1, ...args },
  _meta: envelope(withTasks),
});
const toolBody = result => JSON.parse(result.content[0].text);

async function pollUntilDone(server, taskId) {
  for (;;) {
    const { result } = await server.request('tasks/get', { taskId, _meta: envelope(true) });
    if (result.status !== 'working') return result;
    await delay(50);
  }
}

test('a Tasks client gets a task for watch, and the batch arrives through tasks/get', async t => {
  const api = await annotationApi(t);
  const server = startServer(t, api.url);

  const discover = await server.request('server/discover', { _meta: envelope(true) });
  assert.deepEqual(discover.result.capabilities.extensions[TASKS], {});

  const created = (await server.request('tools/call', watchParams(true))).result;
  assert.equal(created.resultType, 'task');
  assert.equal(created.status, 'working');
  assert.equal(typeof created.taskId, 'string');
  assert.equal(typeof created.ttlMs, 'number');
  assert.equal(typeof created.pollIntervalMs, 'number');

  await api.connected();
  api.send();
  const done = await pollUntilDone(server, created.taskId);
  assert.equal(done.status, 'completed');
  assert.equal(done.resultType, 'complete');
  const value = toolBody(done.result);
  assert.equal(value.timeout, false);
  assert.deepEqual(value.annotations.map(a => a.id), [annotation.id]);
});

test('task mode advertises the longer watch timeout only to Tasks clients', async t => {
  const api = await annotationApi(t);
  const server = startServer(t, api.url);
  const describe = async withTasks => {
    const { result } = await server.request('tools/list', { _meta: envelope(withTasks) });
    return result.tools.find(tool => tool.name === WATCH).inputSchema.properties.timeoutSeconds.description;
  };
  assert.match(await describe(true), /max: 3600/);
  assert.match(await describe(false), /max: 300\)/);
});

test('cancelling a task stops the watch and reports it as cancelled', async t => {
  const api = await annotationApi(t);
  const server = startServer(t, api.url);
  const created = (await server.request('tools/call', watchParams(true))).result;
  await api.connected();

  const cancel = await server.request('tasks/cancel', { taskId: created.taskId, _meta: envelope(true) });
  assert.equal(cancel.error, undefined);
  const task = (await server.request('tasks/get', { taskId: created.taskId, _meta: envelope(true) })).result;
  assert.equal(task.status, 'cancelled');
  while (api.streams.size > 0) await delay(10);
});

test('task methods reject unknown ids and clients without the extension', async t => {
  const api = await annotationApi(t);
  const server = startServer(t, api.url);
  const unknown = await server.request('tasks/get', { taskId: 'missing', _meta: envelope(true) });
  assert.equal(unknown.error.code, -32602);
  const undeclared = await server.request('tasks/get', { taskId: 'missing', _meta: envelope(false) });
  assert.equal(undeclared.error.code, -32021);
});

test('a 2026-07-28 client without Tasks keeps the blocking watch', async t => {
  const api = await annotationApi(t);
  const server = startServer(t, api.url);
  const { result } = await server.request('tools/call', watchParams(false, { timeoutSeconds: 1 }));
  assert.equal(result.resultType, 'complete');
  assert.equal(toolBody(result).timeout, true);
});

test('a 2025-era client is served the blocking watch through initialize', async t => {
  const api = await annotationApi(t);
  const server = startServer(t, api.url);
  const init = await server.request('initialize', {
    protocolVersion: '2025-11-25',
    capabilities: {},
    clientInfo: { name: 'legacy-test', version: '1.0.0' },
  });
  assert.equal(init.result.serverInfo.name, 'agentation');
  server.notify('notifications/initialized');

  const tools = (await server.request('tools/list', {})).result.tools;
  assert.ok(tools.some(tool => tool.name === WATCH));
  const { result } = await server.request('tools/call', { name: WATCH, arguments: { timeoutSeconds: 1 } });
  assert.equal(result.resultType, undefined);
  assert.equal(toolBody(result).timeout, true);
});

test('other tools answer directly in task mode', async t => {
  const api = await annotationApi(t);
  const server = startServer(t, api.url);
  const { result } = await server.request('tools/call', { name: 'agentation_get_all_pending', arguments: {}, _meta: envelope(true) });
  assert.equal(result.resultType, 'complete');
  assert.equal(toolBody(result).count, 0);
});
