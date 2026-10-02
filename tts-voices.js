// ========== 朗读音色统一（docs/010 §5） ==========
// 单一音色目录 + 按语言默认 + 槽位配置。三端共享：sidepanel / content script / service worker。
// 暴露 globalThis.TABU_TTS；无依赖、无框架。系统音色在 sidepanel/content 取自 Web Speech，
// SW 无 speechSynthesis（listVoices 返回空，仅用于回退路径按 pinned/语言处理）。
(function (global) {
  'use strict';
  // 朗读槽位：列表同源、配置独立
  const SLOTS = ['selection', 'chatMessage', 'aiAnswer', 'dictWord'];
  const STORAGE_KEY = 'ttsVoiceConfig';

  // 各语言偏好音色：仅作同语言候选的排序 tie-breaker，实际以设备/浏览器提供的音色为准
  const LANG_PREF = {
    en: ['samantha', 'daniel', 'alex', 'karen', 'google us english', 'microsoft aria', 'microsoft jenny'],
    'en-gb': ['daniel', 'kate', 'serena', 'google uk english'],
    zh: ['ting-ting', 'tingting', 'meijia', 'mei-jia', 'siri', 'google 普通话', 'microsoft xiaoxiao', 'microsoft huihui', 'yaoyao', 'huihui'],
    'zh-tw': ['meijia', 'mei-jia', 'yu-shu', 'google 國語'],
    ja: ['kyoko', 'google 日本語', 'microsoft nanami'],
    ko: ['yuna', 'google 한국의', 'microsoft sunhi'],
    fr: ['amelie', 'thomas', 'google français'],
    de: ['anna', 'google deutsch'],
    es: ['monica', 'google español'],
    ru: ['milena', 'google русский'],
  };

  let _voices = null;
  let _config = null;
  let _loadPromise = null;

  function norm(v) {
    if (!v) return null;
    const name = v.name || v.voiceName || '';
    if (!name) return null;
    return { id: name, name, lang: String(v.lang || ''), source: v.name ? 'webspeech' : 'chrometts' };
  }

  // 同步枚举系统音色（Web Speech；SW 无则返回空）。过滤不稳定的 Google 系；全被过滤时回退全量。
  function listVoices() {
    if (_voices) return _voices;
    let raw = [];
    try { if (global.speechSynthesis) raw = global.speechSynthesis.getVoices() || []; } catch (e) {}
    const mapped = raw.map(norm).filter(Boolean);
    const usable = mapped.filter((v) => !/^google[\s-]/i.test(v.name));
    _voices = usable.length ? usable : mapped;
    return _voices;
  }
  function refreshVoices() { _voices = null; return listVoices(); }
  function findVoice(id) { return listVoices().find((v) => v.id === id) || null; }

  const lc = (lang) => String(lang || '').toLowerCase().replace('_', '-');

  // 各语言默认音色：精确 locale → 基础语言 → 首个可用 →（无候选时）空
  function defaultVoiceFor(lang) {
    const voices = listVoices();
    if (!voices.length) return '';
    const want = lc(lang);
    const base = want.split('-')[0];
    let pool = voices.filter((v) => lc(v.lang) === want);
    if (!pool.length) pool = voices.filter((v) => lc(v.lang).split('-')[0] === base);
    if (!pool.length && base) pool = voices.filter((v) => lc(v.lang).startsWith(base));
    if (!pool.length) pool = voices.slice();
    const pref = LANG_PREF[want] || LANG_PREF[base] || [];
    const scoreOf = (v) => {
      const n = v.name.toLowerCase();
      const i = pref.findIndex((p) => n.includes(p));
      return i === -1 ? 999 : i;
    };
    pool = pool.slice().sort((a, b) => scoreOf(a) - scoreOf(b) || a.name.localeCompare(b.name));
    return pool[0] ? pool[0].id : '';
  }

  function getConfig() { return _config || { slots: {} }; }
  function slotCfg(slot) { return (getConfig().slots || {})[slot] || {}; }

  // 解析槽位最终音色对象：pinned 且存在 → 语言默认 → pinned（名可能跨上下文）→ null
  function resolveVoiceObj(slot, lang) {
    const cfg = slotCfg(slot);
    if (cfg.voice) { const v = findVoice(cfg.voice); if (v) return v; }
    const defId = defaultVoiceFor(lang);
    if (defId) { const v = findVoice(defId); if (v) return v; }
    if (cfg.voice) return { id: cfg.voice, name: cfg.voice, lang: lc(lang), source: 'pinned' };
    return null;
  }
  function resolveVoice(slot, lang) { const v = resolveVoiceObj(slot, lang); return v ? v.id : ''; }

  // 旧 key → ttsVoiceConfig（一次性）
  async function migrateLegacy() {
    const slots = {};
    try {
      const r = await global.chrome.storage.local.get(['ttsVoiceSel', 'aiSpeakVoice', 'instantDictVoice']);
      if (r.ttsVoiceSel) { slots.selection = { voice: r.ttsVoiceSel }; slots.chatMessage = { voice: r.ttsVoiceSel }; }
      if (r.aiSpeakVoice) slots.aiAnswer = { voice: r.aiSpeakVoice };
      if (r.instantDictVoice) slots.dictWord = { voice: r.instantDictVoice };
    } catch (e) {}
    const cfg = { slots };
    try { await global.chrome.storage.local.set({ [STORAGE_KEY]: cfg }); } catch (e) {}
    return cfg;
  }

  async function loadConfig() {
    if (_config) return _config;
    if (_loadPromise) return _loadPromise;
    _loadPromise = (async () => {
      let cfg = null;
      try { cfg = (await global.chrome.storage.local.get(STORAGE_KEY))[STORAGE_KEY]; } catch (e) {}
      if (!cfg || typeof cfg !== 'object') cfg = await migrateLegacy();
      if (!cfg.slots || typeof cfg.slots !== 'object') cfg.slots = {};
      _config = cfg;
      return cfg;
    })();
    return _loadPromise;
  }

  async function setSlotVoice(slot, voice) {
    const cfg = getConfig();
    cfg.slots = cfg.slots || {};
    cfg.slots[slot] = Object.assign({}, cfg.slots[slot], { voice: voice || '' });
    _config = cfg;
    try { await global.chrome.storage.local.set({ [STORAGE_KEY]: cfg }); } catch (e) {}
  }

  // 其他端修改配置 → 同步内存
  try {
    if (global.chrome && global.chrome.storage && global.chrome.storage.onChanged) {
      global.chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && changes[STORAGE_KEY]) _config = changes[STORAGE_KEY].newValue || { slots: {} };
      });
    }
  } catch (e) {}

  global.TABU_TTS = {
    SLOTS, STORAGE_KEY, LANG_PREF,
    listVoices, refreshVoices, defaultVoiceFor,
    getConfig, slotCfg, resolveVoice, resolveVoiceObj,
    loadConfig, setSlotVoice,
  };
})(typeof globalThis !== 'undefined' ? globalThis : self);
