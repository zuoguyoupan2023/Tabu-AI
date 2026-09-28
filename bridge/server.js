#!/usr/bin/env node
/**
 * Tab AI 终端桥接服务（bridge-server）v2
 * ============================================================
 * 把浏览器里已登录的免费 AI 网页（ChatGPT 等）变成一个本地 AI 服务，
 * 供终端工具与桌面/Web 应用接入——类似 Ollama 的本地端口，但后端是网页版 AI。
 *
 * 架构：
 *   终端 (Claude Code) / 桌面应用 (Chatbox, CherryStudio...) / 网页应用 (OpenSound...)
 *     │  ANTHROPIC_BASE_URL / OpenAI Base URL = http://127.0.0.1:<HTTP_PORT>/v1
 *     │  API Key = <token>
 *     ▼  HTTP :11434 起（被占用自动顺延）——同时模拟两种协议：
 *        · Anthropic Messages API  POST /v1/messages        （Claude Code / Cursor）
 *        · OpenAI 兼容 API         POST /v1/chat/completions（Chatbox / CherryStudio / LobeChat 等）
 *   bridge-server.js  (本文件)
 *     ▼  WebSocket :9527（固定）
 *   Chrome 扩展 (background Service Worker 作为 WS 客户端)
 *     ▼  chrome.scripting.executeScript
 *   ChatGPT 页面
 *
 * 流式：扩展在 ChatGPT 回复过程中实时上报增量（ask_delta），
 *       本服务转发为真正的 SSE 流（不再等完整答案后假装分块）。
 *       旧版扩展不上报增量时，自动退回"完整答案分块"模式，保持兼容。
 *
 * 安全：
 *   - 仅绑定 127.0.0.1，不对外网开放
 *   - Token 认证：首次运行自动生成随机 Token 并打印/保存
 *   - CORS 来源白名单：浏览器网页必须来自白名单 Origin 才能调用（终端/桌面应用无 Origin 头，不受限）
 *     · 默认放行：opensound.world、world.opensound.local（OpenSound 应用）及 localhost/127.0.0.1 任意端口
 *     · 用户可在扩展「管理设置 → 终端桥接」添加（经 WS 同步到本服务并持久化），
 *       或编辑 ~/.tabu-bridge/config.json 的 extraOrigins，或设 TABU_BRIDGE_EXTRA_ORIGINS 环境变量
 *
 * 运行：node bridge/server.js        （依赖 npm i ws，其余用 Node 内置 http）
 */
'use strict';

const http = require('http');
const os = require('os');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');

const HOST = '127.0.0.1';
const WS_PORT = parseInt(process.env.TABU_BRIDGE_WS_PORT || '9527', 10); // 扩展侧硬编码，保持固定
const REQUEST_TIMEOUT_MS = parseInt(process.env.TABU_BRIDGE_TIMEOUT || '120000', 10); // 等 ChatGPT 回复最长 2 分钟
// HTTP 端口：默认 11434（与 Ollama 同端口便于记忆）；被占用时自动顺延，避免和 Ollama 冲突。
// 用 TABU_BRIDGE_HTTP_PORT 显式指定端口时不再顺延（指定了就要用，失败直接退出）。
const EXPLICIT_HTTP_PORT = process.env.TABU_BRIDGE_HTTP_PORT ? parseInt(process.env.TABU_BRIDGE_HTTP_PORT, 10) : 0;
const HTTP_PORT_CANDIDATES = EXPLICIT_HTTP_PORT ? [EXPLICIT_HTTP_PORT] : [11434, 11435, 11436, 11437, 9528, 8117];
let HTTP_PORT = HTTP_PORT_CANDIDATES[0];

// ========================== Token 管理 ==========================
const CONFIG_DIR = path.join(os.homedir(), '.tabu-bridge');
const TOKEN_FILE = path.join(CONFIG_DIR, 'token');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
let TOKEN = process.env.TABU_BRIDGE_TOKEN || '';
if (!TOKEN) {
  try {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
    if (fs.existsSync(TOKEN_FILE)) {
      TOKEN = fs.readFileSync(TOKEN_FILE, 'utf8').trim();
    }
    if (!TOKEN) {
      TOKEN = 'tabu_' + crypto.randomBytes(16).toString('hex');
      fs.writeFileSync(TOKEN_FILE, TOKEN, { mode: 0o600 });
    }
  } catch (e) {
    TOKEN = 'tabu_' + crypto.randomBytes(16).toString('hex');
  }
}

// ========================== 网页来源（Origin）白名单 ==========================
// 终端工具、桌面应用（Chatbox/CherryStudio 等）不发 Origin 头，不受此限制；
// 只有浏览器里的网页会带 Origin——这是防"恶意网页驱动本机桥接"的防线（配合 Token 双保险）。
const DEFAULT_ORIGINS = [
  'https://opensound.world',
  'http://world.opensound.local', 'https://world.opensound.local',
  'http://world.opensound.local:*', 'https://world.opensound.local:*',
  'http://localhost:*', 'https://localhost:*',
  'http://127.0.0.1:*', 'https://127.0.0.1:*'
];
function normOrigin(o) {
  return String(o || '').trim().toLowerCase().replace(/\/+$/, '');
}
function readConfigExtra() {
  try {
    const cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    return Array.isArray(cfg.extraOrigins) ? cfg.extraOrigins : [];
  } catch (e) { return []; }
}
function persistExtraOrigins(origins) {
  try {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
    let cfg = {};
    try { cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')); } catch (e) {}
    cfg.extraOrigins = origins;
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2));
  } catch (e) { console.warn('[Bridge] ⚠️ 无法写入 config.json:', e.message); }
}
const envExtra = String(process.env.TABU_BRIDGE_EXTRA_ORIGINS || '').split(/[\s,]+/).filter(Boolean);
let extOrigins = []; // 扩展设置页下发（已含持久化）
function allOrigins() {
  return [...new Set([...DEFAULT_ORIGINS, ...readConfigExtra(), ...envExtra, ...extOrigins].map(normOrigin).filter(Boolean))];
}
function originAllowed(origin) {
  if (!origin) return true; // 非浏览器客户端（终端 / 桌面应用）
  const o = normOrigin(origin);
  if (!o || o === 'null') return false; // 沙箱 iframe / file:// 的 Origin 为 "null"，一律拒绝
  return allOrigins().some((rule) =>
    rule.endsWith(':*') ? o.startsWith(rule.slice(0, -1)) : o === rule
  );
}
function corsHeaders(req) {
  const origin = req.headers && req.headers.origin;
  if (!origin || !originAllowed(origin)) return {};
  return { 'Access-Control-Allow-Origin': origin, 'Vary': 'Origin' };
}

function authOk(req) {
  const h = req.headers || {};
  const apiKey = h['x-api-key'] ? String(h['x-api-key']).replace(/^Bearer\s+/i, '').trim() : '';
  const auth = h['authorization'] ? String(h['authorization']).replace(/^Bearer\s+/i, '').trim() : '';
  const tabu = h['x-tabu-token'] ? String(h['x-tabu-token']).trim() : '';
  return TOKEN ? (apiKey === TOKEN || auth === TOKEN || tabu === TOKEN) : true;
}

// ========================== WebSocket（扩展侧） ==========================
const wss = new WebSocketServer({ host: HOST, port: WS_PORT });
let extSocket = null;          // 已认证的扩展连接（同一时刻只保留一个活跃连接）
const pendingRequests = new Map(); // requestId -> { resolve, timer, session, streamed }

wss.on('connection', (socket) => {
  socket.authed = false;
  socket.on('message', (data) => {
    let msg;
    try { msg = JSON.parse(String(data)); } catch (e) { return; }

    if (msg.type === 'auth') {
      if (TOKEN && msg.token !== TOKEN) {
        socket.send(JSON.stringify({ type: 'auth_error', message: 'Token 不正确' }));
        socket.close();
        return;
      }
      socket.authed = true;
      if (extSocket && extSocket !== socket) { try { extSocket.close(); } catch (e) {} }
      extSocket = socket;
      socket.send(JSON.stringify({ type: 'auth_ok' }));
      // 告知扩展实际 HTTP 端口（11434 被占用自动顺延后，扩展设置页能显示正确地址）
      try { socket.send(JSON.stringify({ type: 'bridge_info', httpPort: HTTP_PORT, origins: allOrigins() })); } catch (e) {}
      console.log('[Bridge] 扩展已连接 ✔');
    } else if (msg.type === 'set_origins' && socket.authed && Array.isArray(msg.origins)) {
      // 扩展设置页下发的额外网页来源：合并进白名单并持久化到 config.json
      extOrigins = [...new Set(msg.origins.map(normOrigin).filter((o) => o && o !== 'null'))];
      persistExtraOrigins(extOrigins);
      console.log('[Bridge] 网页来源白名单已更新，当前共 ' + allOrigins().length + ' 条：\n  ' + allOrigins().join('\n  '));
    } else if (msg.type === 'ask_delta' && socket.authed) {
      // 扩展上报的"当前已生成完整文本"，换算成增量推给 SSE
      const pending = pendingRequests.get(msg.requestId);
      if (pending && pending.session && typeof msg.text === 'string') {
        pending.streamed = pending.session.delta(msg.text) || pending.streamed;
      }
    } else if (msg.type === 'ask_result' && socket.authed) {
      const pending = pendingRequests.get(msg.requestId);
      if (pending) {
        pendingRequests.delete(msg.requestId);
        clearTimeout(pending.timer);
        pending.resolve({ result: msg.result || {}, ok: true, streamed: !!pending.streamed });
      }
    }
  });
  socket.on('close', () => {
    if (extSocket === socket) {
      extSocket = null;
      console.log('[Bridge] 扩展已断开，等待重连…');
    }
  });
  // 服务端心跳，保持扩展 Service Worker 存活
  socket.on('pong', () => { socket.isAlive = true; });
  socket.isAlive = true;
});

wss.on('listening', () => console.log(`[Bridge] WebSocket 服务监听 ws://${HOST}:${WS_PORT}`));
wss.on('error', (err) => {
  console.error(`[Bridge] ❌ WebSocket 端口 ${WS_PORT} 不可用：${err.message}`);
  console.error('   可能是端口被占用。可设置环境变量 TABU_BRIDGE_WS_PORT 换端口（扩展侧需同步修改）。');
  process.exit(1);
});

setInterval(() => {
  for (const socket of wss.clients) {
    if (socket.isAlive === false) { socket.terminate(); continue; }
    socket.isAlive = false;
    try { socket.ping(); } catch (e) {}
  }
}, 30000);

// ========================== 工具 ==========================
function extractText(content) {
  if (!content) return '';
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((b) => (typeof b === 'string' ? b : b && (b.text || b.content || '')))
      .join('\n');
  }
  return '';
}

// 去掉 Claude Code / Cursor 注入到 user 消息里的系统提示词标签，只保留真正的内容
function cleanQuestion(text) {
  return (text || '')
    .replace(/<system-reminder>[\s\S]*?<\/system-reminder>/gi, '')
    .replace(/<system_warning>[\s\S]*?<\/system_warning>/gi, '')
    .replace(/<environment_details>[\s\S]*?<\/environment_details>/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// 多轮上下文：把此前的 user/assistant 对话拼成参考材料，连同最新问题一起交给网页 AI。
// system 消息（编程工具注入的巨型提示词 + 工具定义）不转发——网页 AI 用不上，只会污染输入框。
const MAX_HIST_CHARS = 8000;
function buildPromptFromMessages(messages) {
  if (!Array.isArray(messages)) return null;
  const turns = [];
  for (const m of messages) {
    if (!m || (m.role !== 'user' && m.role !== 'assistant')) continue;
    const text = cleanQuestion(extractText(m.content));
    if (text) turns.push({ role: m.role, text });
  }
  let lastUser = -1;
  for (let i = turns.length - 1; i >= 0; i--) {
    if (turns[i].role === 'user') { lastUser = i; break; }
  }
  if (lastUser === -1) return null;
  const question = turns[lastUser].text;
  const lines = turns.slice(0, lastUser).map((t) => (t.role === 'user' ? 'User: ' : 'Assistant: ') + t.text);
  let hist = lines.join('\n\n');
  while (hist.length > MAX_HIST_CHARS && lines.length > 1) {
    lines.shift(); // 太长时从最早的一轮开始丢
    hist = lines.join('\n\n');
  }
  const prompt = hist
    ? '<previous_conversation>\n' + hist + '\n</previous_conversation>\n\n<current_question>\n' + question + '\n</current_question>'
    : question;
  return { question, prompt };
}

function estTokens(text) { return Math.max(1, Math.ceil(String(text || '').length / 4)); }

function sendJson(req, res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, Object.assign({
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Headers': 'content-type, x-api-key, x-tabu-token, authorization, anthropic-version, anthropic-beta',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  }, corsHeaders(req)));
  res.end(body);
}

// ========================== SSE 流式会话 ==========================
// 两种渲染格式：'anthropic'（message_start → content_block_delta…）与 'openai'（chat.completion.chunk…）。
// delta(fullText) 入参是"当前已生成的完整文本"（扩展上报），内部换算增量，天然防乱序/丢块。
class SseSession {
  constructor(req, res, format, model) {
    this.res = res;
    this.format = format;
    this.model = model || 'claude-bridge';
    this.acc = '';
    this.closed = false;
    this.msgId = (format === 'openai' ? 'chatcmpl-' : 'msg_') + crypto.randomBytes(8).toString('hex');
    this.created = Math.floor(Date.now() / 1000);
    res.writeHead(200, Object.assign({
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    }, corsHeaders(req)));
    if (format === 'anthropic') {
      this.send('message_start', {
        type: 'message_start', message: {
          id: this.msgId, type: 'message', role: 'assistant', model: this.model,
          content: [], stop_reason: null, stop_sequence: null,
          usage: { input_tokens: 0, output_tokens: 0 },
        },
      });
      this.send('content_block_start', { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } });
    } else {
      this.chunk({ role: 'assistant', content: '' });
    }
  }
  send(event, data) {
    if (this.closed) return false;
    try { this.res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); return true; }
    catch (e) { this.closed = true; return false; }
  }
  chunk(delta, finishReason) {
    return this.send(null, {
      id: this.msgId, object: 'chat.completion.chunk', created: this.created, model: this.model,
      choices: [{ index: 0, delta, finish_reason: finishReason == null ? null : finishReason }],
    });
  }
  // 入参：扩展上报的完整文本快照。返回是否有新内容输出。
  delta(fullText) {
    if (this.closed) return false;
    const t = String(fullText || '');
    if (!t.startsWith(this.acc)) return false; // 文本回缩（极少见）：忽略，等待最终 ask_result
    const tail = t.slice(this.acc.length);
    if (!tail) return false;
    this.acc += tail;
    if (this.format === 'anthropic') {
      this.send('content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: tail } });
    } else {
      this.chunk({ content: tail });
    }
    return true;
  }
  finish(answer) {
    if (this.closed) return;
    const finalText = String(answer || this.acc || '');
    // 兜底：扩展没上报增量（旧版）或最终文本比增量快照长 → 补发差值
    const tail = finalText.startsWith(this.acc) ? finalText.slice(this.acc.length) : '';
    if (tail) this.delta(this.acc + tail);
    if (this.format === 'anthropic') {
      this.send('content_block_stop', { type: 'content_block_stop', index: 0 });
      this.send('message_delta', {
        type: 'message_delta',
        delta: { stop_reason: 'end_turn', stop_sequence: null },
        usage: { output_tokens: estTokens(finalText) },
      });
      this.send('message_stop', { type: 'message_stop' });
    } else {
      this.chunk({}, 'stop');
      this.send(null, {
        id: this.msgId, object: 'chat.completion.chunk', created: this.created, model: this.model,
        choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
        usage: { prompt_tokens: 0, completion_tokens: estTokens(finalText), total_tokens: estTokens(finalText) },
      });
      try { this.res.write('data: [DONE]\n\n'); } catch (e) {}
    }
    this.closed = true;
    try { this.res.end(); } catch (e) {}
  }
  error(message) {
    if (this.closed) return;
    if (this.format === 'anthropic') {
      this.send('error', { type: 'error', error: { type: 'api_error', message: String(message || '内部错误') } });
    } else {
      this.send(null, { error: { message: String(message || '内部错误'), type: 'api_error', code: 'bridge_error' } });
      try { this.res.write('data: [DONE]\n\n'); } catch (e) {}
    }
    this.closed = true;
    try { this.res.end(); } catch (e) {}
  }
}

// 旧版扩展兼容：没有 ask_delta 时，把完整答案按块经既有 SSE 会话假装流式
//（会话在请求进入时已建立，这里只做分块输出，绝不能再 writeHead）
function fakeStreamInto(session, text) {
  const chunks = String(text || '').match(/.{1,800}/gs) || [];
  let acc = '';
  let i = 0;
  const timer = setInterval(() => {
    if (i < chunks.length) {
      acc += chunks[i];
      session.delta(acc);
      i++;
    } else {
      clearInterval(timer);
      session.finish(text);
    }
  }, 40);
}

// ========================== HTTP 服务（Anthropic + OpenAI 双协议适配层） ==========================
const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${HOST}:${HTTP_PORT}`);

  // 服务信息（免 Token，供连通性检查 / 应用发现）
  if (url.pathname === '/' && req.method === 'GET') {
    return sendJson(req, res, 200, {
      name: 'Tab AI Bridge',
      description: '把浏览器免费网页 AI（ChatGPT 等）变成本地 AI 服务',
      endpoints: {
        anthropic: 'POST /v1/messages',
        openai: 'POST /v1/chat/completions',
        models: 'GET /v1/models',
      },
      baseUrls: { anthropic: `http://${HOST}:${HTTP_PORT}`, openai_compatible: `http://${HOST}:${HTTP_PORT}/v1` },
      allowedWebOrigins: allOrigins(),
      howTo: {
        claudeCode: `export ANTHROPIC_BASE_URL="http://${HOST}:${HTTP_PORT}" ANTHROPIC_API_KEY="<token>"`,
        chatbox: `OpenAI 兼容提供商，API Host=http://${HOST}:${HTTP_PORT}/v1，API Key=<token>，模型名任意（如 claude-bridge）`,
      },
    });
  }

  // CORS 预检：白名单来源回显授权头；其它来源拒绝
  if (req.method === 'OPTIONS') {
    const origin = req.headers.origin;
    if (origin && !originAllowed(origin)) {
      return sendJson(req, res, 403, { type: 'error', error: { type: 'permission_error', message: '来源不在网页白名单：' + origin + '。可在扩展「管理设置 → 终端桥接」添加，或编辑 ~/.tabu-bridge/config.json' } });
    }
    res.writeHead(204, Object.assign({
      'Access-Control-Allow-Headers': 'content-type, x-api-key, x-tabu-token, authorization, anthropic-version, anthropic-beta',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    }, corsHeaders(req)));
    res.end();
    return;
  }

  // 浏览器网页请求：Origin 必须在白名单（终端/桌面应用无 Origin，跳过）
  const reqOrigin = req.headers.origin;
  if (reqOrigin && !originAllowed(reqOrigin)) {
    return sendJson(req, res, 403, { type: 'error', error: { type: 'permission_error', message: '来源不在网页白名单：' + reqOrigin + '。可在扩展「管理设置 → 终端桥接」添加。' } });
  }

  if (!authOk(req)) {
    return sendJson(req, res, 401, { type: 'error', error: { type: 'authentication_error', message: 'Token 认证失败：请把 API Key 设为桥接服务的 Token（~/.tabu-bridge/token）' } });
  }

  // GET /v1/models（OpenAI 风格，兼容 Anthropic 客户端）
  if ((url.pathname === '/v1/models' || url.pathname === '/models') && req.method === 'GET') {
    return sendJson(req, res, 200, {
      object: 'list',
      data: [
        { id: 'claude-bridge', object: 'model', type: 'model', display_name: 'ChatGPT via Tab AI Bridge', owned_by: 'tabu' },
        { id: 'chatgpt-web', object: 'model', type: 'model', display_name: 'ChatGPT 免费网页版 (Tab AI Bridge)', owned_by: 'tabu' },
      ],
    });
  }

  // POST /v1/messages/count_tokens —— Claude Code 会调用，返回估算值避免报错
  if (url.pathname === '/v1/messages/count_tokens' && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => { body += c; if (body.length > 2e6) body = body.slice(0, 2e6); });
    req.on('end', () => {
      let parsed = {};
      try { parsed = JSON.parse(body || '{}'); } catch (e) {}
      const text = extractText(parsed.messages);
      return sendJson(req, res, 200, { input_tokens: estTokens(text), output_tokens: 0 });
    });
    return;
  }

  // POST /v1/messages —— Anthropic Messages API（Claude Code / Cursor）
  if (url.pathname === '/v1/messages' && req.method === 'POST') {
    return handleAskRequest(req, res, 'anthropic');
  }

  // POST /v1/chat/completions —— OpenAI 兼容（Chatbox / CherryStudio / LobeChat / 任意自定义提供商）
  if ((url.pathname === '/v1/chat/completions' || url.pathname === '/chat/completions') && req.method === 'POST') {
    return handleAskRequest(req, res, 'openai');
  }

  sendJson(req, res, 404, { type: 'error', error: { type: 'not_found_error', message: '未知端点 ' + url.pathname } });
});

// 两种协议共用的问答主流程：解析请求 → 组 prompt（含多轮上下文）→ WS 发给扩展 → SSE/JSON 返回
function handleAskRequest(req, res, protocol) {
  let body = '';
  req.on('data', (chunk) => { body += chunk; if (body.length > 2e6) { body = body.slice(0, 2e6); } });
  req.on('end', async () => {
    let parsed;
    try { parsed = JSON.parse(body || '{}'); } catch (e) {
      return sendJson(req, res, 400, { type: 'error', error: { type: 'invalid_request_error', message: '请求体不是合法 JSON' } });
    }
    const model = parsed.model || 'claude-bridge';
    const stream = !!parsed.stream;
    const built = buildPromptFromMessages(parsed.messages);
    if (!built || !built.question.trim()) {
      return sendJson(req, res, 400, { type: 'error', error: { type: 'invalid_request_error', message: 'messages 中没有找到用户问题' } });
    }
    console.log(`[Bridge] 请求[${protocol}] model=${model} stream=${stream} 多轮=${(parsed.messages || []).length}条 问题长度=${built.question.length} 开头=${built.question.slice(0, 60).replace(/\n/g, ' ')}`);

    if (!extSocket) {
      return sendJson(req, res, 503, {
        type: 'error',
        error: { type: 'overloaded_error',
          message: '未检测到 Chrome 扩展连接。请：1) 打开浏览器加载 Tab AI 扩展；2) 在插件「管理设置」里填入桥接 Token 并保存。' },
      });
    }

    // 生成 requestId 并发给扩展，等待扩展操作 ChatGPT 并返回
    const requestId = 'req_' + crypto.randomBytes(8).toString('hex');
    let session = null; // 流式会话（stream=true 时创建，收尾/报错都要用它）
    const answer = await new Promise((resolve) => {
      const timer = setTimeout(() => {
        if (pendingRequests.has(requestId)) {
          pendingRequests.delete(requestId);
          const err = '等待 ChatGPT 回复超时，请确认 ChatGPT 标签页已打开并登录。';
          if (session) { session.error(err); resolve({ error: err, noReply: true }); }
          else resolve({ error: err });
        }
      }, REQUEST_TIMEOUT_MS);
      const entry = { resolve, timer, session: null, streamed: false };
      // 流式请求：立刻开 SSE 会话，扩展上报的增量实时转发
      if (stream) {
        try {
          entry.session = new SseSession(req, res, protocol, model);
          session = entry.session;
        } catch (e) {
          clearTimeout(timer);
          return resolve({ error: '建立 SSE 流失败: ' + e.message });
        }
      }
      pendingRequests.set(requestId, entry);
      try {
        extSocket.send(JSON.stringify({ type: 'ask', requestId, question: built.prompt, model, stream }));
      } catch (e) {
        pendingRequests.delete(requestId); clearTimeout(timer);
        if (entry.session) entry.session.error('向扩展发送指令失败: ' + e.message);
        resolve({ error: '向扩展发送指令失败: ' + e.message, noReply: true });
      }
    });

    if (answer.error) {
      // 流式会话已开时 headers 已发出，只能走 SSE 错误事件，不能回 JSON
      if (session) session.error(answer.error);
      else sendJson(req, res, 502, { type: 'error', error: { type: 'api_error', message: answer.error } });
      return;
    }
    const text = (answer.result && answer.result.answer) || '';

    if (answer.streamed) {
      // 真流式：ask_delta 已实时转发，这里补发差值并收尾
      session.finish(text);
      return;
    }
    if (stream && session) {
      // 客户端要流式但扩展没上报增量（旧版扩展）→ 用既有会话分块假流式
      fakeStreamInto(session, text);
      return;
    }
    if (protocol === 'anthropic') {
      sendJson(req, res, 200, {
        id: 'msg_' + crypto.randomBytes(8).toString('hex'),
        type: 'message',
        role: 'assistant',
        content: text ? [{ type: 'text', text }] : [],
        model,
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: { input_tokens: 0, output_tokens: estTokens(text) },
      });
    } else {
      sendJson(req, res, 200, {
        id: 'chatcmpl-' + crypto.randomBytes(8).toString('hex'),
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model,
        choices: [{ index: 0, message: { role: 'assistant', content: text }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 0, completion_tokens: estTokens(text), total_tokens: estTokens(text) },
      });
    }
  });
}

// ========================== 启动（HTTP 端口防冲突） ==========================
let started = false;
// 注意：不要用 server.listen(port, cb) 的回调——顺延重试时旧回调仍挂在 'listening' 上会先触发，
// 导致横幅/端口文件写成过期端口。统一在 listening 事件里读 HTTP_PORT（即实际端口）。
server.once('listening', () => {
  if (started) return;
  started = true;
  const port = HTTP_PORT;
  try { fs.mkdirSync(CONFIG_DIR, { recursive: true }); fs.writeFileSync(path.join(CONFIG_DIR, 'http-port'), String(port)); } catch (e) {}
  console.log('');
  console.log('┌──────────────────────────────────────────────────────────────┐');
  console.log('│  Tab AI 桥接服务已启动（免费网页 AI → 本地 API）               │');
  console.log(`│  HTTP : ${HOST}:${port}                                       │`);
  console.log(`│  WS   : ${HOST}:${WS_PORT}（Chrome 扩展接入，固定）            │`);
  console.log('└──────────────────────────────────────────────────────────────┘');
  console.log('');
  console.log('  📌 终端（Claude Code / Cursor，Anthropic 协议）：');
  console.log(`      export ANTHROPIC_BASE_URL="http://${HOST}:${port}"`);
  console.log(`      export ANTHROPIC_API_KEY="${TOKEN}"`);
  console.log('');
  console.log('  📌 桌面/网页应用（Chatbox / CherryStudio / OpenSound…，OpenAI 协议）：');
  console.log(`      API Host = http://${HOST}:${port}/v1   API Key = <上面的 Token>`);
  console.log('      模型名随意填（如 claude-bridge），支持流式输出');
  console.log('');
  console.log('  🔑 桥接 Token（请填入插件的「管理设置 → 终端桥接」）：');
  console.log(`      ${TOKEN}`);
  console.log('');
  console.log('  🌐 网页来源白名单（浏览器网页调用时校验 Origin）：');
  console.log('      ' + allOrigins().join('\n      '));
  console.log('      ＊ 用户可在扩展设置页添加，或编辑 ~/.tabu-bridge/config.json 的 extraOrigins');
  console.log('');
});
function tryListen(index) {
  const port = HTTP_PORT_CANDIDATES[index];
  if (port == null) {
    console.error('[Bridge] ❌ 没有可用端口（尝试过: ' + HTTP_PORT_CANDIDATES.join(', ') + '）。请用 TABU_BRIDGE_HTTP_PORT 指定一个空闲端口。');
    process.exit(1);
  }
  HTTP_PORT = port;
  server.once('error', (err) => {
    if (err.code === 'EADDRINUSE' && !EXPLICIT_HTTP_PORT) {
      console.warn(`[Bridge] ⚠️ HTTP 端口 ${port} 被占用（11434 是 Ollama 默认端口？）→ 自动尝试 ${HTTP_PORT_CANDIDATES[index + 1]}`);
      tryListen(index + 1);
      return;
    }
    console.error(`[Bridge] ❌ HTTP 端口 ${port} 不可用：${err.message}`);
    console.error('   可设置环境变量 TABU_BRIDGE_HTTP_PORT 换端口（终端 ANTHROPIC_BASE_URL / 应用 API Host 需同步修改）。');
    process.exit(1);
  });
  server.listen(port, HOST);
}
tryListen(0);
