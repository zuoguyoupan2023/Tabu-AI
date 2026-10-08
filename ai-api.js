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
    label: 'OpenAI',
    protocol: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    models: ['gpt-5.4', 'gpt-5.4-mini', 'gpt-5.4-nano', 'gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano', 'o3', 'o4-mini'],
    defaultModel: 'gpt-5.4-mini'
  },
  anthropic: {
    label: 'Anthropic',
    protocol: 'anthropic',
    baseUrl: 'https://api.anthropic.com',
    models: ['claude-opus-4-8', 'claude-opus-4-7', 'claude-sonnet-4-6', 'claude-sonnet-4-5', 'claude-haiku-4-5'],
    defaultModel: 'claude-sonnet-4-6'
  },
  deepseek: {
    label: 'DeepSeek',
    protocol: 'openai',
    baseUrl: 'https://api.deepseek.com/v1',
    models: ['deepseek-v4-flash', 'deepseek-v4-pro'],
    defaultModel: 'deepseek-v4-flash'
  },
  kimi: {
    label: 'Kimi',
    protocol: 'openai',
    baseUrl: 'https://api.moonshot.cn/v1',
    models: ['kimi-k3', 'kimi-k2.7-code', 'kimi-k2.7-code-highspeed', 'kimi-k2.6', 'moonshot-v1-128k', 'moonshot-v1-32k'],
    defaultModel: 'kimi-k3'
  },
  chatglm: {
    label: 'ChatGLM',
    protocol: 'openai',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    models: ['glm-5.1', 'glm-5', 'glm-4.7', 'glm-4.6', 'glm-4.6v', 'glm-z1-airx', 'glm-z1-flash'],
    defaultModel: 'glm-4.6'
  },
  qwen: {
    label: 'Qwen',
    protocol: 'openai',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    models: ['qwen3.7-max', 'qwen3.7-plus', 'qwen3.6-max-preview', 'qwen3.6-plus', 'qwen3.6-flash', 'qwen3.5-plus'],
    defaultModel: 'qwen3.6-plus'
  },
  custom: {
    label: 'Custom',
    protocol: 'openai',
    baseUrl: '',
    models: [],
    defaultModel: 'gpt-4o-mini'
  }
};

// provider → 默认档案名（静态标签，供纯逻辑层生成档案名；sidepanel 优先用 i18n 同名键）
function aiProviderLabel(provider) {
  const meta = AI_PROVIDERS[provider];
  return (meta && meta.label) || String(provider || '');
}

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

// 与 manifest.json 的 extension_pages CSP connect-src 保持一致的域清单。
// sidepanel 页面只能直连这些域；用户自定义的其它域（aiBaseUrl + aiAllowAnyHost）
// 由 capabilities.askApiStream 自动改走后台 SW 代理（background 'tabuApiProxy' 端口）。
// ＊修改 manifest CSP 时必须同步本清单，反之亦然。
const AI_PAGE_CSP_HOSTS = [
  'api.mymemory.translated.net',
  'translate.googleapis.com',
  'fontsapi.zeoseven.com',
  'fontsapi-storage.zeoseven.com',
  'api.openai.com',
  'api.anthropic.com',
  'api.deepseek.com',
  'api.moonshot.cn',
  'api.moonshot.ai',
  'open.bigmodel.cn',
  'api.z.ai',
  'dashscope.aliyuncs.com',
  'dashscope-intl.aliyuncs.com',
  'api.siliconflow.cn',
  'opensound.world',
  'world.opensound.local'
];

// baseUrl 的 host 是否在页面 CSP 白名单内（本机任意 host 均放行）
function isHostInPageCsp(baseUrl) {
  try {
    const u = new URL(baseUrl);
    const host = u.hostname;
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return true;
    return AI_PAGE_CSP_HOSTS.some((h) => host === h || host.endsWith('.' + h));
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
// 幂等：同时接受「原始存储形态」（aiProvider/aiBaseUrl/…）与「本函数已归一化形态」（rawProvider/baseUrl/…），
// 因此 resolveAiConfig 的结果可安全再经本函数（askApiStream 内部会再归一化一次）。
function normalizeAiConfig(cfg) {
  const c = cfg || {};
  const raw = c.aiProvider || c.rawProvider || 'openai';
  // 未知 provider 归入 custom（与 normalizeAiProfile 一致；协议/默认模型原本就回落 custom，行为不变）
  const rawProvider = AI_PROVIDERS[raw] ? String(raw) : 'custom';
  const meta = AI_PROVIDERS[rawProvider] || AI_PROVIDERS.custom;
  const baseUrl = String(c.aiBaseUrl != null ? c.aiBaseUrl : (c.baseUrl || '')).trim();
  const apiKey = String(c.aiApiKey != null ? c.aiApiKey : (c.apiKey || '')).trim();
  const model = String(c.aiModel != null ? c.aiModel : (c.model || '')).trim() || meta.defaultModel;
  const allowAnyHost = !!(c.aiAllowAnyHost != null ? c.aiAllowAnyHost : c.allowAnyHost);
  return { provider: meta.protocol, rawProvider, baseUrl, apiKey, model, allowAnyHost };
}

// ========== API 多渠道档案（profiles，docs/017） ==========
// 存储 schema（chrome.storage.local）：
//   aiProfiles:        [{ id, name, provider, baseUrl, apiKey, model, allowAnyHost }]  档案列表（唯一事实源）
//   aiActiveProfileId: string                                                          当前生效档案 id
// 旧平铺键（aiProvider/aiBaseUrl/aiApiKey/aiModel/aiAllowAnyHost）保留为**兼容镜像**：
// 由侧栏在保存/切换时写透，供未改造的旧读取路径兜底；读取路径一律经 resolveAiConfig。
const AI_CFG_FLAT_KEYS = ['aiProvider', 'aiBaseUrl', 'aiApiKey', 'aiModel', 'aiAllowAnyHost'];
const AI_CFG_STORAGE_KEYS = AI_CFG_FLAT_KEYS.concat(['aiProfiles', 'aiActiveProfileId']);

function newAiProfileId() {
  return 'p_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// 归一化单个档案（宽容：字段缺失/类型异常一律收敛到安全值；未知 provider 归入 custom 以保留 baseUrl）
function normalizeAiProfile(raw) {
  const p = raw || {};
  const provider = AI_PROVIDERS[p.provider] ? String(p.provider) : (p.provider ? 'custom' : 'openai');
  return {
    id: String(p.id || ''),
    name: String(p.name || '').trim(),
    provider,
    baseUrl: String(p.baseUrl || '').trim(),
    apiKey: String(p.apiKey || '').trim(),
    model: String(p.model || '').trim(),
    allowAnyHost: !!p.allowAnyHost
  };
}

// 从存储快照迁移/加载档案列表。
// 返回 { profiles, activeId, changed }；changed=true 表示应把结果写回存储（首次迁移、修复非法 activeId）。
// 不变式：返回的 profiles 至少 1 个（空配置也建一个占位档案，避免各处判空）。
function migrateAiProfiles(raw) {
  const s = raw || {};
  const list = (Array.isArray(s.aiProfiles) ? s.aiProfiles : [])
    .map((p) => normalizeAiProfile(p))
    .filter((p) => p.id);
  if (list.length) {
    let activeId = String(s.aiActiveProfileId || '');
    const activeMissing = !list.some((p) => p.id === activeId);
    if (activeMissing) activeId = list[0].id;
    const changed = activeMissing || !Array.isArray(s.aiProfiles);
    return { profiles: list, activeId, changed };
  }
  // 无档案：从平铺旧键迁移为单档案（保留已配置的 provider/baseUrl/key/model）
  const legacy = normalizeAiConfig(s);
  const profile = normalizeAiProfile({
    id: newAiProfileId(),
    name: aiProviderLabel(legacy.rawProvider),
    provider: legacy.rawProvider,
    baseUrl: legacy.baseUrl,
    apiKey: legacy.apiKey,
    model: legacy.model,
    allowAnyHost: legacy.allowAnyHost
  });
  return { profiles: [profile], activeId: profile.id, changed: true };
}

// 解析当前生效配置（档案优先；无档案时回落平铺旧键，兼容迁移前的时间窗）。
// 返回 normalizeAiConfig 结果 + { profileId, profileName }（无档案时空字符串）。
function resolveAiConfig(raw) {
  const s = raw || {};
  const list = Array.isArray(s.aiProfiles)
    ? s.aiProfiles.map((p) => normalizeAiProfile(p)).filter((p) => p.id)
    : [];
  let p = null;
  if (list.length) p = list.find((x) => x.id === s.aiActiveProfileId) || list[0];
  const cfg = normalizeAiConfig(p
    ? { aiProvider: p.provider, aiBaseUrl: p.baseUrl, aiApiKey: p.apiKey, aiModel: p.model, aiAllowAnyHost: p.allowAnyHost }
    : s);
  cfg.profileId = p ? p.id : '';
  cfg.profileName = p ? p.name : '';
  return cfg;
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
