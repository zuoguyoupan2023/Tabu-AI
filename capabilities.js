// ========== TabU AI 底层共享能力层（capabilities） ==========
// 内容能力管线：文本来源（Sources）→ 文本处理（Processors）→ 输出动作（Actions）。
// 浏览器动作（TAB_ACTIONS）与数据动作（DATA_ACTIONS）走平行的注册表，调用方式一致。
// 红蓝两层 + 当前侧边栏统一通过 execute() / runAction() 调用；能力只在此实现一次。
// 本文件依赖 chrome 扩展 API 与 CardRenderer（card.js，延迟引用），在 sidepanel 上下文加载。
'use strict';

// ========== 通用消息 ==========
function sendMessage(action, data = {}) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action, ...data }, (response) => resolve(response));
  });
}

// ========== 文本来源 Sources ==========

// 获取选中文本（页面选区 + input/textarea 回退）
async function getSelectedText() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return '';
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        // 1. 页面文本选区
        const sel = window.getSelection();
        if (sel && sel.toString && sel.toString().trim()) return sel.toString().trim();
        // 2. 活动元素（input/textarea）内的选中文本
        const ae = document.activeElement;
        if (ae && (ae.tagName === 'TEXTAREA' || ae.tagName === 'INPUT')) {
          const v = (ae.value || '').trim();
          if (v) {
            const start = ae.selectionStart || 0;
            const end = ae.selectionEnd || v.length;
            const sub = v.substring(start, end).trim();
            return sub || v;
          }
        }
        return '';
      }
    });
    return results && results[0] ? results[0].result : '';
  } catch (e) {
    console.warn('获取选中文本失败:', e);
    return '';
  }
}

// ========== 核心：改进的全文提取函数（Readability 轻量版） ==========
// 该函数在页面上下文执行，需完全自包含（不引用外部变量）
function extractMainText() {
  // 噪声词（常见广告、推荐、导航、页脚等）
  const NOISE_WORDS = [
    '为你精选', '为您精选', '精选更多', '查看更多', '更多内容', '查看全部', '相关推荐', '推荐阅读',
    '猜你喜欢', '你可能感兴趣', '热门推荐', '热门新闻', '热点新闻', '今日热点', '热点话题', '头条',
    '广告', '赞助', '推广', '商业合作', '分享到', '转发', '评论', '收藏', '举报', '扫码', '二维码',
    '下载APP', '立即下载', '打开APP', '关注我们', '关注公众号', '关注微博', '订阅', '登录', '注册',
    '返回首页', '首页', '下一页', '上一页', '更多新闻', '更多资讯', '版权声明', '免责声明',
    '转载请联系', '联系电话', '联系邮箱', '隐私政策', '用户协议', '回到顶部', '点击查看'
  ];

  // 穿透 Shadow DOM 收集所有元素（包括 open shadow root 内部）
  function getAllElements(root) {
    const out = [];
    const stack = [root];
    while (stack.length) {
      const node = stack.pop();
      if (!node || !node.children) continue;
      for (const ch of Array.from(node.children)) {
        out.push(ch);
        stack.push(ch);
        if (ch.shadowRoot) stack.push(ch.shadowRoot);
      }
    }
    return out;
  }

  // 候选容器打分：长度 × 链接惩罚 × 标点加成 × 段落加成 × 密度修正
  function scoreElement(el) {
    const text = (el.textContent || '').trim();
    if (text.length < 100 || text.length > 80000) return null;
    const htmlLen = el.innerHTML ? el.innerHTML.length : 0;
    let linkText = 0;
    try { linkText = Array.from(el.querySelectorAll('a')).reduce((s, a) => s + (a.textContent || '').length, 0); } catch (e) {}
    const linkRatio = linkText / Math.max(text.length, 1);
    const punctCount = (text.match(/[。！？，、；：…—《》.,!?]/g) || []).length;
    const punctRatio = punctCount / Math.max(text.length, 1);
    let paraCount = 0;
    try { paraCount = el.querySelectorAll('p, h1, h2, h3, h4, li').length; } catch (e) {}
    const textDensity = htmlLen > 0 ? text.length / htmlLen : 0;

    let score = text.length;
    score *= (1 - linkRatio * 0.85);               // 链接占比越高越像导航/聚合
    score *= (1 + Math.min(punctRatio * 8, 1.5));  // 标点密度加成（自然语言正文）
    score *= (1 + Math.min(paraCount / 25, 1));    // 段落数加成
    if (textDensity < 0.02) score *= 0.3;          // 文本密度过低惩罚
    return { el, text, score, linkRatio };
  }

  // 提取干净段落（containerEl 为空时用全页已收集的元素）
  function cleanParagraphs(containerEl) {
    const out = [];
    const seen = new Set();
    let nodes;
    if (containerEl) {
      nodes = getAllElements(containerEl).filter(n => /^(P|H1|H2|H3|H4|H5|LI|BLOCKQUOTE)$/.test(n.tagName));
    } else {
      nodes = allEls.filter(n => /^(P|H1|H2|H3|H4|H5|LI|BLOCKQUOTE)$/.test(n.tagName));
    }
    for (const node of nodes) {
      const t = (node.innerText || node.textContent || '').trim();
      if (t.length < 20) continue;
      if (NOISE_WORDS.some(w => t.includes(w))) continue;
      let linkLen = 0;
      try { linkLen = Array.from(node.querySelectorAll('a')).reduce((s, a) => s + (a.innerText || a.textContent || '').length, 0); } catch (e) {}
      if (linkLen / Math.max(t.length, 1) > 0.5) continue; // 纯链接行跳过
      if (seen.has(t)) continue;
      seen.add(t);
      out.push(t);
    }
    return out;
  }

  // 1) 收集全页元素（含 Shadow DOM）
  const allEls = getAllElements(document);

  // 2) 候选正文容器打分
  const candidates = [];
  const seenEls = new Set();
  for (const el of allEls) {
    const tag = el.tagName || '';
    const cls = ((el.className && el.className.toString) ? el.className.toString() : (el.className || '')) + ' ' + (el.id || '');
    const isContainer = tag === 'ARTICLE' || tag === 'MAIN' || tag === 'SECTION' ||
      /content|article|story|post|body|paragraph|text|articlebody/i.test(cls) ||
      (el.getAttribute && el.getAttribute('itemprop') === 'articleBody');
    if (!isContainer) continue;
    if (seenEls.has(el)) continue;
    seenEls.add(el);
    const scored = scoreElement(el);
    if (scored) candidates.push(scored);
    if (candidates.length >= 100) break; // 防止极端页面打分过慢
  }

  // 3) 选最优容器提取正文
  candidates.sort((a, b) => b.score - a.score);
  let mainText = '';
  if (candidates.length > 0 && candidates[0].linkRatio < 0.35) {
    const paragraphs = cleanParagraphs(candidates[0].el);
    if (paragraphs.length >= 2) mainText = paragraphs.join('\n');
  }

  // 4) 回退：全页段落聚合
  if (!mainText) {
    const paragraphs = cleanParagraphs(null);
    if (paragraphs.length > 0) mainText = paragraphs.join('\n');
  }

  // 5) 最终回退：穿透 shadow 聚合叶子文本
  if (!mainText) {
    const lines = [];
    const seenLines = new Set();
    for (const el of allEls) {
      if (el.children && el.children.length > 0) continue;
      const t = (el.innerText || el.textContent || '').trim();
      if (t.length >= 20 && !NOISE_WORDS.some(w => t.includes(w))) {
        if (!seenLines.has(t)) { seenLines.add(t); lines.push(t); }
      }
    }
    mainText = lines.join('\n');
  }

  // 6) 清理空行
  return mainText.split('\n').map(s => s.trim()).filter(Boolean).join('\n');
}

// ========== 获取全文（带动态渲染重试） ==========
async function getFullPageText() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return '';
    const url = tab.url || '';
    if (url.startsWith('chrome://') || url.startsWith('edge://') || url.startsWith('about:')) return '';
    // SPA / 懒加载页面：内容不足时重试，等待动态渲染
    for (let attempt = 0; attempt < 3; attempt++) {
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: extractMainText
      });
      const text = results && results[0] ? (results[0].result || '') : '';
      if (text.trim().length >= 40) return text.trim();
      if (attempt < 2) await new Promise(r => setTimeout(r, 1200 + attempt * 400));
    }
    return '';
  } catch (e) {
    console.warn('获取全文失败:', e);
    return '';
  }
}

// 剪贴板通用文本来源
async function readClipboard() {
  return navigator.clipboard.readText();
}

// 读取插件内输入框
function readInputBox(inputId) {
  const el = document.getElementById(inputId);
  return el ? (el.value || '') : '';
}

const TEXT_SOURCES = {
  selection: { label: I18N.t('sourceSelection'), get: () => getSelectedText() },
  fullpage:  { label: I18N.t('sourceFullPage'), get: () => getFullPageText() },
  input:     { label: I18N.t('sourceInput'), get: (opts) => readInputBox((opts && opts.inputId) || '') },
  clipboard: { label: I18N.t('sourceClipboard'), get: () => readClipboard() }
};

// ========== 文本处理 Processors ==========
// 注意：apply 生成的注入 prompt 属功能设定（如「翻译成中文」的目标语言跟随翻译设置），
// 不随界面语言（I18N）切换；仅 label 参与中英文。
const PROCESSORS = {
  raw:       { label: I18N.t('procRaw'),  apply: (t) => t },
  translate: { label: I18N.t('aiTplTranslate'),  apply: (t) => '请将以下内容翻译成中文：\n\n' + t },
  summarize: { label: I18N.t('aiTplSummarize'),  apply: (t) => '请用简洁的语言总结以下内容：\n\n' + t },
  explain:   { label: I18N.t('aiTplExplain'),  apply: (t) => '请解释以下内容：\n\n' + t },
  polish:    { label: I18N.t('aiTplPolish'),  apply: (t) => '请润色以下内容，使其更通顺自然：\n\n' + t },
  custom:    { label: I18N.t('procCustom'), apply: (t, tpl) => (tpl || '{text}').replace(/\{text\}/g, t) }
};

// ========== 输出动作 Actions ==========

// 朗读（TTS）：返回 { ok, text, error }
function speakText(text, opts = {}) {
  chrome.tts.stop();
  return new Promise((resolve) => {
    try {
      chrome.tts.speak(text, {
        voiceName: opts.voice || undefined,
        rate: opts.rate || 1,
        pitch: opts.pitch || 1,
        volume: opts.volume || 1,
        onEvent: opts.onEvent
      });
      resolve({ ok: true, text });
    } catch (e) {
      resolve({ ok: false, text: '', error: e.message });
    }
  });
}

// 翻译（MyMemory + Google 回退 + 长文本分段）
// 将长文本按句子分割成块，每块不超过 maxLength
function splitTextIntoChunks(text, maxLength) {
  const sentenceRegex = /[。！？；\n]+/;
  const sentences = text.split(sentenceRegex).filter(s => s.trim().length > 0);
  const chunks = [];
  let currentChunk = '';
  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (currentChunk.length + trimmed.length + 1 <= maxLength) {
      currentChunk += (currentChunk ? '。' : '') + trimmed;
    } else {
      if (currentChunk) chunks.push(currentChunk);
      currentChunk = trimmed;
    }
  }
  if (currentChunk) chunks.push(currentChunk);
  return chunks;
}

// 备用翻译 API（Google）
async function translateFallback(text, sourceLang, targetLang) {
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
    const data = await response.json();
    if (data && data[0]) {
      return data[0].map(item => item[0]).join('');
    }
    return null;
  } catch (e) {
    return null;
  }
}

// 单段翻译（带重试）
async function translateSingleChunk(text, sourceLang, targetLang, retries = 2) {
  const MAX_LENGTH = 500;
  let finalText = text;
  if (text.length > MAX_LENGTH) {
    finalText = text.substring(0, MAX_LENGTH);
  }

  const langpair = `${sourceLang === 'auto' ? 'Autodetect' : sourceLang}|${targetLang}`;
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(finalText)}&langpair=${langpair}`;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);
      const textData = await response.text();
      let data;
      try {
        data = JSON.parse(textData);
      } catch (e) {
        const fallbackResult = await translateFallback(text, sourceLang, targetLang);
        if (fallbackResult) return fallbackResult;
        throw new Error(I18N.t('apiFormatError'));
      }
      if (data.responseData && data.responseData.translatedText) {
        return data.responseData.translatedText;
      } else {
        if (data.responseStatus === 403 || data.responseStatus === 429) {
          if (attempt < retries) {
            await new Promise(resolve => setTimeout(resolve, 2000 * (attempt + 1)));
            continue;
          }
        }
        const fallbackResult = await translateFallback(text, sourceLang, targetLang);
        if (fallbackResult) return fallbackResult;
        throw new Error(data.responseDetails || I18N.t('translateFail'));
      }
    } catch (e) {
      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, 2000 * (attempt + 1)));
      } else {
        const fallbackResult = await translateFallback(text, sourceLang, targetLang);
        if (fallbackResult) return fallbackResult;
        throw e;
      }
    }
  }
  throw new Error(I18N.t('retryFailed'));
}

// 分段翻译长文本
async function translateLongText(text, sourceLang, targetLang, onProgress) {
  const maxChunkSize = 480;
  const chunks = splitTextIntoChunks(text, maxChunkSize);
  if (chunks.length === 0) return '';

  let results = [];
  for (let i = 0; i < chunks.length; i++) {
    if (onProgress) {
      onProgress(i + 1, chunks.length);
    }
    const translated = await translateSingleChunk(chunks[i], sourceLang, targetLang);
    results.push(translated);
    if (i < chunks.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
  }
  // 分段边界补回句读（splitTextIntoChunks 剥离了句末标点），避免译文句子粘连
  return results.join('。');
}

// 翻译动作核心：返回译文文本；超长自动分段
async function translateText(text, opts = {}) {
  const source = opts.source || 'en';
  const target = opts.target || 'zh-CN';
  const onProgress = opts.onProgress;
  const MAX_SINGLE = 500;
  if (text.length > MAX_SINGLE) {
    return translateLongText(text, source, target, onProgress);
  }
  return translateSingleChunk(text, source, target);
}

// 发送到 AI：注入 askInSite（后台）并返回 { ok, text, error }
async function sendToAI(site, prompt) {
  const r = await sendMessage('injectAsk', { site: site || 'chatgpt', prompt });
  if (r && r.answer) return { ok: true, text: r.answer };
  return { ok: false, text: '', error: (r && r.error) || I18N.t('unknownError') };
}

// 自定义 API 流式调用（sidepanel 上下文执行）。
// 放这里而非后台：MV3 service worker 可能在长请求中途被挂起，流会中断；sidepanel 是持久页面。
// 复用 ai-api.js（AI_ALLOWED_HOSTS / isAllowedAiHost / joinApiUrl / normalizeAiConfig / parseSseBlock / readApiErrorText）。
// 双路径：域名在页面 CSP 白名单内（默认服务商 / 本机 / opensound）→ sidepanel 直连 fetch；
//         其它用户自定义域名 → 经 background 'tabuApiProxy' 端口由 SW 代理（页面 CSP 管不到 SW fetch）。
// opts: { signal, onDelta(text), onReasoning(text) }；返回 { answer } 或 { aborted: true }；出错 throw Error。
async function askApiStream(prompt, config, history, opts = {}) {
  const cfg = normalizeAiConfig(config);
  if (!cfg.baseUrl) throw new Error('未配置 Base URL，请在蓝区「💬 LLM 对话」卡填写');
  if (!cfg.allowAnyHost && !isAllowedAiHost(cfg.baseUrl)) {
    throw new Error('Base URL 不在默认允许列表，如需连接该域名请在蓝区「💬 LLM 对话」卡开启「允许任意域名」');
  }
  const messages = (history || []).concat([{ role: 'user', content: String(prompt || '') }]);
  const signal = opts.signal || undefined;
  const onDelta = opts.onDelta || (() => {});
  const onReasoning = opts.onReasoning || (() => {});

  // 部分国内提供商默认输出上限偏低，思考型模型会吃满导致答案被截断 → 显式给足
  const needsMaxTokens = ['deepseek', 'kimi', 'chatglm', 'qwen'].includes(cfg.rawProvider);
  const MAX_TOKENS = 8192;

  const readerLoop = async (res) => {
    if (!res.body) throw new Error('浏览器不支持流式读取');
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let answer = '';
    while (true) {
      if (signal && signal.aborted) return { aborted: true };
      let chunk;
      try {
        const r = await reader.read();
        chunk = r;
      } catch (e) {
        if (signal && signal.aborted) return { aborted: true };
        throw e;
      }
      if (chunk.done) break;
      buffer += decoder.decode(chunk.value, { stream: true });
      // SSE 事件以空行分隔，兼容 \n\n 与 \r\n\r\n
      const events = buffer.split(/\r?\n\r?\n/);
      buffer = events.pop();
      for (const ev of events) {
        const parsed = parseSseBlock(ev);
        if (!parsed) continue;
        if (parsed.error) throw new Error(parsed.error);
        if (parsed.done) return { answer };
        if (parsed.text) { answer += parsed.text; onDelta(parsed.text); }
        else if (parsed.reasoning) { onReasoning(parsed.reasoning); }
      }
    }
    // 冲刷尾部未以空行终结的事件
    if (buffer.trim()) {
      const parsed = parseSseBlock(buffer);
      if (parsed && parsed.text) { answer += parsed.text; onDelta(parsed.text); }
      if (parsed && parsed.error) throw new Error(parsed.error);
    }
    // 冲刷解码器缓存的多字节残留字符，避免末尾字被吞
    const tail = decoder.decode();
    if (tail) { answer += tail; onDelta(tail); }
    return { answer };
  };

  const url = cfg.provider === 'anthropic'
    ? joinApiUrl(cfg.baseUrl, '/messages')
    : joinApiUrl(cfg.baseUrl, '/chat/completions');

  let headers, body;
  if (cfg.provider === 'anthropic') {
    headers = { 'content-type': 'application/json', 'x-api-key': cfg.apiKey, 'anthropic-version': '2023-06-01' };
    body = { model: cfg.model, max_tokens: MAX_TOKENS, messages, stream: true };
  } else {
    headers = { 'content-type': 'application/json' };
    if (cfg.apiKey) headers['authorization'] = 'Bearer ' + cfg.apiKey;
    body = { model: cfg.model, messages, stream: true };
    if (needsMaxTokens) body.max_tokens = MAX_TOKENS;
  }

  // 页面 CSP 白名单内 → 直连（保持原性能与中止行为）；其它域名 → 后台 SW 代理
  if (isHostInPageCsp(cfg.baseUrl)) {
    const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal });
    if (!res.ok) throw new Error(await readApiErrorText(res));
    return readerLoop(res);
  }
  return askApiViaBg(url, headers, body, opts);
}

// 后台代理流式调用（页面 CSP 未放行的自定义域名）：Port 连 background 'tabuApiProxy'，
// SW 发起请求（受 host_permissions 管辖）并实时回传 SSE 增量。
// opts: { signal, onDelta(text), onReasoning(text) }；返回 { answer } 或 { aborted: true }；出错 throw Error。
function askApiViaBg(url, headers, body, opts = {}) {
  return new Promise((resolve, reject) => {
    let port;
    try { port = chrome.runtime.connect({ name: 'tabuApiProxy' }); } catch (e) {
      return reject(new Error('无法连接后台代理: ' + e.message));
    }
    let answer = '';
    let settled = false;
    const settle = (fn, val) => {
      if (settled) return;
      settled = true;
      try { port.disconnect(); } catch (e) {}
      fn(val);
    };
    port.onMessage.addListener((msg) => {
      if (msg.delta) { answer += msg.delta; (opts.onDelta || (() => {}))(msg.delta); }
      else if (msg.reasoning) { (opts.onReasoning || (() => {}))(msg.reasoning); }
      else if (msg.error) settle(reject, new Error(msg.error));
      else if (msg.done) settle(resolve, { answer });
    });
    port.onDisconnect.addListener(() => {
      if (settled) return;
      if (opts.signal && opts.signal.aborted) return settle(resolve, { aborted: true });
      settle(reject, new Error('后台代理连接中断'));
    });
    if (opts.signal) {
      opts.signal.addEventListener('abort', () => { try { port.disconnect(); } catch (e) {} }, { once: true });
    }
    port.postMessage({ url, headers, body });
  });
}

// 复制文本：返回 { ok, text, error }
async function copyText(text) {
  await navigator.clipboard.writeText(String(text || ''));
  return { ok: true, text };
}

// 卡片下载：CardRenderer 渲染 → PNG → chrome.downloads
async function downloadCardImage(text, opts = {}) {
  if (typeof CardRenderer === 'undefined' || !CardRenderer.render) {
    throw new Error(I18N.t('cardRendererNotLoaded'));
  }
  // 渲染前确保所选字体已加载（WYSIWYG：canvas 与 HTML 预览同字体），未选/加载失败则回退系统字体
  // 标题「芫荽」(opts.titleFont) 同样需先加载，canvas 才能用其绘制底部标题
  const fontsToLoad = [opts.font, opts.titleFont].filter(Boolean);
  for (const f of fontsToLoad) {
    if (typeof CardRenderer.loadFont === 'function') await CardRenderer.loadFont(f);
  }
  const { dataURL } = CardRenderer.render(text, opts);
  const d = new Date();
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`;
  await chrome.downloads.download({ url: dataURL, filename: `tabu-card-${stamp}.png` });
  return { ok: true, text: I18N.t('cardDownloaded') };
}

const ACTIONS = {
  tts:       { label: I18N.t('actTts'),      run: (t, o) => speakText(t, o) },
  translate: { label: I18N.t('aiTplTranslate'),      run: async (t, o) => {
    const translated = await translateText(t, o || {});
    return { ok: true, text: translated };
  } },
  inject:    { label: I18N.t('actInject'), run: (t, o) => sendToAI((o && o.site) || 'chatgpt', t) },
  copy:      { label: I18N.t('actCopy'),      run: (t) => copyText(t) },
  card:      { label: I18N.t('actCard'),      run: (t, o) => downloadCardImage(t, o) }
};

// ========== 统一管线 execute ==========
// execute({ source, processor, action, text, options }) → { ok, raw, prompt, result, error }
//   source: TEXT_SOURCES 键；text 已给则优先用 text（无需 source）
//   processor: PROCESSORS 键（默认 raw）
//   action: ACTIONS 键（必填）
//   options: { inputId, template, site, source, target, voice, ... } 传给来源/处理/动作
async function execute(payload = {}) {
  const { source, processor, action, text, options } = payload;
  const act = ACTIONS[action];
  if (!act) return { ok: false, error: I18N.t('unknownAction') + action };
  const proc = (processor && PROCESSORS[processor]) ? PROCESSORS[processor] : PROCESSORS.raw;
  let raw = text;
  try {
    if (raw == null) {
      const src = source ? TEXT_SOURCES[source] : null;
      if (!src) return { ok: false, error: I18N.t('missingSource') };
      raw = await src.get(options || {});
    }
    raw = String(raw || '');
    if (!raw.trim()) return { ok: false, error: I18N.t('noTextToProcess') };
    const prompt = proc.apply(raw, options && options.template);
    const result = await act.run(prompt, options || {});
    const ok = result.ok !== false;
    return { ok, raw, prompt, result, error: ok ? '' : (result.error || I18N.t('operationFailed')) };
  } catch (e) {
    return { ok: false, error: e.message, raw, prompt: undefined, result: undefined };
  }
}

// 直接执行某个动作（已有文本时）
async function runAction(name, text, options) {
  const act = ACTIONS[name];
  if (!act) return { ok: false, error: I18N.t('unknownAction') + name };
  try {
    const result = await act.run(String(text || ''), options || {});
    const ok = result.ok !== false;
    return { ok, result, error: ok ? '' : (result.error || I18N.t('operationFailed')) };
  } catch (e) {
    return { ok: false, result: undefined, error: e.message };
  }
}

// ========== 浏览器动作注册表 TAB_ACTIONS ==========
// 内容能力之外、直接操作标签/窗口的动作。run 为唯一实现（多为后台消息或 sidepanel 内实现）。
const TAB_ACTIONS = {
  deduplicateTabs:        { label: I18N.t('tabDeduplicateTabs'),  run: () => deduplicateTabs() },
  pasteAndGo:             { label: I18N.t('tabPasteAndGo'), run: () => pasteAndGo() },
  createIncognitoWindow:  { label: I18N.t('tabIncognito'),      run: () => createIncognitoWindow() },
  captureViewport:        { label: I18N.t('tabCaptureViewport'),          run: () => sendMessage('captureViewport') },
  printCurrentTab:        { label: I18N.t('tabPrint'),          run: () => printCurrentTab() }
};

// ========== 数据动作注册表 DATA_ACTIONS ==========
const DATA_ACTIONS = {
  exportData:               { label: I18N.t('dataExport'),         run: () => sendMessage('exportData') },
  importData:               { label: I18N.t('dataImport'),         run: (json) => sendMessage('importData', { jsonData: json }) },
  mailExport:               { label: I18N.t('dataMail'),         run: () => mailExport() }
};

// ========== 对外统一入口 ==========
const TABU_CAPS = {
  PROCESSORS,
  TEXT_SOURCES,
  ACTIONS,
  TAB_ACTIONS,
  DATA_ACTIONS,
  execute,
  runAction,
  getSelectedText,
  getFullPageText,
  readClipboard,
  readInputBox,
  translateText,
  speakText,
  sendToAI,
  askApiStream,
  copyText
};
