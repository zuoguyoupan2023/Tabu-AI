// ========== 划词即显（docs/009）：网页内浮层 ==========
// 选区 300ms 防抖 → detectMode → 后台查询（词典/翻译）→ Shadow DOM 浮层原地显示。
// 开关：instantDictEnabled（总，默认开）/ instantDictSentence / instantDictWord / instantDictTargetLang('system')。
// 本脚本独立于 i18n.js（内容脚本上下文），文案内嵌中英双语，语言取 uiLang。
(() => {
  'use strict';

  // ===== 设置缓存 =====
  const S = { enabled: true, sentence: true, word: true, targetLang: 'system', uiLang: '' };
  function loadSettings() {
    chrome.storage.local.get(['instantDictEnabled', 'instantDictSentence', 'instantDictWord', 'instantDictTargetLang', 'uiLang'], (r) => {
      S.enabled = r.instantDictEnabled !== false;
      S.sentence = r.instantDictSentence !== false;
      S.word = r.instantDictWord !== false;
      S.targetLang = r.instantDictTargetLang || 'system';
      S.uiLang = r.uiLang || (((navigator.language || 'en').toLowerCase().startsWith('zh')) ? 'zh' : 'en');
      if (!S.enabled) hidePopup();
    });
  }
  try { if (window.TABU_TTS) TABU_TTS.loadConfig(); } catch (e) {}
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && /instantDict|^uiLang$/.test(Object.keys(changes).join('|'))) loadSettings();
  });
  loadSettings();

  // ===== 文案（zh/en） =====
  const STR = {
    zh: { loading: '查询中…', notFound: '未收录', notFoundHint: '试试「AI 详解」或换个词', rateLimited: '查询太频繁，稍后再试', network: '网络不可用', copy: '复制', copied: '已复制', speak: '朗读', close: '关闭', srcLabel: '原文', viaEcdict: '离线词典', viaGoogle: 'via Google', viaMymemory: 'via MyMemory', viaLlm: 'AI' },
    en: { loading: 'Looking up…', notFound: 'Not found', notFoundHint: 'Try "AI detail" or another word', rateLimited: 'Too many lookups, try again later', network: 'Network unavailable', copy: 'Copy', copied: 'Copied', speak: 'Speak', close: 'Close', srcLabel: 'Source', viaEcdict: 'offline dict', viaGoogle: 'via Google', viaMymemory: 'via MyMemory', viaLlm: 'AI' },
  };
  const t = (k) => (STR[S.uiLang === 'en' ? 'en' : 'zh'] || STR.zh)[k] || k;

  // ===== 形态分类（docs/009 §2.2，与 SW 侧一致） =====
  // CJK 无空格分词：中文主导的选区 ≤6 字才算词汇（词/成语/短语），其余按句子。
  function detectMode(raw) {
    const s = cleanText(raw);
    if (!s || s.length > 500) return null;
    if (/^[\s\d\p{P}\p{S}]+$/u.test(s)) return null;
    const sentencePunct = /[.!?。！？;；]/.test(s);
    const tokens = s.trim().split(/\s+/).length;
    const cjk = (s.match(/[\u4e00-\u9fff]/g) || []).length;
    const cjkDominant = cjk >= 1 && cjk / s.replace(/\s/g, '').length >= 0.5;
    if (!sentencePunct && tokens <= 3 && s.length <= (cjkDominant ? 6 : 24)) return 'word';
    return 'sentence';
  }
  function cleanText(raw) {
    // 去首尾标点/引号（句尾的 "." 不影响单词判定）
    return String(raw || '').replace(/^[\s\p{P}\p{S}]+/u, '').replace(/[\s\p{P}\p{S}]+$/u, '');
  }

  // ===== 浮层宿主（Shadow DOM 隔离） =====
  let host = null, shadow = null, cardEl = null, scrollAnchor = null, lookupToken = 0;
  function ensureHost() {
    if (host && host.isConnected) return;
    host = document.createElement('div');
    host.id = 'tabu-dict-host';
    host.style.cssText = 'all:initial; position:fixed; top:0; left:0; z-index:2147483647; pointer-events:none;';
    shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = `<style>${CSS_TEXT}</style><div class="wrap" part="wrap"></div>`;
    cardEl = shadow.querySelector('.wrap');
    (document.documentElement || document.body).appendChild(host);
  }

  const CSS_TEXT = `
  :host { all: initial; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  .card {
    pointer-events: auto; position: fixed; display: none; max-width: 320px;
    font: 13px/1.55 -apple-system, "Segoe UI", system-ui, "PingFang SC", "Microsoft YaHei", sans-serif;
    background: rgba(18,20,26,.97); color: #e8ecf2; border-radius: 10px;
    padding: 8px 10px 7px; box-shadow: 0 8px 28px rgba(0,0,0,.45);
    border: 1px solid rgba(255,255,255,.12);
  }
  @media (prefers-color-scheme: light) {
    .card { background: rgba(250,250,252,.98); color: #23272f; border-color: rgba(0,0,0,.12); box-shadow: 0 8px 28px rgba(0,0,0,.18); }
    .gloss, .srcroman, .via { color: #6b7a8e; }
    .src { color: #55606e; }
  }
  .hd { display: flex; align-items: center; gap: 6px; margin-bottom: 3px; }
  .badge { font-size: 10px; opacity: .65; letter-spacing: .3px; }
  .via { font-size: 10px; opacity: .55; }
  .acts { margin-left: auto; display: flex; gap: 2px; }
  .acts button {
    all: unset; cursor: pointer; width: 22px; height: 22px; border-radius: 6px;
    display: inline-flex; align-items: center; justify-content: center; color: inherit; opacity: .55;
  }
  .acts button:hover { background: rgba(127,140,170,.22); opacity: 1; }
  .acts svg { width: 13px; height: 13px; display: block; }
  .src { font-size: 12px; opacity: .85; margin: 2px 0 1px; word-break: break-word; }
  .srcroman { font-size: 11px; opacity: .6; font-style: normal; margin-left: 5px; }
  .hw { font-size: 14px; font-weight: 700; word-break: break-word; }
  .phon { font-size: 12px; opacity: .7; font-family: ui-monospace, Menlo, monospace; margin-left: 5px; }
  .gloss { font-size: 12px; opacity: .88; margin-top: 2px; word-break: break-word; white-space: pre-line; }
  .native { font-size: 12px; opacity: .95; margin-top: 2px; word-break: break-word; white-space: pre-line; }
  .loading { font-size: 12px; opacity: .75; padding: 2px 2px 1px; }
  .err { font-size: 12px; opacity: .9; padding: 2px 2px 1px; }
  .err small { display: block; opacity: .6; margin-top: 1px; }
  .arrow { position: fixed; width: 10px; height: 10px; transform: rotate(45deg); display: none;
    background: inherit; border: 1px solid rgba(255,255,255,.12); }
  .copied { font-size: 11px; opacity: .8; }
  `;

  // ===== 显示/定位 =====
  function showLoading(rect, modeLabel) {
    ensureHost();
    cardEl.innerHTML = `<div class="card"><div class="loading">⏳ ${esc(t('loading'))}</div></div>`;
    const card = cardEl.firstElementChild;
    card.style.display = 'block';
    positionCard(rect);
    host.style.pointerEvents = 'none';
  }

  function positionCard(rect) {
    const card = cardEl.firstElementChild;
    const pw = card.offsetWidth, ph = card.offsetHeight;
    const vw = document.documentElement.clientWidth, vh = document.documentElement.clientHeight;
    let x = Math.min(Math.max(8, rect.left), Math.max(8, vw - pw - 8));
    let y = rect.bottom + 8;
    if (y + ph > vh - 8) y = Math.max(8, rect.top - ph - 8); // 下方放不下 → 翻到上方
    card.style.left = x + 'px';
    card.style.top = y + 'px';
    scrollAnchor = { x: window.scrollX, y: window.scrollY };
  }

  function hidePopup() {
    lookupToken++;
    if (host && host.isConnected) { cardEl.innerHTML = ''; if (host.parentNode) host.remove(); }
    host = null; shadow = null; cardEl = null;
  }

  // ===== 渲染器 =====
  const ICONS = {
    speak: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/></svg>',
    copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>',
  };
  function actionsHtml() {
    return `<span class="acts">
      <button data-act="speak" title="${esc(t('speak'))}">${ICONS.speak}</button>
      <button data-act="copy" title="${esc(t('copy'))}">${ICONS.copy}</button>
      <button data-act="close" title="${esc(t('close'))}">${ICONS.close}</button>
    </span>`;
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

  // 词条卡：source(原词)/sourceRoman + headword/phonetic + gloss(目标语释义) + native(中文释义)
  function renderEntry(d, rect) {
    ensureHost();
    const via = d.tier === 'ecdict' ? t('viaEcdict') : d.tier === 'mymemory' ? t('viaMymemory') : d.tier === 'gtx' ? t('viaGoogle') : d.tier === 'llm' ? t('viaLlm') : '';
    const srcLine = (d.source && d.source !== d.headword)
      ? `<div class="src">${esc(d.source)}${d.sourceRoman ? `<i class="srcroman">${esc(d.sourceRoman)}</i>` : ''}</div>` : '';
    const hwLine = d.headword
      ? `<div class="hw">${esc(d.headword)}${d.phonetic ? `<i class="phon">/${esc(d.phonetic)}/</i>` : ''}</div>` : '';
    cardEl.innerHTML = `<div class="card">
      <div class="hd">${d.extra ? `<span class="badge">${esc(d.extra)}</span>` : ''}<span class="via">${esc(via)}</span>${actionsHtml()}</div>
      ${srcLine}${hwLine}
      ${d.gloss ? `<div class="gloss">${esc(d.gloss)}</div>` : ''}
      ${d.native ? `<div class="native">${esc(d.native)}</div>` : ''}
    </div>`;
    bindCard(rect, d.headword || d.source || '', d.headword ? (S.uiLang === 'en' ? 'en-US' : 'en-US') : 'zh-CN');
  }

  function renderTranslation(d, rect) {
    ensureHost();
    const via = d.via === 'google' ? t('viaGoogle') : d.via === 'mymemory' ? t('viaMymemory') : '';
    cardEl.innerHTML = `<div class="card">
      <div class="hd"><span class="via">🌐 ${esc(via)}</span>${actionsHtml()}</div>
      <div class="native">${esc(d.text || '')}</div>
      ${d.source ? `<div class="src">${esc(t('srcLabel'))}：${esc(d.source)}</div>` : ''}
    </div>`;
    bindCard(rect, d.text || '', /[\u4e00-\u9fff]/.test(d.text || '') ? 'zh-CN' : 'en-US');
  }

  function renderError(reason, rect, detail) {
    ensureHost();
    const msg = reason === 'rate-limited' ? t('rateLimited') : reason === 'miss' ? t('notFound') : t('network');
    let hint = reason === 'miss' ? `<small>${esc(t('notFoundHint'))}</small>` : '';
    if (detail) hint += `<small>${esc(detail)}</small>`;
    cardEl.innerHTML = `<div class="card"><div class="err">${esc(msg)}${hint}</div></div>`;
    const card = cardEl.firstElementChild;
    card.style.display = 'block';
    positionCard(rect);
    bindCard(rect, '', '');
  }

  function bindCard(rect, speakText, speakLang) {
    const card = cardEl.firstElementChild;
    card.style.display = 'block';
    host.style.pointerEvents = '';
    positionCard(rect);
    card.querySelector('[data-act="close"]')?.addEventListener('click', hidePopup);
    card.querySelector('[data-act="speak"]')?.addEventListener('click', () => speak(speakText, speakLang));
    const copyBtn = card.querySelector('[data-act="copy"]');
    copyBtn?.addEventListener('click', async () => {
      if (!speakText) return;
      try { await navigator.clipboard.writeText(speakText); } catch (e) { fallbackCopy(speakText); }
      copyBtn.innerHTML = `<span class="copied">${esc(t('copied'))}</span>`;
      setTimeout(() => { copyBtn.innerHTML = ICONS.copy; }, 1200);
    });
  }

  // 朗读：优先页面 Web Speech，音色取「朗读槽位 · 划词即显」（'' = 该语言默认）；失败回退后台 chrome.tts
  function speak(text, lang) {
    if (!text) return;
    const langCode = lang || (/[\u4e00-\u9fff]/.test(text) ? 'zh-CN' : 'en-US');
    let voice = '';
    try { if (window.TABU_TTS) voice = TABU_TTS.resolveVoice('dictWord', langCode) || ''; } catch (e) {}
    try {
      const synth = window.speechSynthesis;
      if (synth) {
        synth.cancel();
        const u = new SpeechSynthesisUtterance(text);
        let v = voice ? (synth.getVoices() || []).find((x) => x.name === voice) : null;
        if (v) { u.voice = v; u.lang = v.lang || langCode; } else { u.lang = langCode; }
        synth.speak(u);
        return;
      }
    } catch (e) {}
    chrome.runtime.sendMessage({ action: 'instantDictSpeak', text, lang: langCode, voice }).catch(() => {});
  }
  function fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch (e) {}
    ta.remove();
  }

  // ===== 选区监听 =====
  let debounceTimer = 0;
  function scheduleLookup() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(handleSelection, 300);
  }
  function inEditable(node) {
    const el = node && (node.nodeType === 1 ? node : node.parentElement);
    return !!(el && el.closest && el.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"], [contenteditable="plaintext-only"]'));
  }
  function inOurPopup(node) {
    return !!(node && host && (node === host || (node.nodeType === 1 && host.contains(node)) || (node.parentElement && host.contains(node.parentElement))));
  }
  function currentSelection() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) return null;
    const raw = String(sel);
    const text = cleanText(raw);
    if (!text) return null;
    const range = sel.getRangeAt(0);
    const anchor = sel.anchorNode;
    if (inEditable(anchor) || inOurPopup(anchor)) return null;
    return { text, raw, rect: range.getBoundingClientRect(), anchor };
  }

  async function handleSelection() {
    const info = currentSelection();
    if (!info) { hidePopup(); return; }
    if (!S.enabled) return;
    let mode = detectMode(info.text);
    if (!mode) { hidePopup(); return; }
    // 路由 + 回落（docs/009 §2.2，审阅决定④）：词汇对照关、句子翻译开 → 词按句子（译文）处理
    if (mode === 'word' && !S.word) mode = S.sentence ? 'sentence' : null;
    if (mode === 'sentence' && !S.sentence) mode = null;
    if (!mode) { hidePopup(); return; }

    const token = ++lookupToken;
    showLoading(info.rect, mode);
    let resp = null;
    try {
      resp = await chrome.runtime.sendMessage({
        action: 'instantDictLookup',
        text: info.text,
        mode,
        targetLang: resolveTarget(),
      });
    } catch (e) { resp = { ok: false, reason: 'network', detail: '后台未连接：' + ((e && e.message) || '扩展需重新加载') }; }
    if (token !== lookupToken) return; // 已有更新的查询/已关闭
    if (!resp || !resp.ok) { renderError((resp && resp.reason) || 'network', info.rect, resp && resp.detail); return; }
    if (resp.kind === 'entry') renderEntry(resp, info.rect);
    else if (resp.kind === 'translation') renderTranslation(resp, info.rect);
    else renderError('miss', info.rect);
  }

  function resolveTarget() {
    if (S.targetLang && S.targetLang !== 'system') return S.targetLang;
    return (navigator.language || 'en').toLowerCase().startsWith('zh') ? 'zh-CN' : 'en';
  }

  // 事件：选区变化 / 抬起 → 防抖查询；滚动/键盘/页面离开 → 关闭
  document.addEventListener('selectionchange', scheduleLookup, true);
  window.addEventListener('mouseup', scheduleLookup, true);
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') hidePopup(); }, true);
  window.addEventListener('scroll', () => {
    if (!host || !host.isConnected || !scrollAnchor) return;
    if (Math.abs(window.scrollX - scrollAnchor.x) > 24 || Math.abs(window.scrollY - scrollAnchor.y) > 24) hidePopup();
  }, { capture: true, passive: true });
  window.addEventListener('pagehide', hidePopup, true);
})();
