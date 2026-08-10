#!/usr/bin/env node
/**
 * TabU 终端桥接服务（bridge-server）
 * ============================================================
 * 让 Claude Code / Cursor 等命令行工具通过本服务 → WebSocket →
 * Chrome 扩展 → ChatGPT 页面 实现问答闭环。
 *
 * 架构：
 *   终端 (Claude Code)
 *     │  环境变量 ANTHROPIC_BASE_URL=http://127.0.0.1:11434
 *     │           ANTHROPIC_API_KEY=<token>
 *     ▼  HTTP :11434  （模拟 Anthropic Messages API，含 SSE 流式）
 *   bridge-server.js  (本文件)
 *     ▼  WebSocket :9527
 *   Chrome 扩展 (background Service Worker 作为 WS 客户端)
 *     ▼  chrome.scripting.executeScript
 *   ChatGPT 页面
 *
 * 安全：
 *   - 仅绑定 127.0.0.1，不对外网开放
 *   - Token 认证：首次运行自动生成随机 Token 并打印/保存，
 *     终端用 ANTHROPIC_API_KEY 携带，扩展在选项中填入同一个 Token。
 *
 * 运行：node bridge/server.js        （依赖 npm i ws，其余用 Node 内置 http）
 * 仅需依赖：ws
 */
'use strict';

const http = require('http');
const os = require('os');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');

const HOST = '127.0.0.1';
const HTTP_PORT = parseInt(process.env.TABU_BRIDGE_HTTP_PORT || '11434', 10);
const WS_PORT = parseInt(process.env.TABU_BRIDGE_WS_PORT || '9527', 10);
const REQUEST_TIMEOUT_MS = parseInt(process.env.TABU_BRIDGE_TIMEOUT || '120000', 10); // 等 ChatGPT 回复最长 2 分钟

// ========================== Token 管理 ==========================
const CONFIG_DIR = path.join(os.homedir(), '.tabu-bridge');
const TOKEN_FILE = path.join(CONFIG_DIR, 'token');
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
const pendingRequests = new Map(); // requestId -> { resolve, timer }

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
      console.log('[Bridge] 扩展已连接 ✔');
    } else if (msg.type === 'ask_result' && socket.authed) {
      const pending = pendingRequests.get(msg.requestId);
      if (pending) {
        pendingRequests.delete(msg.requestId);
        clearTimeout(pending.timer);
        pending.resolve({ result: msg.result || {}, ok: true });
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

// 去掉 Claude Code 注入到 user 消息里的系统提示词标签，只保留真正的问题
function cleanQuestion(text) {
  return (text || '')
    .replace(/<system-reminder>[\s\S]*?<\/system-reminder>/gi, '')
    .replace(/<system_warning>[\s\S]*?<\/system_warning>/gi, '')
    .replace(/<environment_details>[\s\S]*?<\/environment_details>/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function sendJson(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'content-type, x-api-key, x-tabu-token, authorization, anthropic-version',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  });
  res.end(body);
}

// ========================== HTTP 服务（Anthropic API 适配层） ==========================
const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${HOST}:${HTTP_PORT}`);

  if (req.method === 'OPTIONS') {
    sendJson(res, 204, {});
    return;
  }
  if (!authOk(req)) {
    sendJson(res, 401, { type: 'error', error: { type: 'authentication_error', message: 'Token 认证失败：请把 ANTHROPIC_API_KEY 设为桥接服务的 Token' } });
    return;
  }

  // GET /v1/models
  if (url.pathname === '/v1/models' && req.method === 'GET') {
    sendJson(res, 200, { data: [{ id: 'claude-bridge', display_name: 'ChatGPT via TabU Bridge', type: 'model' }] });
    return;
  }

  // POST /v1/messages
  if (url.pathname === '/v1/messages' && req.method === 'POST') {
    console.log(`[Bridge] 收到请求 POST ${url.pathname}`);
    let body = '';
    req.on('data', (chunk) => { body += chunk; if (body.length > 2e6) { body = body.slice(0, 2e6); } });
    req.on('end', async () => {
      let parsed;
      try { parsed = JSON.parse(body || '{}'); } catch (e) {
        return sendJson(res, 400, { type: 'error', error: { type: 'invalid_request_error', message: '请求体不是合法 JSON' } });
      }
      const model = parsed.model || 'claude-bridge';
      const stream = !!parsed.stream;
      const lastUser = Array.isArray(parsed.messages) ? [...parsed.messages].reverse().find((m) => m && m.role === 'user') : null;
      const question = cleanQuestion(extractText(lastUser && lastUser.content));
      console.log(`[Bridge] 请求 model=${model} stream=${stream} 问题长度=${question.length} 开头=${question.slice(0, 60).replace(/\n/g, ' ')}`);
      if (!question.trim()) {
        return sendJson(res, 400, { type: 'error', error: { type: 'invalid_request_error', message: 'messages 中没有找到用户问题' } });
      }

      if (!extSocket) {
        return sendJson(res, 503, {
          type: 'error',
          error: { type: 'overloaded_error',
            message: '未检测到 Chrome 扩展连接。请：1) 打开浏览器加载 TabU 扩展；2) 在插件「管理设置」里填入桥接 Token 并保存。' },
        });
      }

      // 生成 requestId 并发给扩展，等待扩展操作 ChatGPT 并返回
      const requestId = 'req_' + crypto.randomBytes(8).toString('hex');
      const answer = await new Promise((resolve) => {
        const timer = setTimeout(() => {
          if (pendingRequests.has(requestId)) {
            pendingRequests.delete(requestId);
            resolve({ error: '等待 ChatGPT 回复超时，请确认 ChatGPT 标签页已打开并登录。' });
          }
        }, REQUEST_TIMEOUT_MS);
        pendingRequests.set(requestId, { resolve, timer });
        try {
          extSocket.send(JSON.stringify({ type: 'ask', requestId, question, model }));
        } catch (e) {
          pendingRequests.delete(requestId); clearTimeout(timer);
          resolve({ error: '向扩展发送指令失败: ' + e.message });
        }
      });

      if (answer.error) {
        return sendJson(res, 502, { type: 'error', error: { type: 'api_error', message: answer.error } });
      }
      const text = (answer.result && answer.result.answer) || '';

      if (stream) {
        streamSSE(res, text, model);
      } else {
        const stopReason = text ? 'end_turn' : 'end_turn';
        sendJson(res, 200, {
          id: 'msg_' + crypto.randomBytes(8).toString('hex'),
          type: 'message',
          role: 'assistant',
          content: text ? [{ type: 'text', text }] : [],
          model,
          stop_reason: stopReason,
          stop_sequence: null,
          usage: { input_tokens: 0, output_tokens: text.length },
        });
      }
    });
    return;
  }

  sendJson(res, 404, { type: 'error', error: { type: 'not_found_error', message: '未知端点 ' + url.pathname } });
});

function streamSSE(res, text, model) {
  const msgId = 'msg_' + crypto.randomBytes(8).toString('hex');
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });

  const send = (event, data) => { res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); };

  send('message_start', {
    type: 'message_start', message: {
      id: msgId, type: 'message', role: 'assistant', model,
      content: [], stop_reason: null, stop_sequence: null,
      usage: { input_tokens: 0, output_tokens: 0 },
    },
  });
  send('content_block_start', { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } });

  // 按块发送，模拟流式
  const chunks = text.match(/.{1,800}/gs) || [];
  let i = 0;
  const timer = setInterval(() => {
    if (i < chunks.length) {
      send('content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: chunks[i] } });
      i++;
    } else {
      clearInterval(timer);
      send('content_block_stop', { type: 'content_block_stop', index: 0 });
      send('message_delta', { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: text.length } });
      send('message_stop', { type: 'message_stop' });
      res.end();
    }
  }, 40);
}

server.on('error', (err) => {
  console.error(`[Bridge] ❌ HTTP 端口 ${HTTP_PORT} 不可用：${err.message}`);
  console.error('   可能是端口被占用。可设置环境变量 TABU_BRIDGE_HTTP_PORT 换端口（终端 ANTHROPIC_BASE_URL 需同步修改）。');
  process.exit(1);
});

server.listen(HTTP_PORT, HOST, () => {
  console.log('');
  console.log('┌────────────────────────────────────────────────────────────┐');
  console.log('│  TabU 终端桥接服务已启动                                    │');
  console.log(`│  HTTP : ${HOST}:${HTTP_PORT}  (Anthropic Messages API)      │`);
  console.log(`│  WS   : ${HOST}:${WS_PORT}   (Chrome 扩展接入)               │`);
  console.log('└────────────────────────────────────────────────────────────┘');
  console.log('');
  console.log('  📌 终端设置：');
  console.log(`      export ANTHROPIC_BASE_URL="http://${HOST}:${HTTP_PORT}"`);
  console.log(`      export ANTHROPIC_API_KEY="${TOKEN}"`);
  console.log('');
  console.log(`  🔑 桥接 Token（请填入插件的「管理设置 → 终端桥接」）：`);
  console.log(`      ${TOKEN}`);
  console.log('');
});
