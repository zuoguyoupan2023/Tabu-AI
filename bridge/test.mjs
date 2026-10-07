#!/usr/bin/env node
/**
 * TabU AI 桥接服务回归测试（bridge v2，docs/003 §4；发版回归见 docs/013 §5）
 * 用法：npm run test:bridge   （或 node bridge/test.mjs）
 *
 * 不依赖真实浏览器：自起桥接服务（隔离 Token / 端口 / 配置目录）+ 假扩展 WS 客户端模拟浏览器侧。
 * 覆盖：双协议流式与非流式、多轮拼接、system 不转发、历史截断、Origin 白名单（放行/拒绝/预检/
 * 动态添加）、Token 认证、旧版扩展假流式兜底、ask_delta 快照换算、端口顺延 + http-port 文件、
 * tabu_site/images 透传、诊断端点透传、多浏览器偏好路由。
 */
import { spawn } from 'node:child_process';
import net from 'node:net';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import WebSocket from 'ws';

const SERVER_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), 'server.js');
const TEST_TOKEN = 'tabu_test_0123456789abcdef';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ========================== 小工具 ==========================
function freePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.once('error', reject);
    s.listen(0, '127.0.0.1', () => {
      const p = s.address().port;
      s.close(() => resolve(p));
    });
  });
}

async function waitFor(fn, { ms = 6000, step = 30, what = '条件' } = {}) {
  const t0 = Date.now();
  for (;;) {
    const v = fn();
    if (v) return v;
    if (Date.now() - t0 > ms) throw new Error('等待超时：' + what);
    await sleep(step);
  }
}

function rawHttp(port, { path: p, method = 'POST', headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path: p, method, headers }, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (c) => { data += c; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    req.on('error', reject);
    if (body != null) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

// 便捷请求：默认带 Bearer token；可覆写 origin/token/headers/rawBody
function api(bridge, p, body, opts = {}) {
  const { origin, token = bridge.token, method = 'POST', headers = {}, rawBody } = opts;
  const h = { 'content-type': 'application/json', ...headers };
  if (token) h.authorization = 'Bearer ' + token;
  if (origin !== undefined) h.origin = origin; // origin: 'null' 用于沙箱 iframe 场景
  return rawHttp(bridge.httpPort, {
    path: p, method, headers: h,
    body: rawBody !== undefined ? rawBody : (body === undefined ? undefined : JSON.stringify(body)),
  });
}

function parseSse(text) {
  const out = [];
  for (const block of String(text).split(/\r?\n\r?\n/)) {
    if (!block.trim()) continue;
    let event = null;
    let data = null;
    for (const line of block.split(/\r?\n/)) {
      if (line.startsWith('event:')) event = line.slice(6).trim();
      else if (line.startsWith('data:')) {
        const v = line.slice(5).trim();
        data = data == null ? v : data + '\n' + v;
      }
    }
    if (data == null) continue;
    let json = null;
    if (data !== '[DONE]') { try { json = JSON.parse(data); } catch (e) { /* 非 JSON 数据块 */ } }
    out.push({ event, data, json });
  }
  return out;
}

const sseText = (events) => events
  .filter((e) => e.json && e.json.choices && e.json.choices[0] && e.json.choices[0].delta && e.json.choices[0].delta.content != null)
  .map((e) => e.json.choices[0].delta.content)
  .join('');

// ========================== 假扩展（浏览器侧 WS 客户端） ==========================
class FakeExt {
  constructor({ port, token = TEST_TOKEN, ua }) {
    this.received = { ask: [], diag: [] };
    this.onAsk = null;
    this.onDiag = null;
    this.ws = new WebSocket(`ws://127.0.0.1:${port}`, ua ? { headers: { 'User-Agent': ua } } : undefined);
    this.ready = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('扩展 WS 认证超时')), 5000);
      this.ws.on('open', () => this.send({ type: 'auth', token }));
      this.ws.on('message', (data) => {
        let msg;
        try { msg = JSON.parse(String(data)); } catch (e) { return; }
        if (msg.type === 'auth_ok') { clearTimeout(timer); resolve(this); }
        else if (msg.type === 'ask') this._ask(msg);
        else if (msg.type === 'diag') this._diag(msg);
      });
      this.ws.on('error', (e) => { clearTimeout(timer); reject(e); });
    });
  }
  send(obj) { try { this.ws.send(JSON.stringify(obj)); } catch (e) { /* 已断开 */ } }
  async _ask(msg) {
    this.received.ask.push(msg);
    if (this.onAsk) await this.onAsk(msg);
  }
  async _diag(msg) {
    this.received.diag.push(msg);
    if (this.onDiag) await this.onDiag(msg);
  }
  // 常规回复：半程快照 + 全量快照（真流式）+ ask_result（final 兜底）
  answer(requestId, answer, extra = {}) {
    if (answer) {
      this.send({ type: 'ask_delta', requestId, text: answer.slice(0, Math.ceil(answer.length / 2)) });
      this.send({ type: 'ask_delta', requestId, text: answer });
    }
    this.send({ type: 'ask_result', requestId, result: { answer, ...extra } });
  }
  close() { try { this.ws.close(); } catch (e) { /* noop */ } }
}

// ========================== 桥接服务进程 ==========================
const bridges = [];
async function startBridge(envOverrides = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tabu-bridge-test-'));
  const base = {};
  for (const [k, v] of Object.entries(process.env)) if (!k.startsWith('TABU_BRIDGE_')) base[k] = v;
  const env = {
    ...base,
    TABU_BRIDGE_TOKEN: TEST_TOKEN,
    TABU_BRIDGE_CONFIG_DIR: dir,
    TABU_BRIDGE_TIMEOUT: '20000',
    TABU_BRIDGE_WS_PORT: String(await freePort()),
    ...envOverrides,
  };
  // 未显式指定端口、也未给候选列表 → 分配一个空闲端口（避免碰到真实运行中的桥接）
  if (!env.TABU_BRIDGE_HTTP_PORT && !env.TABU_BRIDGE_HTTP_PORT_CANDIDATES) {
    env.TABU_BRIDGE_HTTP_PORT = String(await freePort());
  }
  const child = spawn(process.execPath, [SERVER_PATH], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (d) => { stdout += d; });
  child.stderr.on('data', (d) => { stderr += d; });
  // 实际 HTTP 端口以 http-port 文件为准（顺延场景端口≠环境变量）
  const portFile = path.join(dir, 'http-port');
  let httpPort;
  try {
    httpPort = await waitFor(() => {
      try {
        const v = parseInt(fs.readFileSync(portFile, 'utf8').trim(), 10);
        return Number.isInteger(v) && v > 0 ? v : null;
      } catch (e) { return null; }
    }, { ms: 8000, what: '桥接服务启动（http-port 文件）' });
  } catch (e) {
    try { child.kill('SIGKILL'); } catch (e2) { /* noop */ }
    throw new Error(e.message + '\n--- stdout ---\n' + stdout + '\n--- stderr ---\n' + stderr);
  }
  const bridge = { child, dir, httpPort, wsPort: parseInt(env.TABU_BRIDGE_WS_PORT, 10), token: TEST_TOKEN };
  bridges.push(bridge);
  return bridge;
}

function stopAll() {
  for (const b of bridges) {
    try { b.child.kill('SIGTERM'); } catch (e) { /* noop */ }
    try { fs.rmSync(b.dir, { recursive: true, force: true }); } catch (e) { /* noop */ }
  }
}
process.on('exit', stopAll);

// ========================== 测试运行器 ==========================
const failures = [];
let passed = 0;
async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log('  ✅ ' + name);
  } catch (e) {
    failures.push({ name, e });
    console.log('  ❌ ' + name);
    console.log('     ' + String((e && e.message) || e).split('\n').join('\n     '));
  }
}

// ========================== 用例 ==========================
async function run() {
  console.log('TabU AI 桥接回归测试（bridge/test.mjs）');
  console.log('─'.repeat(64));

  // ---------- 套件 1：HTTP 双协议 / 安全 / 兼容 ----------
  const b = await startBridge();
  const ext = new FakeExt({ port: b.wsPort });
  await ext.ready;
  console.log(`套件 1：HTTP 双协议 / 安全 / 兼容（HTTP ${b.httpPort}，WS ${b.wsPort}）`);

  await test('GET / 服务自述与端点', async () => {
    const res = await api(b, '/', undefined, { method: 'GET', token: null });
    assert.equal(res.status, 200);
    const j = JSON.parse(res.body);
    assert.equal(j.name, 'TabU AI Bridge');
    assert.equal(j.endpoints.anthropic, 'POST /v1/messages');
    assert.equal(j.endpoints.openai, 'POST /v1/chat/completions');
    assert.ok(j.baseUrls.openai_compatible.endsWith(':' + b.httpPort + '/v1'));
  });

  await test('GET /v1/models 模型列表', async () => {
    const res = await api(b, '/v1/models', undefined, { method: 'GET' });
    assert.equal(res.status, 200);
    const j = JSON.parse(res.body);
    assert.ok(Array.isArray(j.data) && j.data.some((m) => m.id === 'claude-bridge'));
  });

  await test('count_tokens 估算（len/4）', async () => {
    const res = await api(b, '/v1/messages/count_tokens', { messages: [{ role: 'user', content: 'a'.repeat(400) }] });
    assert.equal(res.status, 200);
    assert.equal(JSON.parse(res.body).input_tokens, 100);
  });

  await test('Token 认证：错误 401 / 缺失 401 / x-api-key 正确放行', async () => {
    ext.onAsk = (m) => ext.answer(m.requestId, 'ok');
    const bad = await api(b, '/v1/chat/completions', { model: 'm', messages: [{ role: 'user', content: 'hi' }] }, { token: 'wrong-token' });
    assert.equal(bad.status, 401);
    const none = await api(b, '/v1/chat/completions', { model: 'm', messages: [{ role: 'user', content: 'hi' }] }, { token: null });
    assert.equal(none.status, 401);
    const good = await api(b, '/v1/messages', { model: 'm', max_tokens: 8, messages: [{ role: 'user', content: '你好' }] },
      { token: null, headers: { 'x-api-key': b.token, 'anthropic-version': '2023-06-01' } });
    assert.equal(good.status, 200);
  });

  await test('OpenAI 非流式：答案 + tabu_via_site / tabu_diag / tabu_failover 透传', async () => {
    ext.onAsk = (m) => ext.answer(m.requestId, '你好，世界', {
      viaSite: 'kimi',
      diag: { inputFound: true, sendFound: true },
      failover: ['claude: 跳过（健康心跳显示不可达）'],
    });
    const res = await api(b, '/v1/chat/completions', { model: 'claude-bridge', stream: false, messages: [{ role: 'user', content: '打个招呼' }] });
    assert.equal(res.status, 200);
    const j = JSON.parse(res.body);
    assert.equal(j.choices[0].message.content, '你好，世界');
    assert.equal(j.choices[0].finish_reason, 'stop');
    assert.equal(j.tabu_via_site, 'kimi');
    assert.equal(j.tabu_diag.inputFound, true);
    assert.deepEqual(j.tabu_failover, ['claude: 跳过（健康心跳显示不可达）']);
    assert.equal(ext.received.ask.at(-1).question, '打个招呼');
  });

  await test('OpenAI 真流式：增量实时转发 + 尾部补差 + [DONE]', async () => {
    ext.onAsk = async (m) => {
      ext.send({ type: 'ask_delta', requestId: m.requestId, text: '第一段' });
      await sleep(30);
      ext.send({ type: 'ask_delta', requestId: m.requestId, text: '第一段第二段' });
      ext.send({ type: 'ask_result', requestId: m.requestId, result: { answer: '第一段第二段第三段' } });
    };
    const res = await api(b, '/v1/chat/completions', { model: 'claude-bridge', stream: true, messages: [{ role: 'user', content: '写三段' }] });
    assert.equal(res.status, 200);
    assert.match(res.headers['content-type'], /text\/event-stream/);
    const events = parseSse(res.body);
    assert.equal(sseText(events), '第一段第二段第三段');
    assert.equal(events.at(-1).data, '[DONE]');
  });

  await test('Anthropic 非流式：content 结构 + usage', async () => {
    ext.onAsk = (m) => ext.answer(m.requestId, '答案是 42');
    const res = await api(b, '/v1/messages', { model: 'claude-bridge', max_tokens: 64, messages: [{ role: 'user', content: '问题' }] },
      { token: null, headers: { 'x-api-key': b.token } });
    assert.equal(res.status, 200);
    const j = JSON.parse(res.body);
    assert.equal(j.type, 'message');
    assert.equal(j.content[0].text, '答案是 42');
    assert.equal(j.stop_reason, 'end_turn');
    assert.ok(j.usage.output_tokens > 0);
  });

  await test('Anthropic 流式：message_start → content_block_delta → message_stop', async () => {
    ext.onAsk = async (m) => {
      ext.send({ type: 'ask_delta', requestId: m.requestId, text: '甲' });
      ext.send({ type: 'ask_delta', requestId: m.requestId, text: '甲乙' });
      ext.send({ type: 'ask_result', requestId: m.requestId, result: { answer: '甲乙丙' } });
    };
    const res = await api(b, '/v1/messages', { model: 'claude-bridge', max_tokens: 32, stream: true, messages: [{ role: 'user', content: '写' }] },
      { token: null, headers: { 'x-api-key': b.token } });
    assert.equal(res.status, 200);
    const events = parseSse(res.body);
    const names = events.map((e) => e.event);
    assert.ok(names.includes('message_start'));
    assert.ok(names.includes('content_block_delta'));
    assert.ok(names.includes('message_stop'));
    const text = events.filter((e) => e.event === 'content_block_delta').map((e) => e.json.delta.text).join('');
    assert.equal(text, '甲乙丙');
    assert.equal(events.find((e) => e.event === 'message_delta').json.delta.stop_reason, 'end_turn');
  });

  await test('多轮拼接 + system/系统标签不转发', async () => {
    let seen = null;
    ext.onAsk = (m) => { seen = m.question; ext.answer(m.requestId, 'answer2'); };
    const res = await api(b, '/v1/chat/completions', {
      model: 'm', stream: false,
      messages: [
        { role: 'system', content: 'SYSTEM-PROMPT-SHOULD-NOT-LEAK' },
        { role: 'user', content: '第一问\n<system-reminder>隐藏提示不应转发</system-reminder>' },
        { role: 'assistant', content: '第一答' },
        { role: 'user', content: '第二问' },
      ],
    });
    assert.equal(res.status, 200);
    assert.ok(seen.includes('<previous_conversation>'), '应拼接历史');
    assert.ok(seen.includes('User: 第一问'));
    assert.ok(seen.includes('Assistant: 第一答'));
    assert.ok(seen.includes('<current_question>\n第二问\n</current_question>'));
    assert.ok(!seen.includes('SYSTEM-PROMPT-SHOULD-NOT-LEAK'), 'system 不应转发');
    assert.ok(!seen.includes('隐藏提示不应转发'), '<system-reminder> 标签应剥离');
  });

  await test('超长历史截断：从最早轮次丢弃（≤8000 字符）', async () => {
    let seen = null;
    ext.onAsk = (m) => { seen = m.question; ext.answer(m.requestId, 'ok'); };
    const long = 'A'.repeat(5000);
    await api(b, '/v1/chat/completions', {
      model: 'm',
      messages: [
        { role: 'user', content: '旧问题' + long },
        { role: 'assistant', content: '旧回答' + long },
        { role: 'user', content: '最新问题' },
      ],
    });
    assert.ok(seen.includes('Assistant: 旧回答'), '保留较近的轮次');
    assert.ok(!seen.includes('User: 旧问题'), '最早的轮次应被丢弃');
  });

  await test('旧版扩展（无 ask_delta）假流式兜底', async () => {
    const answer = 'x'.repeat(2000);
    ext.onAsk = (m) => ext.send({ type: 'ask_result', requestId: m.requestId, result: { answer } });
    const res = await api(b, '/v1/chat/completions', { model: 'm', stream: true, messages: [{ role: 'user', content: '长答' }] });
    assert.equal(res.status, 200);
    const events = parseSse(res.body);
    assert.equal(sseText(events), answer);
    assert.equal(events.at(-1).data, '[DONE]');
  });

  await test('ask_delta 快照换算：重复不重发、回缩忽略、尾差补发', async () => {
    ext.onAsk = async (m) => {
      for (const t of ['你', '你好', '你好', '你', '你好，世']) {
        ext.send({ type: 'ask_delta', requestId: m.requestId, text: t });
      }
      await sleep(20);
      ext.send({ type: 'ask_result', requestId: m.requestId, result: { answer: '你好，世界' } });
    };
    const res = await api(b, '/v1/chat/completions', { model: 'm', stream: true, messages: [{ role: 'user', content: '换算' }] });
    const events = parseSse(res.body);
    const chunks = events
      .filter((e) => e.json && e.json.choices && e.json.choices[0] && e.json.choices[0].delta && e.json.choices[0].delta.content)
      .map((e) => e.json.choices[0].delta.content);
    assert.equal(chunks.join(''), '你好，世界');
    assert.equal(chunks.length, 4, '应为 你/好/，世/界 四段（重复与回缩不产生输出）');
  });

  await test('请求校验：无 user 消息 400 / 非法 JSON 400 / 未知端点 404', async () => {
    const noUser = await api(b, '/v1/chat/completions', { model: 'm', messages: [{ role: 'assistant', content: '只有回答' }] });
    assert.equal(noUser.status, 400);
    const badJson = await api(b, '/v1/chat/completions', undefined, { rawBody: 'not-json' });
    assert.equal(badJson.status, 400);
    const nf = await api(b, '/v1/nope', {});
    assert.equal(nf.status, 404);
  });

  await test('CORS 白名单：放行 / 拒绝 / null 拒绝 / 预检', async () => {
    ext.onAsk = (m) => ext.answer(m.requestId, 'cors-ok');
    const okRes = await api(b, '/v1/chat/completions', { model: 'm', messages: [{ role: 'user', content: 'cors' }] }, { origin: 'https://opensound.world' });
    assert.equal(okRes.status, 200);
    assert.equal(okRes.headers['access-control-allow-origin'], 'https://opensound.world');
    const localRes = await api(b, '/v1/chat/completions', { model: 'm', messages: [{ role: 'user', content: 'cors' }] }, { origin: 'http://localhost:5173' });
    assert.equal(localRes.status, 200, 'localhost 通配应放行');
    const evil = await api(b, '/v1/chat/completions', { model: 'm', messages: [{ role: 'user', content: 'x' }] }, { origin: 'https://evil.example.com' });
    assert.equal(evil.status, 403);
    assert.equal(JSON.parse(evil.body).error.type, 'permission_error');
    const nul = await api(b, '/v1/chat/completions', { model: 'm', messages: [{ role: 'user', content: 'x' }] }, { origin: 'null' });
    assert.equal(nul.status, 403, 'Origin: null 一律拒绝');
    const pre = await api(b, '/v1/chat/completions', undefined, { method: 'OPTIONS', origin: 'https://opensound.world' });
    assert.equal(pre.status, 204);
    assert.equal(pre.headers['access-control-allow-methods'], 'POST, GET, OPTIONS');
    const preEvil = await api(b, '/v1/chat/completions', undefined, { method: 'OPTIONS', origin: 'https://evil.example.com' });
    assert.equal(preEvil.status, 403);
  });

  await test('set_origins 动态添加网页白名单（持久化 config.json）', async () => {
    ext.onAsk = (m) => ext.answer(m.requestId, 'hi');
    ext.send({ type: 'set_origins', origins: ['https://myapp.example.com'] });
    await waitFor(() => {
      try { return fs.readFileSync(path.join(b.dir, 'config.json'), 'utf8').includes('myapp.example.com'); } catch (e) { return false; }
    }, { what: 'config.json 写入 extraOrigins' });
    const res = await api(b, '/v1/chat/completions', { model: 'm', messages: [{ role: 'user', content: 'hi' }] }, { origin: 'https://myapp.example.com' });
    assert.equal(res.status, 200);
    assert.equal(res.headers['access-control-allow-origin'], 'https://myapp.example.com');
  });

  await test('tabu_site / images 透传（无效项过滤，≤6 截断）', async () => {
    ext.onAsk = (m) => ext.answer(m.requestId, '收到附件');
    const images = Array.from({ length: 7 }, (_, i) => ({ name: `f${i}.pdf`, dataUrl: 'data:application/pdf;base64,QUJD' }));
    images.push({ name: 'bad.txt', dataUrl: 'https://not-a-data-url' });
    const res = await api(b, '/v1/chat/completions', { model: 'm', tabu_site: 'kimi', images, messages: [{ role: 'user', content: '看图' }] });
    assert.equal(res.status, 200);
    const last = ext.received.ask.at(-1);
    assert.equal(last.site, 'kimi');
    assert.equal(last.images.length, 6);
    assert.ok(last.images.every((it) => it.dataUrl.startsWith('data:')));
  });

  await test('/v0/diag/probe 透传（action 白名单，缺省 probe）', async () => {
    ext.onDiag = (m) => ext.send({ type: 'diag_result', requestId: m.requestId, result: { ok: true, tool: 'probe:' + m.action, site: m.site } });
    const res = await api(b, '/v0/diag/probe', { site: 'kimi', action: 'scan' });
    assert.equal(res.status, 200);
    const j = JSON.parse(res.body);
    assert.equal(j.tool, 'probe:scan');
    assert.equal(j.site, 'kimi');
    const res2 = await api(b, '/v0/diag/probe', { site: 'deepseek' });
    assert.equal(JSON.parse(res2.body).tool, 'probe:probe');
  });

  await test('/v0/diag/health 透传（refresh 标志）', async () => {
    ext.onDiag = (m) => ext.send({ type: 'diag_result', requestId: m.requestId, result: { kimi: { state: 'ok' }, refresh: m.refresh === true } });
    const res = await api(b, '/v0/diag/health', { refresh: true });
    assert.equal(res.status, 200);
    assert.equal(JSON.parse(res.body).refresh, true);
  });

  // ---------- 套件 2：端口顺延 ----------
  console.log('套件 2：端口顺延');
  await test('HTTP 端口占用自动顺延 + http-port 文件写实际端口', async () => {
    const p1 = await freePort();
    const p2 = await freePort();
    const blocker = net.createServer();
    await new Promise((resolve, reject) => {
      blocker.once('error', reject);
      blocker.listen(p1, '127.0.0.1', resolve);
    });
    try {
      const b2 = await startBridge({ TABU_BRIDGE_HTTP_PORT_CANDIDATES: p1 + ',' + p2 });
      assert.equal(b2.httpPort, p2, '应顺延到第二个候选端口');
      const res = await rawHttp(p2, { path: '/', method: 'GET' });
      assert.equal(res.status, 200);
    } finally {
      blocker.close();
    }
  });

  // ---------- 套件 3：多浏览器偏好路由 ----------
  console.log('套件 3：多浏览器偏好路由');
  await test('TABU_BRIDGE_PREFER_UA 固定路由 + 偏好离线回落最新连接', async () => {
    const b3 = await startBridge({ TABU_BRIDGE_PREFER_UA: 'Edg/' });
    const edge = new FakeExt({ port: b3.wsPort, ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36 Edg/120.0' });
    await edge.ready;
    const chrome = new FakeExt({ port: b3.wsPort, ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/121.0 Safari/537.36' });
    await chrome.ready; // 后连接 = 无偏好时的默认路由目标
    edge.onAsk = (m) => edge.answer(m.requestId, '来自 Edge');
    chrome.onAsk = (m) => chrome.answer(m.requestId, '来自 Chrome');
    let res = await api(b3, '/v1/chat/completions', { model: 'm', messages: [{ role: 'user', content: '路由' }] });
    assert.equal(JSON.parse(res.body).choices[0].message.content, '来自 Edge', '偏好 Edg/ 时应路由到 Edge');
    assert.equal(edge.received.ask.length, 1);
    assert.equal(chrome.received.ask.length, 0);
    // 偏好浏览器断开 → 回落到最新连接
    edge.close();
    await sleep(200);
    res = await api(b3, '/v1/chat/completions', { model: 'm', messages: [{ role: 'user', content: '回落' }] });
    assert.equal(JSON.parse(res.body).choices[0].message.content, '来自 Chrome');
    chrome.close();
  });

  ext.close();
  stopAll();
}

run().then(() => {
  console.log('─'.repeat(64));
  const total = passed + failures.length;
  console.log(`结果：通过 ${passed}/${total}${failures.length ? '，失败 ' + failures.length : '，全部通过 ✅'}`);
  process.exitCode = failures.length ? 1 : 0;
}).catch((e) => {
  console.error('测试运行失败：', e);
  process.exitCode = 1;
});
