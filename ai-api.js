// ========== AI API 共享工具（ai-api.js） ==========
// 供 background（importScripts）与 sidepanel（<script>）双上下文加载的纯工具函数，
// 不含 chrome API / DOM 依赖，避免两处逻辑漂移。
// 覆盖：域名白名单软校验、Base URL 拼接、配置归一化、SSE 流解析、错误文本提取。

'use strict';

// 默认放行的 AI 服务商 host（子域也放行）。软校验开关 aiAllowAnyHost 开启后跳过本白名单。
const AI_ALLOWED_HOSTS = [
  'api.openai.com',
  'api.anthropic.com',
  'api.deepseek.com',
  'api.moonshot.cn',
  'api.moonshot.ai',
  'open.bigmodel.cn',
  'api.z.ai',
  'dashscope.aliyuncs.com',
  'dashscope-intl.aliyuncs.com',
  'api.siliconflow.cn'
];

// 提供商预设目录（蓝区「AI 服务」下拉 + 模型建议 + 默认 Base URL + 协议）。
// protocol: 'openai' = OpenAI 兼容（/chat/completions）；'anthropic' = Anthropic 原生（/messages）。
// 模型名基于各官方 API 文档（2026-08 核对）。
const AI_PROVIDERS = {
  openai: {
    protocol: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    models: ['gpt-5.4', 'gpt-5.4-mini', 'gpt-5.4-nano', 'gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano', 'o3', 'o4-mini'],
    defaultModel: 'gpt-5.4-mini'
  },
  anthropic: {
    protocol: 'anthropic',
    baseUrl: 'https://api.anthropic.com',
    models: ['claude-opus-4-8', 'claude-opus-4-7', 'claude-sonnet-4-6', 'claude-sonnet-4-5', 'claude-haiku-4-5'],
    defaultModel: 'claude-sonnet-4-6'
  },
  deepseek: {
    protocol: 'openai',
    baseUrl: 'https://api.deepseek.com/v1',
    models: ['deepseek-v4-flash', 'deepseek-v4-pro'],
    defaultModel: 'deepseek-v4-flash'
  },
  kimi: {
    protocol: 'openai',
    baseUrl: 'https://api.moonshot.cn/v1',
    models: ['kimi-k3', 'kimi-k2.7-code', 'kimi-k2.7-code-highspeed', 'kimi-k2.6', 'moonshot-v1-128k', 'moonshot-v1-32k'],
    defaultModel: 'kimi-k3'
  },
  chatglm: {
    protocol: 'openai',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    models: ['glm-5.1', 'glm-5', 'glm-4.7', 'glm-4.6', 'glm-4.6v', 'glm-z1-airx', 'glm-z1-flash'],
    defaultModel: 'glm-4.6'
  },
  qwen: {
    protocol: 'openai',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    models: ['qwen3.7-max', 'qwen3.7-plus', 'qwen3.6-max-preview', 'qwen3.6-plus', 'qwen3.6-flash', 'qwen3.5-plus'],
    defaultModel: 'qwen3.6-plus'
  },
  custom: {
    protocol: 'openai',
    baseUrl: '',
    models: [],
    defaultModel: 'gpt-4o-mini'
  }
};

// host 是否在默认允许范围内（已知服务商 + 本机）
function isAllowedAiHost(baseUrl) {
  try {
    const u = new URL(baseUrl);
    const host = u.hostname;
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return true;
    return AI_ALLOWED_HOSTS.some((h) => host === h || host.endsWith('.' + h));
  } catch (e) {
    return false;
  }
}

// 拼接 API 路径：去尾斜杠；pathname 仅 "/"（裸 host）时先补 /v1 再拼 path。
// 例：https://api.openai.com        + /chat/completions → https://api.openai.com/v1/chat/completions
//     https://api.openai.com/v1     + /chat/completions → https://api.openai.com/v1/chat/completions
//     https://api.anthropic.com     + /messages         → https://api.anthropic.com/v1/messages
//     http://127.0.0.1:11434        + /chat/completions → http://127.0.0.1:11434/v1/chat/completions
function joinApiUrl(baseUrl, path) {
  let b = String(baseUrl || '').replace(/\/+$/, '');
  if (!b) return path;
  try {
    const u = new URL(b);
    if (u.pathname.length <= 1) b = b + '/v1';
  } catch (e) {
    /* 非法 URL 原样拼接，交给 fetch 报错 */
  }
  return b + path;
}

// 配置归一化：按 rawProvider 查 AI_PROVIDERS 确定协议（openai 兼容 / anthropic 原生）与默认模型。
// 返回 { provider:'openai'|'anthropic', rawProvider, baseUrl, apiKey, model, allowAnyHost }
function normalizeAiConfig(cfg) {
  const c = cfg || {};
  const rawProvider = c.aiProvider || 'openai';
  const meta = AI_PROVIDERS[rawProvider] || AI_PROVIDERS.custom;
  const baseUrl = String(c.aiBaseUrl || '').trim();
  const apiKey = String(c.aiApiKey || '').trim();
  const model = String(c.aiModel || '').trim() || meta.defaultModel;
  return { provider: meta.protocol, rawProvider, baseUrl, apiKey, model, allowAnyHost: !!c.aiAllowAnyHost };
}

// 解析单个 SSE 事件块（以空行分隔的一段文本），兼容 OpenAI 与 Anthropic。
// 返回 { text } | { reasoning } | { error } | { done } | null（无关事件跳过）。
// reasoning = 推理/思考增量（DeepSeek `reasoning_content`、Qwen/Kimi/GLM thinking、Anthropic thinking_delta），
// 用于前端展示"思考中…"进度，不计入最终答案。
function parseSseBlock(block) {
  const dataLines = [];
  for (const line of String(block || '').split('\n')) {
    const t = line.trim();
    if (t.startsWith('data:')) dataLines.push(t.slice(5).trim());
  }
  if (!dataLines.length) return null;
  const data = dataLines.join('\n');
  if (data === '[DONE]') return { done: true };
  let obj;
  try { obj = JSON.parse(data); } catch (e) { return null; }

  // OpenAI 兼容：choices[].delta 的 content / reasoning_content；错误走 error 字段
  if (obj.error) return { error: (obj.error && obj.error.message) || JSON.stringify(obj.error) };
  if (obj.choices && obj.choices[0] && obj.choices[0].delta) {
    const d = obj.choices[0].delta;
    if (d.content != null) return { text: String(d.content) };
    if (d.reasoning_content != null) return { reasoning: String(d.reasoning_content) };
    if (d.thinking != null) return { reasoning: String(d.thinking) };
    return null;
  }
  // Anthropic：content_block_delta → delta.text / delta.thinking；错误事件
  if (obj.type === 'content_block_delta' && obj.delta) {
    if (obj.delta.text != null) return { text: String(obj.delta.text) };
    if (obj.delta.type === 'thinking_delta' && obj.delta.thinking != null) return { reasoning: String(obj.delta.thinking) };
    return null;
  }
  if (obj.type === 'error') {
    return { error: (obj.error && obj.error.message) || JSON.stringify(obj) };
  }
  return null;
}

// 非 2xx 响应 → 提取可读错误文本（JSON body 优先取 error.message）
async function readApiErrorText(res) {
  let body = '';
  try { body = await res.text(); } catch (e) {}
  body = String(body || '').slice(0, 300);
  try {
    const j = JSON.parse(body);
    if (j.error && j.error.message) body = j.error.message;
  } catch (e) {}
  return 'HTTP ' + res.status + (body ? ': ' + body : '');
}
