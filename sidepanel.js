// ========== 工具函数 ==========
// 状态/提示统一走 fixed 悬浮 toast（不占布局，页面不因提醒而跳动）
function showToast(message, duration = 1500, type = '') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  if (type) {
    toast.classList.remove('success', 'error', 'info');
    toast.classList.add(type);
  }
  toast.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => {
    toast.classList.remove('show', 'success', 'error', 'info');
  }, duration);
}

function showStatus(message, type = 'info') {
  showToast(message, 3000, type);
}

// ========== favicon / 内部页面图标（tabler 风格内联 SVG，不用 emoji） ==========
const TABU_ICONS = {
  puzzle: 'M4 12a3 3 0 0 1 3-3h2a1 1 0 0 0 1-1V6a2 2 0 0 1 2-2 2 2 0 0 1 2 2v2a1 1 0 0 0 1 1h2a3 3 0 0 1 3 3 3 3 0 0 1-3 3h-2a1 1 0 0 0-1 1v2a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-2a1 1 0 0 0-1-1H7a3 3 0 0 1-3-3z',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.09a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.09a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  bookmark: 'M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>',
  download: '<path d="M12 3v12m0 0l4-4m-4 4l-4-4"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>',
  home: '<path d="M3 10l9-7 9 7v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 21v-6a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v6"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a15 15 0 0 1 0 18a15 15 0 0 1 0-18"/>',
  browser: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 8h18"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  camera: '<path d="M4 8h2l2-3h8l2 3h2a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="12" r="4"/>',
};
function svgIcon(inner, size = 16) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
}
// chrome:// 等浏览器内部页面 → 对应图标
function internalPageIcon(url) {
  if (!url) return '';
  const u = String(url).toLowerCase();
  const has = (s) => u.includes(s);
  if (has('extensions')) return svgIcon(TABU_ICONS.puzzle);           // 扩展管理页 → 拼图
  if (has('settings') || has('preferences') || has('flags')) return svgIcon(TABU_ICONS.gear);
  if (has('bookmarks')) return svgIcon(TABU_ICONS.bookmark);
  if (has('history')) return svgIcon(TABU_ICONS.clock);
  if (has('downloads')) return svgIcon(TABU_ICONS.download);
  if (has('newtab') || has('new-tab-page') || u === 'about:blank') return svgIcon(TABU_ICONS.home);
  if (has('apps')) return svgIcon(TABU_ICONS.grid);
  if (u.startsWith('chrome://') || u.startsWith('edge://') || u.startsWith('brave://') || u.startsWith('opera://')) return svgIcon(TABU_ICONS.browser);
  return '';
}
// 标签图标：
//  · 浏览器内部页面（chrome:// 等）→ 直接显示我们定义的 SVG 图标（不再叠 favicon，内部页 favicon 不稳定/会覆盖）
//  · 普通网页 → 优先官方 favicon（img 覆盖在 SVG 之上），缺失/失败则回退为 SVG
function tabIcon(tab) {
  const internal = internalPageIcon(tab.url);
  if (internal) return `<span class="favicon-wrap">${internal}</span>`;
  const img = tab.favIconUrl ? `<img src="${escapeHtml(tab.favIconUrl)}" class="tab-favicon" alt="" onerror="this.remove()" />` : '';
  return `<span class="favicon-wrap">${svgIcon(TABU_ICONS.globe)}${img}</span>`;
}

// ========== 翻译请求锁 ==========

// ========== 安装天数 ==========
async function getInstallDays() {
  return new Promise((resolve) => {
    chrome.storage.local.get('installDate', (result) => {
      let installDate = result.installDate;
      if (!installDate) {
        installDate = Date.now();
        chrome.storage.local.set({ installDate });
        resolve(0);
      } else {
        const now = Date.now();
        const diff = now - installDate;
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        resolve(days);
      }
    });
  });
}

// ========== 加载统计 ==========
async function loadStats() {
  try {
    const windows = await chrome.windows.getAll({ populate: true });
    let totalTabs = 0;
    for (const win of windows) totalTabs += win.tabs.length;
    const statEl = document.getElementById('statCurrent');
    if (statEl) statEl.textContent = totalTabs;

    const stats = await sendMessage('getStats');
    if (stats) {
      const snapEl = document.getElementById('statSnapshots');
      if (snapEl) snapEl.textContent = stats.snapshots || 0;
      const bmEl = document.getElementById('statBookmarks');
      if (bmEl) bmEl.textContent = stats.bookmarkVersions || 0;
      const histEl = document.getElementById('statHistory');
      if (histEl) histEl.textContent = stats.historyVersions || 0;
    }
    const days = await getInstallDays();
    const daysEl = document.getElementById('statDays');
    if (daysEl) daysEl.textContent = days;
  } catch (e) {
    console.warn('加载统计失败', e);
  }
}

// ========== 导出 ==========
async function exportData() {
  try {
    showStatus(I18N.t('preparingExport'), 'info');
    const result = await sendMessage('exportData');
    if (result.success) {
      showStatus(I18N.t('exportSuccess'), 'success');
    } else {
      showStatus(I18N.t('exportFail') + (result.message || ''), 'error');
    }
  } catch (e) {
    showStatus(I18N.t('exportFail') + e.message, 'error');
  }
}

async function mailExport() {
  try {
    showStatus(I18N.t('preparingExport'), 'info');
    const data = await sendMessage('getExportData');
    if (!data || !data.version) {
      showStatus(I18N.t('getExportFail'), 'error');
      return;
    }
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const dateStr = new Date().toISOString().slice(0, 10);
    const fileName = `TabU AI备份_${dateStr}.json`;
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    showStatus(I18N.t('backupSaved', fileName), 'info');
    const subject = encodeURIComponent(I18N.t('mailSubject'));
    const body = encodeURIComponent(I18N.t('mailBody', fileName));
    window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
  } catch (e) {
    showStatus(I18N.t('opFail') + e.message, 'error');
  }
}

// ========== 红蓝层切换（红层默认） ==========
function switchLayer(layerName) {
  const app = document.getElementById('app');
  if (app) app.dataset.layer = layerName;
  document.querySelectorAll('.layer-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.layer === layerName);
  });
  const red = document.getElementById('layer-red');
  const blue = document.getElementById('layer-blue');
  if (red) red.classList.toggle('active', layerName === 'red');
  if (blue) blue.classList.toggle('active', layerName === 'blue');
  if (layerName === 'red') { loadStats(); }
  if (layerName === 'blue') { updateCardPreview(); renderInjectHistory(); } // 卡片工具 + AI 会话历史迁至蓝区
}

// ========== 红区两标签切换（朗读页面 / 转写；默认都不选中，选中才展开，再点收起） ==========
// force=true：内部跳转（如转写结果「发给 AI」）强制展开目标，不因已展开而收起。
function switchTool(toolName, force) {
  chrome.tts.stop();
  const btn = document.querySelector(`.tool-tab[data-tool="${toolName}"]`);
  const isActive = btn && btn.classList.contains('active');
  const show = force ? true : !isActive;
  document.querySelectorAll('.tool-tab').forEach(b => {
    b.classList.toggle('active', show && b.dataset.tool === toolName);
  });
  ['asr'].forEach(name => {
    const panel = document.getElementById(`panel-${name}`);
    if (panel) panel.classList.toggle('hidden', name !== toolName || !show);
  });
  if (show && toolName === 'asr') { syncAsrBackendUi(); loadAsrDevices(); }
}

// 转写标签页：仅在当前页含 <audio>/<video> 时显示（否则隐藏并收起面板）
async function updateAsrTabVisibility() {
  let hasMedia = false;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const url = (tab && tab.url) || '';
    if (tab && tab.id != null && !/^(chrome|edge|about|chrome-extension):/.test(url)) {
      const res = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => !!document.querySelector('video, audio')
      });
      hasMedia = !!(res && res[0] && res[0].result);
    }
  } catch (e) {}
  const btn = document.querySelector('.tool-tab[data-tool="asr"]');
  if (btn) btn.classList.toggle('hidden', !hasMedia);
  // 无可用工具标签时隐藏整行
  const tabsRow = document.querySelector('.tool-tabs');
  if (tabsRow) {
    const anyVisible = Array.from(tabsRow.querySelectorAll('.tool-tab')).some(b => !b.classList.contains('hidden'));
    tabsRow.classList.toggle('hidden', !anyVisible);
  }
  if (!hasMedia) {
    const panel = document.getElementById('panel-asr');
    if (panel && !panel.classList.contains('hidden')) switchTool('asr'); // 收起转写面板
  }
}

// ========== 打印 ==========
async function printCurrentTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) throw new Error(I18N.t('noActiveTab'));
    if (tab.url.startsWith('chrome://') || tab.url.startsWith('edge://') || tab.url.startsWith('about:')) {
      showStatus(I18N.t('cannotPrintInternal'), 'error');
      return;
    }
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => window.print()
    });
    showStatus(I18N.t('printDialogOpened'), 'info');
  } catch (e) {
    showStatus(I18N.t('printFail') + e.message, 'error');
  }
}

// ========== 朗读功能 ==========
// 文本来源（getSelectedText / getFullPageText / extractMainText）已统一收进 capabilities.js

// 填充语音列表
let allVoices = [];
let ttsLangFirstRender = true;   // 首次填充时按系统语言定默认筛选语言，之后保留用户选择

// BCP-47 语言代码 → 显示名（zh / en）。未知代码回退为「基础语言名 + 地区码」。
const TTS_LANG_LABELS = {
  'zh-cn': { zh: '中国大陆', en: 'Mainland China' },
  'zh-tw': { zh: '中国台湾', en: 'Taiwan' },
  'zh-hk': { zh: '中国香港', en: 'Hong Kong' },
  'zh-sg': { zh: '新加坡中文', en: 'Singapore (Chinese)' },
  'zh': { zh: '中文', en: 'Chinese' },
  'cmn-cn': { zh: '普通话（中国大陆）', en: 'Mandarin (Mainland China)' },
  'cmn-tw': { zh: '普通话（台湾）', en: 'Mandarin (Taiwan)' },
  'yue-hk': { zh: '粤语（香港）', en: 'Cantonese (Hong Kong)' },
  'en-us': { zh: '美国英语', en: 'English (US)' },
  'en-gb': { zh: '英国英语', en: 'English (UK)' },
  'en-au': { zh: '澳大利亚英语', en: 'English (Australia)' },
  'en-ca': { zh: '加拿大英语', en: 'English (Canada)' },
  'en-in': { zh: '印度英语', en: 'English (India)' },
  'en-ie': { zh: '爱尔兰英语', en: 'English (Ireland)' },
  'en-nz': { zh: '新西兰英语', en: 'English (New Zealand)' },
  'en': { zh: '英语', en: 'English' },
  'ja-jp': { zh: '日语（日本）', en: 'Japanese (Japan)' },
  'ja': { zh: '日语', en: 'Japanese' },
  'ko-kr': { zh: '韩语（韩国）', en: 'Korean (South Korea)' },
  'ko': { zh: '韩语', en: 'Korean' },
  'fr-fr': { zh: '法语（法国）', en: 'French (France)' },
  'fr-ca': { zh: '法语（加拿大）', en: 'French (Canada)' },
  'fr': { zh: '法语', en: 'French' },
  'de-de': { zh: '德语（德国）', en: 'German (Germany)' },
  'de-at': { zh: '德语（奥地利）', en: 'German (Austria)' },
  'de-ch': { zh: '德语（瑞士）', en: 'German (Switzerland)' },
  'de': { zh: '德语', en: 'German' },
  'es-es': { zh: '西班牙语（西班牙）', en: 'Spanish (Spain)' },
  'es-mx': { zh: '西班牙语（墨西哥）', en: 'Spanish (Mexico)' },
  'es-ar': { zh: '西班牙语（阿根廷）', en: 'Spanish (Argentina)' },
  'es-us': { zh: '西班牙语（美国）', en: 'Spanish (US)' },
  'es': { zh: '西班牙语', en: 'Spanish' },
  'pt-br': { zh: '葡萄牙语（巴西）', en: 'Portuguese (Brazil)' },
  'pt-pt': { zh: '葡萄牙语（葡萄牙）', en: 'Portuguese (Portugal)' },
  'pt': { zh: '葡萄牙语', en: 'Portuguese' },
  'it-it': { zh: '意大利语（意大利）', en: 'Italian (Italy)' },
  'it': { zh: '意大利语', en: 'Italian' },
  'ru-ru': { zh: '俄语（俄罗斯）', en: 'Russian (Russia)' },
  'ru': { zh: '俄语', en: 'Russian' },
  'ar-sa': { zh: '阿拉伯语（沙特）', en: 'Arabic (Saudi Arabia)' },
  'ar-eg': { zh: '阿拉伯语（埃及）', en: 'Arabic (Egypt)' },
  'ar': { zh: '阿拉伯语', en: 'Arabic' },
  'hi-in': { zh: '印地语（印度）', en: 'Hindi (India)' },
  'hi': { zh: '印地语', en: 'Hindi' },
  'nl-nl': { zh: '荷兰语（荷兰）', en: 'Dutch (Netherlands)' },
  'nl': { zh: '荷兰语', en: 'Dutch' },
  'pl-pl': { zh: '波兰语（波兰）', en: 'Polish (Poland)' },
  'pl': { zh: '波兰语', en: 'Polish' },
  'tr-tr': { zh: '土耳其语（土耳其）', en: 'Turkish (Turkey)' },
  'tr': { zh: '土耳其语', en: 'Turkish' },
  'sv-se': { zh: '瑞典语（瑞典）', en: 'Swedish (Sweden)' },
  'sv': { zh: '瑞典语', en: 'Swedish' },
  'da-dk': { zh: '丹麦语（丹麦）', en: 'Danish (Denmark)' },
  'da': { zh: '丹麦语', en: 'Danish' },
  'nb-no': { zh: '挪威语（挪威）', en: 'Norwegian (Norway)' },
  'no': { zh: '挪威语', en: 'Norwegian' },
  'fi-fi': { zh: '芬兰语（芬兰）', en: 'Finnish (Finland)' },
  'fi': { zh: '芬兰语', en: 'Finnish' },
  'cs-cz': { zh: '捷克语（捷克）', en: 'Czech (Czechia)' },
  'cs': { zh: '捷克语', en: 'Czech' },
  'uk-ua': { zh: '乌克兰语（乌克兰）', en: 'Ukrainian (Ukraine)' },
  'uk': { zh: '乌克兰语', en: 'Ukrainian' },
  'th-th': { zh: '泰语（泰国）', en: 'Thai (Thailand)' },
  'th': { zh: '泰语', en: 'Thai' },
  'id-id': { zh: '印尼语（印尼）', en: 'Indonesian (Indonesia)' },
  'id': { zh: '印尼语', en: 'Indonesian' },
  'vi-vn': { zh: '越南语（越南）', en: 'Vietnamese (Vietnam)' },
  'vi': { zh: '越南语', en: 'Vietnamese' },
  'el-gr': { zh: '希腊语（希腊）', en: 'Greek (Greece)' },
  'el': { zh: '希腊语', en: 'Greek' },
  'he-il': { zh: '希伯来语（以色列）', en: 'Hebrew (Israel)' },
  'he': { zh: '希伯来语', en: 'Hebrew' },
  'ro-ro': { zh: '罗马尼亚语（罗马尼亚）', en: 'Romanian (Romania)' },
  'hu-hu': { zh: '匈牙利语（匈牙利）', en: 'Hungarian (Hungary)' },
  'sk-sk': { zh: '斯洛伐克语（斯洛伐克）', en: 'Slovak (Slovakia)' },
  'hr-hr': { zh: '克罗地亚语（克罗地亚）', en: 'Croatian (Croatia)' },
  'bg-bg': { zh: '保加利亚语（保加利亚）', en: 'Bulgarian (Bulgaria)' },
  // 南亚语系（常见于系统 TTS）
  'bn-bd': { zh: '孟加拉语（孟加拉）', en: 'Bengali (Bangladesh)' },
  'bn-in': { zh: '孟加拉语（印度）', en: 'Bengali (India)' },
  'bn': { zh: '孟加拉语', en: 'Bengali' },
  'te-in': { zh: '泰卢固语（印度）', en: 'Telugu (India)' },
  'te': { zh: '泰卢固语', en: 'Telugu' },
  'ta-in': { zh: '泰米尔语（印度）', en: 'Tamil (India)' },
  'ta-lk': { zh: '泰米尔语（斯里兰卡）', en: 'Tamil (Sri Lanka)' },
  'ta': { zh: '泰米尔语', en: 'Tamil' },
  'mr-in': { zh: '马拉地语（印度）', en: 'Marathi (India)' },
  'mr': { zh: '马拉地语', en: 'Marathi' },
  'gu-in': { zh: '古吉拉特语（印度）', en: 'Gujarati (India)' },
  'gu': { zh: '古吉拉特语', en: 'Gujarati' },
  'kn-in': { zh: '卡纳达语（印度）', en: 'Kannada (India)' },
  'kn': { zh: '卡纳达语', en: 'Kannada' },
  'ml-in': { zh: '马拉雅拉姆语（印度）', en: 'Malayalam (India)' },
  'ml': { zh: '马拉雅拉姆语', en: 'Malayalam' },
  'pa-in': { zh: '旁遮普语（印度）', en: 'Punjabi (India)' },
  'pa-pk': { zh: '旁遮普语（巴基斯坦）', en: 'Punjabi (Pakistan)' },
  'pa': { zh: '旁遮普语', en: 'Punjabi' },
  'ur-pk': { zh: '乌尔都语（巴基斯坦）', en: 'Urdu (Pakistan)' },
  'ur-in': { zh: '乌尔都语（印度）', en: 'Urdu (India)' },
  'ur': { zh: '乌尔都语', en: 'Urdu' },
  'ne-np': { zh: '尼泊尔语（尼泊尔）', en: 'Nepali (Nepal)' },
  'ne': { zh: '尼泊尔语', en: 'Nepali' },
  'si-lk': { zh: '僧伽罗语（斯里兰卡）', en: 'Sinhala (Sri Lanka)' },
  'si': { zh: '僧伽罗语', en: 'Sinhala' },
  // 伊比利亚/高加索等
  'ca-es': { zh: '加泰罗尼亚语（西班牙）', en: 'Catalan (Spain)' },
  'ca': { zh: '加泰罗尼亚语', en: 'Catalan' },
  'eu-es': { zh: '巴斯克语（西班牙）', en: 'Basque (Spain)' },
  'eu': { zh: '巴斯克语', en: 'Basque' },
  'gl-es': { zh: '加利西亚语（西班牙）', en: 'Galician (Spain)' },
  'gl': { zh: '加利西亚语', en: 'Galician' },
  // 其它常见
  'af-za': { zh: '南非荷兰语（南非）', en: 'Afrikaans (South Africa)' },
  'af': { zh: '南非荷兰语', en: 'Afrikaans' },
  'sw-ke': { zh: '斯瓦希里语（肯尼亚）', en: 'Swahili (Kenya)' },
  'sw': { zh: '斯瓦希里语', en: 'Swahili' },
  'fa-ir': { zh: '波斯语（伊朗）', en: 'Persian (Iran)' },
  'fa': { zh: '波斯语', en: 'Persian' },
  'ms-my': { zh: '马来语（马来西亚）', en: 'Malay (Malaysia)' },
  'ms': { zh: '马来语', en: 'Malay' },
  'fil-ph': { zh: '菲律宾语（菲律宾）', en: 'Filipino (Philippines)' },
  'tl-ph': { zh: '他加禄语（菲律宾）', en: 'Tagalog (Philippines)' },
  'tl': { zh: '他加禄语', en: 'Tagalog' },
  'zu-za': { zh: '祖鲁语（南非）', en: 'Zulu (South Africa)' },
  'zu': { zh: '祖鲁语', en: 'Zulu' },
  'xh-za': { zh: '科萨语（南非）', en: 'Xhosa (South Africa)' },
  'xh': { zh: '科萨语', en: 'Xhosa' },
  'cy-gb': { zh: '威尔士语（英国）', en: 'Welsh (UK)' },
  'cy': { zh: '威尔士语', en: 'Welsh' },
  'ga-ie': { zh: '爱尔兰语（爱尔兰）', en: 'Irish (Ireland)' },
  'ga': { zh: '爱尔兰语', en: 'Irish' },
  'is-is': { zh: '冰岛语（冰岛）', en: 'Icelandic (Iceland)' },
  'is': { zh: '冰岛语', en: 'Icelandic' },
  'lt-lt': { zh: '立陶宛语（立陶宛）', en: 'Lithuanian (Lithuania)' },
  'lt': { zh: '立陶宛语', en: 'Lithuanian' },
  'lv-lv': { zh: '拉脱维亚语（拉脱维亚）', en: 'Latvian (Latvia)' },
  'lv': { zh: '拉脱维亚语', en: 'Latvian' },
  'et-ee': { zh: '爱沙尼亚语（爱沙尼亚）', en: 'Estonian (Estonia)' },
  'et': { zh: '爱沙尼亚语', en: 'Estonian' },
  'sl-si': { zh: '斯洛文尼亚语（斯洛文尼亚）', en: 'Slovenian (Slovenia)' },
  'sl': { zh: '斯洛文尼亚语', en: 'Slovenian' },
  'sr-rs': { zh: '塞尔维亚语（塞尔维亚）', en: 'Serbian (Serbia)' },
  'sr': { zh: '塞尔维亚语', en: 'Serbian' },
  'sq-al': { zh: '阿尔巴尼亚语（阿尔巴尼亚）', en: 'Albanian (Albania)' },
  'sq': { zh: '阿尔巴尼亚语', en: 'Albanian' },
  'ka-ge': { zh: '格鲁吉亚语（格鲁吉亚）', en: 'Georgian (Georgia)' },
  'ka': { zh: '格鲁吉亚语', en: 'Georgian' },
  'hy-am': { zh: '亚美尼亚语（亚美尼亚）', en: 'Armenian (Armenia)' },
  'hy': { zh: '亚美尼亚语', en: 'Armenian' },
  'az-az': { zh: '阿塞拜疆语（阿塞拜疆）', en: 'Azerbaijani (Azerbaijan)' },
  'az': { zh: '阿塞拜疆语', en: 'Azerbaijani' },
  'kk-kz': { zh: '哈萨克语（哈萨克斯坦）', en: 'Kazakh (Kazakhstan)' },
  'kk': { zh: '哈萨克语', en: 'Kazakh' },
  'uz-uz': { zh: '乌兹别克语（乌兹别克斯坦）', en: 'Uzbek (Uzbekistan)' },
  'uz': { zh: '乌兹别克语', en: 'Uzbek' },
  'mn-mn': { zh: '蒙古语（蒙古）', en: 'Mongolian (Mongolia)' },
  'mn': { zh: '蒙古语', en: 'Mongolian' },
  'km-kh': { zh: '高棉语（柬埔寨）', en: 'Khmer (Cambodia)' },
  'km': { zh: '高棉语', en: 'Khmer' },
  'lo-la': { zh: '老挝语（老挝）', en: 'Lao (Laos)' },
  'lo': { zh: '老挝语', en: 'Lao' },
  'my-mm': { zh: '缅甸语（缅甸）', en: 'Burmese (Myanmar)' },
  'my': { zh: '缅甸语', en: 'Burmese' },
  'jv-id': { zh: '爪哇语（印尼）', en: 'Javanese (Indonesia)' },
  'jv': { zh: '爪哇语', en: 'Javanese' },
  'am-et': { zh: '阿姆哈拉语（埃塞俄比亚）', en: 'Amharic (Ethiopia)' },
  'am': { zh: '阿姆哈拉语', en: 'Amharic' },
  'mt-mt': { zh: '马耳他语（马耳他）', en: 'Maltese (Malta)' },
  'mt': { zh: '马耳他语', en: 'Maltese' }
};

// 系统语言 → 默认筛选语言：精确匹配优先，其次同一语言按系统地区选（zh-CN→大陆、zh-TW→台湾、zh-HK→香港、en→美式），
// 其它语言按常见地区偏好；系统语言完全不匹配 → 兜底美国英语（en-us），无 en-us 则 'all'。
function resolveDefaultFilterLang(codeList) {
  const codes = (codeList || []).map(c => String(c).toLowerCase());
  const has = (c) => codes.includes(c);
  const sys = String(navigator.language || (navigator.languages && navigator.languages[0]) || '').toLowerCase();
  const [base, region] = sys.split(/[-_]/);
  if (has(sys)) return sys;
  if (base === 'zh') {
    const r = (region || '').toUpperCase();
    if (r === 'TW') return has('zh-tw') ? 'zh-tw' : 'zh-cn';
    if (r === 'HK') return has('zh-hk') ? 'zh-hk' : 'zh-tw';
    if (r === 'HANT') return has('zh-tw') ? 'zh-tw' : 'zh-hk';
    return has('zh-cn') ? 'zh-cn' : (has('zh-tw') ? 'zh-tw' : 'zh-hk');
  }
  if (base === 'en') {
    if (region && has('en-' + region.toLowerCase())) return 'en-' + region.toLowerCase();
    return has('en-us') ? 'en-us' : (has('en-gb') ? 'en-gb' : 'en-us');
  }
  const COMMON = {
    fr: 'fr-fr', de: 'de-de', ja: 'ja-jp', ko: 'ko-kr', es: 'es-es', pt: 'pt-br',
    it: 'it-it', ru: 'ru-ru', ar: 'ar-sa', hi: 'hi-in', nl: 'nl-nl', pl: 'pl-pl',
    tr: 'tr-tr', sv: 'sv-se', da: 'da-dk', nb: 'nb-no', fi: 'fi-fi', cs: 'cs-cz',
    uk: 'uk-ua', th: 'th-th', id: 'id-id', vi: 'vi-vn'
  };
  if (COMMON[base] && has(COMMON[base])) return COMMON[base];
  if (region && has(base + '-' + region.toLowerCase())) return base + '-' + region.toLowerCase();
  const byBase = codes.find(c => c.startsWith(base + '-'));
  if (byBase) return byBase;
  // 兜底：美国英语（无则 all）
  return has('en-us') ? 'en-us' : 'all';
}

// 语言代码 → 当前 UI 语言（document.documentElement.lang 由 I18N.apply 维护）下的显示名
function ttsLangLabel(code) {
  const uiLang = (document.documentElement.lang || 'zh').toLowerCase().startsWith('zh') ? 'zh' : 'en';
  const key = String(code || '').toLowerCase();
  const entry = TTS_LANG_LABELS[key];
  if (entry) return entry[uiLang] || entry.en || key;
  const base = key.split('-')[0];
  const baseEntry = TTS_LANG_LABELS[base];
  const region = key.split('-').slice(1).join('-').toUpperCase();
  if (baseEntry) return (baseEntry[uiLang] || baseEntry.en) + (region ? ' · ' + region : '');
  return key;
}

// 过滤不可用语音：Google 系列语音在部分网络极慢/不可用（外网慢、大陆网连不上），直接隐藏避免困扰。
// 若全部语音都被过滤（如系统只有 Google TTS），回退展示全部，避免空列表。
function usableVoices() {
  const usable = allVoices.filter(v => !/^google[\s-]/i.test(String(v.voiceName || '').trim()));
  return usable.length ? usable : allVoices;
}

async function populateVoices() {
  const select = document.getElementById('ttsVoiceBlue');
  const langFilter = document.getElementById('ttsLangFilterBlue');
  if (!select || !langFilter) return;
  try {
    // 音色来源：优先 Web SpeechSynthesis（全浏览器通用，Edge 也支持；chrome.tts 在 Edge 不完整），
    // 为空时回退 chrome.tts.getVoices
    let voices = [];
    try {
      if (window.speechSynthesis) {
        voices = (speechSynthesis.getVoices() || []).map(v => ({ voiceName: v.name, lang: v.lang }));
      }
    } catch (e) {}
    if (!voices.length) {
      voices = await new Promise((resolve) => {
        try { chrome.tts.getVoices((v) => resolve(v || [])); } catch (e) { resolve([]); }
      });
    }
    allVoices = voices;
    // 语言筛选下拉：显示可读名称（随界面语言中/英切换），value 仍为 BCP-47 代码；Google 语音不参与
    const langSet = new Set();
    for (const v of usableVoices()) {
      if (v.lang) langSet.add(v.lang);
    }
    const codes = Array.from(langSet);
    const uiLang = (document.documentElement.lang || 'zh').toLowerCase().startsWith('zh') ? 'zh' : 'en';
    const prev = langFilter.value;
    langFilter.innerHTML = `<option value="all">${I18N.t('allLanguages')}</option>`;
    codes.sort((a, b) => ttsLangLabel(a).localeCompare(ttsLangLabel(b), uiLang));
    for (const code of codes) {
      const opt = document.createElement('option');
      opt.value = code;
      opt.textContent = ttsLangLabel(code);
      langFilter.appendChild(opt);
    }
    // 选中值：优先存储的用户选择；首次（无存储）按系统语言定默认；之后保留 DOM 状态。
    // 注意：resolveDefaultFilterLang 返回小写 code，需映射回 option 的原始大小写（如 zh-CN），select 才能命中。
    const mapToOption = (def) => (def === 'all' ? 'all' : (codes.find(c => c.toLowerCase() === def) || 'all'));
    const st = await chrome.storage.local.get('ttsLangFilterSel').catch(() => ({}));
    let val;
    if (st.ttsLangFilterSel && (st.ttsLangFilterSel === 'all' || codes.some(c => c.toLowerCase() === String(st.ttsLangFilterSel).toLowerCase()))) {
      val = mapToOption(st.ttsLangFilterSel); // 存储的用户选择优先（重开侧边栏后保持）
      ttsLangFirstRender = false;
    } else if (ttsLangFirstRender && codes.length > 0) {
      // 首次拿到真实语音列表才应用系统语言默认（语音懒加载时首次可能为空，等 voiceschanged 再补）
      val = mapToOption(resolveDefaultFilterLang(codes));
      ttsLangFirstRender = false;
    } else {
      val = prev;
    }
    // 保留的值在当前列表里已不存在（语音列表变化）→ 按系统语言重算默认
    if (val !== 'all' && !codes.some(c => c.toLowerCase() === String(val).toLowerCase())) {
      val = mapToOption(resolveDefaultFilterLang(codes));
    }
    langFilter.value = val;
    applyVoiceFilter();
  } catch (e) {
    console.warn('获取语音列表失败:', e);
    select.innerHTML = `<option value="">${I18N.t('getVoicesFail')}</option>`;
  }
}

async function applyVoiceFilter() {
  const select = document.getElementById('ttsVoiceBlue');
  const langFilter = document.getElementById('ttsLangFilterBlue');
  if (!select || !langFilter) return;
  const filterLang = langFilter.value;
  const pool = usableVoices();
  const filtered = filterLang === 'all' ? pool : pool.filter(v => v.lang === filterLang);
  const unique = [];
  const seen = new Set();
  for (const v of filtered) {
    const key = v.voiceName || v.lang;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(v);
    }
  }
  unique.sort((a, b) => (a.voiceName || '').localeCompare(b.voiceName || ''));
  select.innerHTML = '';
  if (unique.length === 0) {
    select.innerHTML = `<option value="">${I18N.t('noVoices')}</option>`;
    return;
  }
  for (const v of unique) {
    const opt = document.createElement('option');
    opt.value = v.voiceName || '';
    opt.textContent = `${v.voiceName || I18N.t('unnamed')} (${v.lang})${v.gender ? ' ' + v.gender : ''}`;
    select.appendChild(opt);
  }
  // 应用存储的音色；存储音色不在当前列表（换设备/系统语音变化）→ 回退当前界面语言第一个音色 → 第一个
  try {
    const st = await chrome.storage.local.get('ttsVoiceSel');
    const wanted = st.ttsVoiceSel;
    if (wanted) {
      const hit = Array.from(select.options).find(o => o.value === wanted);
      if (hit) {
        select.value = wanted;
      } else {
        const uiZh = (document.documentElement.lang || 'zh').toLowerCase().startsWith('zh');
        const wantLang = uiZh ? 'zh' : 'en';
        const langHit = unique.find(v => String(v.lang || '').toLowerCase().startsWith(wantLang));
        if (langHit && langHit.voiceName) select.value = langHit.voiceName;
        logDebug('tts', '存储的音色不在可用列表，已回退: ' + (select.value || '系统默认'), true);
      }
    }
  } catch (e) {}
  if (select.options.length > 0 && !select.value) select.selectedIndex = 0;
  mirrorVoiceExtras(select);
}

// 蓝区系统音色列表 → 同步到主对话面板 i 设置的「音色」与「回复音色」选项
function mirrorVoiceExtras(voiceSel) {
  if (!voiceSel) return;
  const chatVoice = document.getElementById('chatTtsVoice');
  if (chatVoice) {
    const cur = chatVoice.value;
    chatVoice.innerHTML = voiceSel.innerHTML;
    chatVoice.value = cur;
  }
  // LLM 回复音色：首项"跟随系统语音"由 HTML 提供，需保留
  const prefSel = document.getElementById('aiSpeakVoice');
  if (prefSel) {
    const cur = prefSel.value;
    prefSel.innerHTML = voiceSel.innerHTML;
    prefSel.insertBefore(new Option(I18N.t('aiSpeakVoiceFollow'), ''), prefSel.firstChild);
    prefSel.value = cur;
  }
}

// ===== 思维链（思考内容）处理 =====
// 已知思考标题行：DeepSeek「已深度思考…」/ Kimi「思考过程」/ ChatGPT「Thought for…」/ API 思考标注等
const THINKING_LINE_RE = /^\s*(?:已深度思考.*|深度思考.*|思考过程.*|思考中.*|推理过程.*|已思考.*|thought for.*|thinking\s*(?:…|\.\.\.)?|reasoning\s*(?:…|\.\.\.)?)$/i;

// 分离思考标题行与正文（尽力而为）：站点提取阶段（askInSite）已尽量扣除思维链 DOM，
// 这里兜底剥离漏网的标题行。返回 { thinking, body }，thinking 为空串表示没有识别到思考内容。
function splitThinkingText(text) {
  const lines = String(text || '').split('\n');
  const thinkLines = [];
  let i = 0;
  while (i < lines.length && THINKING_LINE_RE.test(lines[i])) { thinkLines.push(lines[i].trim()); i++; }
  const rest = lines.slice(i).join('\n').replace(/^\s*\n+/, '');
  return { thinking: thinkLines.join('\n'), body: rest || String(text || '') };
}

// 朗读用：默认剥掉思考标题行（设置「朗读包含思考内容」开启时跳过剥离，由调用方决定是否拼入 reasoning）
function stripThinkingForTts(text) {
  return splitThinkingText(text).body;
}

// 朗读用：去掉 Markdown 标记（链接只读标签、不读 URL），避免把引用链接读成网址
function stripMarkdownForTts(text) {
  return String(text || '')
    .replace(/\[([^\]]+)\]\(https?:\/\/[^\s)]+\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1$2')
    .replace(/^#{1,4}\s+/gm, '');
}

// ===== Markdown 轻量渲染（无依赖）=====
// 支持：代码块 ```、行内代码 `x`、标题 #~####、粗体 **x**、斜体 *x*、无序/有序列表、段落换行。
// 思考标题行渲染为灰色（.md-think）；所有内容先 escapeHtml 再转换，安全。
function renderMarkdown(src) {
  // 先把跨行的 [label](url) 归一化为单行，避免链接被逐行渲染拆散而无法点击
  const normalized = String(src || '').replace(/\[([^\]]+)\]\(\s*(https?:\/\/[^\s)]+)\s*\)/g, (m, label, url) => {
    let l = label.replace(/\s+/g, ' ').trim();
    if (/^[-\s\d]+$/.test(l)) l = l.replace(/[^\d]/g, ''); // 引用编号（如 "- 2"）只留数字
    return '[' + l + '](' + url + ')';
  });
  const lines = escapeHtml(normalized).split('\n');
  const out = [];
  let inCode = false, codeBuf = [], listOpen = null;
  const closeList = () => { if (listOpen) { out.push('</' + listOpen + '>'); listOpen = null; } };
  const inline = (s) => s
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a class="md-link" href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  for (const raw of lines) {
    const t = raw.trim();
    if (t.startsWith('```')) {
      if (inCode) { out.push('<pre><code>' + codeBuf.join('\n') + '</code></pre>'); codeBuf = []; inCode = false; }
      else { closeList(); inCode = true; }
      continue;
    }
    if (inCode) { codeBuf.push(raw); continue; }
    if (!t) { closeList(); continue; }
    if (THINKING_LINE_RE.test(raw)) { closeList(); out.push('<div class="md-think">' + inline(t) + '</div>'); continue; }
    const h = t.match(/^(#{1,4})\s+(.*)$/);
    if (h) { closeList(); out.push('<div class="md-h" data-level="' + h[1].length + '">' + inline(h[2]) + '</div>'); continue; }
    const ul = t.match(/^[-*•]\s+(.*)$/);
    if (ul) { if (listOpen !== 'ul') { closeList(); out.push('<ul>'); listOpen = 'ul'; } out.push('<li>' + inline(ul[1]) + '</li>'); continue; }
    const ol = t.match(/^\d+[.、)]\s+(.*)$/);
    if (ol) { if (listOpen !== 'ol') { closeList(); out.push('<ol>'); listOpen = 'ol'; } out.push('<li>' + inline(ol[1]) + '</li>'); continue; }
    closeList();
    out.push('<p>' + inline(t) + '</p>');
  }
  if (inCode) out.push('<pre><code>' + codeBuf.join('\n') + '</code></pre>');
  closeList();
  return out.join('');
}

// 系统 TTS 朗读：优先 Web SpeechSynthesis（全浏览器通用——chrome.tts 在 Edge 不完整，
// 是"选了音色却不发声"的根因）；SpeechSynthesis 不可用/无音色时回退 chrome.tts。
async function speakSystemTtsSafe(text, statusEl, triggerBtn, voiceOverride, round) {
  if (round && activeSpeakRound !== round) { logDebug('tts', '#' + round + ' 系统朗读已被取代，跳过'); return; }
  let voice = voiceOverride || document.getElementById('ttsVoiceBlue')?.value || '';
  const rate = parseFloat(document.getElementById('ttsRate')?.value) || 1;
  const pitch = parseFloat(document.getElementById('ttsPitch')?.value) || 1;
  const volume = parseFloat(document.getElementById('ttsVolume')?.value) || 1;
  const uiZh = (document.documentElement.lang || 'zh').toLowerCase().startsWith('zh');
  const wantLang = uiZh ? 'zh' : 'en';

  // ① SpeechSynthesis 路径
  try {
    if (window.speechSynthesis) {
      const voices = speechSynthesis.getVoices() || [];
      // 选中的音色名 → 语音对象；找不到 → 当前界面语言的第一个音色 → 系统默认
      let v = voice ? voices.find(x => x.name === voice) : null;
      if (!v) v = voices.find(x => String(x.lang || '').toLowerCase().startsWith(wantLang)) || null;
      if (voices.length && (v || voice)) {
        logDebug('tts', '系统朗读(SpeechSynthesis): voice=' + (v ? v.name : '(默认)') + ' · ' + text.length + ' 字');
        const u = new SpeechSynthesisUtterance(text);
        if (v) { u.voice = v; u.lang = v.lang; } else { u.lang = uiZh ? 'zh-CN' : 'en-US'; }
        u.rate = Math.max(0.1, Math.min(10, rate));
        u.pitch = Math.max(0, Math.min(2, pitch));
        u.volume = Math.max(0, Math.min(1, volume));
        u.onstart = () => {
          setSpeakButtonState(triggerBtn, true);
          if (statusEl) statusEl.textContent = I18N.t('speaking');
        };
        u.onend = () => {
          setSpeakButtonState(triggerBtn, false);
          if (statusEl) statusEl.textContent = I18N.t('speakDone');
        };
        u.onerror = (ev) => {
          setSpeakButtonState(triggerBtn, false);
          if (statusEl) statusEl.textContent = I18N.t('speakError') + (ev.error || I18N.t('unknown'));
        };
        speechSynthesis.cancel();
        speechSynthesis.speak(u);
        return;
      }
    }
  } catch (e) {
    logDebug('tts', 'SpeechSynthesis 失败，回退 chrome.tts：' + ((e && e.message) || ''), true);
  }

  // ② chrome.tts 兜底（Chrome 桌面端可用；Edge 可能无声）
  logDebug('tts', '系统朗读(chrome.tts 兜底): voice=' + (voice || '(默认)') + ' · ' + text.length + ' 字');
  try {
    runAction('tts', text, {
      voice, rate, pitch, volume,
      onEvent: (event) => {
        if (event.type === 'start') setSpeakButtonState(triggerBtn, true);
        else if (event.type === 'end' || event.type === 'interrupted' || event.type === 'cancelled' || event.type === 'error') setSpeakButtonState(triggerBtn, false);
        if (statusEl) {
          if (event.type === 'start') statusEl.textContent = I18N.t('speaking');
          else if (event.type === 'end') statusEl.textContent = I18N.t('speakDone');
          else if (event.type === 'error') {
            statusEl.textContent = I18N.t('speakError') + (event.errorMessage || I18N.t('unknown'));
            showStatus(I18N.t('readErrorStatus'), 'error');
          }
        }
      }
    });
  } catch (e) {
    if (statusEl) statusEl.textContent = I18N.t('speakError') + ((e && e.message) || I18N.t('unknown'));
    showStatus(I18N.t('readErrorStatus'), 'error');
  }
}

function doSpeak(text, statusEl, triggerBtn, forceSystem, voiceOverride) {
  if (!text || !text.trim()) {
    showStatus(I18N.t('noTextToSpeak'), 'info');
    if (statusEl) statusEl.textContent = I18N.t('noText');
    return;
  }
  // 思考内容默认不朗读：剥掉思维链（站点提取残留的思维块/标题行）；设置开启时保留
  if (!currentVoiceConfig.ttsReadThinking) text = stripThinkingForTts(text);
  // Markdown 标记（含引用链接）不朗读：只读链接文字，不读 URL
  text = stripMarkdownForTts(text);
  if (!text || !text.trim()) { showStatus(I18N.t('noTextToSpeak'), 'info'); if (statusEl) statusEl.textContent = I18N.t('noText'); return; }
  // 朗读轮次：同一回答只朗读一次（008 §4）
  const round = ++speakRoundSeq;
  activeSpeakRound = round;
  logDebug('tts', '#' + round + ' doSpeak 开始（' + text.length + ' 字）');
  // 本地朗读引擎分流：Kokoro / Qwen3 走本地服务 /speak（fetch + AudioContext 播放），否则系统 chrome.tts
  // forceSystem=true（如语音工作台自动朗读）→ 固定用系统 TTS，即时出声，不受本地引擎慢首帧影响
  // 统一来源「自动」时按可达性解析；否则沿用显式引擎
  resolveEffectiveTtsEngine().then(async (engine) => {
    if (activeSpeakRound !== round) { logDebug('tts', '#' + round + ' 已被新朗读取代，跳过'); return; }
    if (forceSystem) engine = 'system'; // 语音工作台等固定用系统 TTS，即时出声
    if (engine !== 'system') {
      try {
        await speakLocalTts(text, statusEl, triggerBtn, engine, round);
        return;
      } catch (e) {
        if (e && e.name === 'AbortError') return; // 用户主动停止，不回退
        // 已出声但中途失败 → 绝不回退系统整段重读（否则会出现「读一遍再读一遍」，见 008 §4）
        if (e && e.audioStarted) {
          logDebug('tts', '#' + round + ' 本地/云端引擎中途失败但已出声，跳过系统回退（防二次朗读）', true);
          if (statusEl) statusEl.textContent = I18N.t('readErrorStatus');
          return;
        }
        // 本地/云端引擎完全没出声（服务未启动、Key 失效等）→ 回退系统 TTS，避免无法朗读
        logDebug('tts', '#' + round + ' 本地/云端引擎失败，回退系统 TTS：' + ((e && e.message) || ''), true);
        if (statusEl) statusEl.textContent = I18N.t('ttsLocalFallback');
      }
    }
    await speakSystemTtsSafe(text, statusEl, triggerBtn, voiceOverride, round);
  });
  showStatus(I18N.t('startSpeaking'), 'success');
  if (statusEl) statusEl.textContent = I18N.t('speakStarting');
}

// ========== 本地 TTS 朗读（Kokoro / Qwen3，走本地服务 /speak） ==========
let localTtsAbort = null;   // AbortController：停止 = abort
let localTtsActive = false;
let localTtsCtx = null;     // AudioContext 单例
let localTtsSrc = null;     // 当前播放 source（停止时停掉）
let localTtsPlayed = false; // 本次本地朗读是否已出声（用于「已出声不回退重读」，防读两遍）

// 朗读轮次（008 §4）：每次 doSpeak 递增；异步引擎解析回到时若轮次已被更新则放弃，
// 避免同一回答被多条路径（自动朗读 + 语音管线）重复朗读。
let speakRoundSeq = 0;
let activeSpeakRound = 0;

// 自动朗读去重（008 §4 候选 2）：同一回答短时间内只自动朗读一次
let lastAutoSpeak = { key: '', at: 0 };
const AUTO_SPEAK_DEDUP_MS = 8000;

// 自动朗读统一入口（工作台/语音管线共用）：按规范化文本 + 时间窗去重，避免双触发读两遍。
// triggerBtn = 该回答消息底部的小喇叭按钮：传入后朗读期间会切换为「停止」，用户可点击中断。
function autoSpeakAnswer(text, statusEl, forceSystem, voiceOverride, triggerBtn) {
  const key = String(text || '').trim();
  if (!key) return;
  const now = Date.now();
  if (key === lastAutoSpeak.key && now - lastAutoSpeak.at < AUTO_SPEAK_DEDUP_MS) {
    logDebug('tts', '自动朗读去重：同一回答 ' + (AUTO_SPEAK_DEDUP_MS / 1000) + 's 内已朗读，跳过重复触发');
    return;
  }
  lastAutoSpeak = { key, at: now };
  doSpeak(key, statusEl, triggerBtn || null, forceSystem, voiceOverride);
}

// 当前对话流里最近一条 AI 回答的小喇叭按钮（供自动朗读显示「停止」态）
function lastBotSpeakBtn() {
  const body = document.getElementById('voiceOutputContent');
  if (!body) return null;
  const bots = body.querySelectorAll('.voice-msg.voice-bot .msg-speak');
  return bots.length ? bots[bots.length - 1] : null;
}

// ===== 流式朗读（008 §3）：边流式生成边按句合成/播放 TTS =====
// 模块：按句切分 → 播放队列（顺序播放）→ 停止清空。与「自动朗读」开关并存，
// 开关 ttsStreamSpeak 打开且自动朗读开启时，回答在流式过程中即开始朗读。
let streamSpeakOn = false;
async function loadStreamSpeakPref() {
  try { const r = await chrome.storage.local.get('ttsStreamSpeak'); streamSpeakOn = r.ttsStreamSpeak === true; } catch (e) {}
}
function isStreamSpeakEnabled() { return streamSpeakOn === true; }
function setStreamSpeakPref(on) { streamSpeakOn = !!on; chrome.storage.local.set({ ttsStreamSpeak: !!on }).catch(() => {}); }

let _streamSpeaker = { token: 0, active: false, stopped: true, buffer: '', queue: [], speaking: false, spoke: false, btn: null };
function streamSpeakStart(btn) {
  // 打断上一轮朗读，避免新旧句子叠加
  try { if (window.speechSynthesis) speechSynthesis.cancel(); } catch (e) {}
  if (localTtsActive && localTtsAbort) { try { localTtsAbort.abort(); } catch (e) {} }
  _streamSpeaker.token++;
  const token = _streamSpeaker.token;
  _streamSpeaker.active = true; _streamSpeaker.stopped = false;
  _streamSpeaker.buffer = ''; _streamSpeaker.queue = []; _streamSpeaker.speaking = false; _streamSpeaker.spoke = false;
  _streamSpeaker.btn = btn || null;
  if (btn) setSpeakButtonState(btn, true); // 朗读中该消息小喇叭变为「停止」，可点击中断
  warmAudioContext();
  logDebug('tts', '流式朗读开始 #' + token);
  return token;
}
function streamSpeakIsCurrent(token) { return _streamSpeaker.active && !_streamSpeaker.stopped && _streamSpeaker.token === token; }
function streamSpeakClearBtn() {
  if (_streamSpeaker.btn) { setSpeakButtonState(_streamSpeaker.btn, false); _streamSpeaker.btn = null; }
}
function streamSpeakFeed(token, text) {
  if (!streamSpeakIsCurrent(token) || !text) return;
  _streamSpeaker.buffer += text;
  const { done, rest } = splitStreamSentences(_streamSpeaker.buffer);
  _streamSpeaker.buffer = rest;
  if (done.length) { _streamSpeaker.queue.push(...done); streamSpeakPump(token); }
}
function streamSpeakEnd(token) {
  if (!streamSpeakIsCurrent(token)) return;
  const rest = _streamSpeaker.buffer.trim();
  if (rest) _streamSpeaker.queue.push(rest);
  _streamSpeaker.buffer = '';
  streamSpeakPump(token);
}
function streamSpeakStop() {
  if (!_streamSpeaker.active && !_streamSpeaker.queue.length && !_streamSpeaker.speaking) { streamSpeakClearBtn(); return; }
  _streamSpeaker.stopped = true; _streamSpeaker.active = false;
  _streamSpeaker.buffer = ''; _streamSpeaker.queue = [];
  streamSpeakClearBtn();
  logDebug('tts', '流式朗读已停止并清空队列');
}
async function streamSpeakPump(token) {
  if (_streamSpeaker.speaking || !streamSpeakIsCurrent(token)) return;
  const s = _streamSpeaker.queue.shift();
  if (!s) { streamSpeakClearBtn(); return; } // 队列播完 → 小喇叭恢复
  _streamSpeaker.speaking = true;
  try { await streamSpeakOne(s, token); } catch (e) { logDebug('tts', '流式分句朗读失败: ' + ((e && e.message) || ''), true); }
  _streamSpeaker.speaking = false;
  if (streamSpeakIsCurrent(token)) streamSpeakPump(token);
}
async function streamSpeakOne(sentence, token) {
  const text = String(sentence || '').trim();
  if (!text || !streamSpeakIsCurrent(token)) return;
  let engine = await resolveEffectiveTtsEngine();
  if (currentVoiceConfig.voiceCircleForceSystem) engine = 'system';
  if (!streamSpeakIsCurrent(token)) return;
  _streamSpeaker.spoke = true;
  if (engine === 'system') {
    await speakUtteranceOnce(text);
  } else {
    // 本地/云端：逐句请求 /speak 播放（顺序，避免重叠；quiet 抑制每句弹提示）
    await speakLocalTts(text, null, null, engine, 0, true);
  }
}
// 流式分句：终止符 = 中英文句末标点或换行；过短片段与后文合并后再播放
function splitStreamSentences(buf) {
  const done = [];
  let last = 0;
  const re = /([。！？；\n]+|[.!?;](?=\s))/g;
  let m;
  while ((m = re.exec(buf)) !== null) {
    done.push(buf.slice(last, m.index + m[0].length));
    last = m.index + m[0].length;
  }
  const rest = buf.slice(last);
  const MIN = 4;
  const merged = [];
  let pending = '';
  for (const s of done) {
    pending += s;
    if (pending.trim().length >= MIN) { merged.push(pending); pending = ''; }
  }
  return { done: merged, rest: pending + rest };
}
// 系统 TTS 单句：Promise 于播完/出错/停止时 resolve（供流式队列顺序控制）
function speakUtteranceOnce(text) {
  return new Promise((resolve) => {
    if (!window.speechSynthesis) return resolve();
    try {
      const voices = speechSynthesis.getVoices() || [];
      const voiceName = document.getElementById('ttsVoiceBlue')?.value || '';
      const uiZh = (document.documentElement.lang || 'zh').toLowerCase().startsWith('zh');
      const wantLang = uiZh ? 'zh' : 'en';
      let v = voiceName ? voices.find(x => x.name === voiceName) : null;
      if (!v) v = voices.find(x => String(x.lang || '').toLowerCase().startsWith(wantLang)) || null;
      const rate = parseFloat(document.getElementById('ttsRate')?.value) || 1;
      const pitch = parseFloat(document.getElementById('ttsPitch')?.value) || 1;
      const volume = parseFloat(document.getElementById('ttsVolume')?.value) || 1;
      const u = new SpeechSynthesisUtterance(text);
      if (v) { u.voice = v; u.lang = v.lang; } else { u.lang = uiZh ? 'zh-CN' : 'en-US'; }
      u.rate = Math.max(0.1, Math.min(10, rate));
      u.pitch = Math.max(0, Math.min(2, pitch));
      u.volume = Math.max(0, Math.min(1, volume));
      let done = false;
      const fin = () => { if (done) return; done = true; resolve(); };
      u.onend = fin; u.onerror = fin;
      speechSynthesis.speak(u);
    } catch (e) { resolve(); }
  });
}

// 按句切块（本地模型单次文本长度受限），每块 ≤ maxChars 字
// ========== /speak 流式帧协议（013-P1）：整段提交，服务端逐句流式输出（去双段切分） ==========
// 帧格式：每帧 = 4 字节大端长度 + 一段 WAV；旧服务端（audio/wav 整段）兜底单帧
async function forEachSpeakFrame(res, onFrame) {
  const ct = (res.headers.get('content-type') || '').toLowerCase();
  if (ct.includes('octet-stream')) {
    const reader = res.body.getReader();
    let buf = new Uint8Array(0);
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value || !value.length) continue;
      const tmp = new Uint8Array(buf.length + value.length);
      tmp.set(buf, 0);
      tmp.set(value, buf.length);
      buf = tmp;
      while (buf.length >= 4) {
        const len = ((buf[0] << 24) | (buf[1] << 16) | (buf[2] << 8) | buf[3]) >>> 0;
        if (buf.length < 4 + len) break;
        // 帧必须是 ArrayBuffer（decodeAudioData 要求）；slice 到独立副本避免偏移问题
        const frame = buf.slice(4, 4 + len);
        await onFrame(frame.buffer.slice(frame.byteOffset, frame.byteOffset + frame.byteLength));
        buf = buf.slice(4 + len);
      }
    }
  } else {
    await onFrame(await res.arrayBuffer());
  }
}

// 播放流式帧：生产者逐帧解码入队（双缓冲，保持连续），消费者顺序播放；
// console.log 首帧延迟 / 帧数 / 总时长（调试日志）
async function playSpeakStream(res, playbackRate, volume) {
  const queue = [];
  const t0 = performance.now();
  let producerDone = false, producerError = null, stopped = false;
  let firstFrameMs = -1, frameCount = 0;
  const aborted = () => stopped || (localTtsAbort && localTtsAbort.signal.aborted);

  async function produce() {
    try {
      await forEachSpeakFrame(res, async (wavBuf) => {
        while (queue.length >= 2 && !aborted()) await new Promise(r => setTimeout(r, 20));
        if (aborted()) return;
        const pcm = await decodeAndResample(wavBuf, 24000);
        if (aborted()) return;
        if (!pcm.length) return;
        if (firstFrameMs < 0) firstFrameMs = performance.now() - t0;
        frameCount++;
        queue.push(pcm);
      });
      producerDone = true;
    } catch (e) {
      if (e.name === 'AbortError' || aborted()) return;
      producerError = e;
    }
  }

  const producer = produce();
  while (true) {
    if (producerError) throw producerError;
    if (aborted()) { stopped = true; throw new DOMException('aborted', 'AbortError'); }
    if (queue.length === 0) {
      if (producerDone) { stopped = true; break; }
      await new Promise(r => setTimeout(r, 20));
      continue;
    }
    const pcm = queue.shift();
    await playLocalBuffer(pcm, playbackRate, volume);
  }
  stopped = true;
  await producer.catch(() => {});
  logDebug('tts', '流式完成 · 首帧 ' + (firstFrameMs >= 0 ? firstFrameMs.toFixed(0) : '?') + 'ms · 共 ' + frameCount + ' 帧 · 总 ' + (performance.now() - t0).toFixed(0) + 'ms');
  return firstFrameMs;
}

async function speakLocalTts(text, statusEl, triggerBtn, engine, round, quiet) {
  if (!SPEAK_ENGINES.includes(engine)) return;
  if (round && activeSpeakRound !== round) { logDebug('tts', '#' + round + ' 本地朗读已被取代，跳过'); return; }
  const serverUrl = (currentVoiceConfig.voiceLocalServer || 'http://127.0.0.1:9528').replace(/\/+$/, '');
  if (localTtsActive) stopSpeaking();
  localTtsAbort = new AbortController();
  localTtsActive = true;
  localTtsPlayed = false;
  setSpeakButtonState(triggerBtn, true);
  if (statusEl) statusEl.textContent = I18N.t('speakStarting');
  if (!quiet) showStatus(I18N.t('startSpeaking'), 'success');
  const rate = parseFloat(document.getElementById('ttsRate')?.value) || 1;
  const volume = parseFloat(document.getElementById('ttsVolume')?.value) || 1;
  const tClick = performance.now();
  logDebug('tts', '发起朗读（' + engine + '，' + text.length + ' 字）');
  try {
    // 013-P1：整段提交，服务端逐句流式合成（不再客户端 ≤150 字切块 → 去双段切分）
    let body;
    if (engine === 'kokoro') body = { text, sid: Number(currentVoiceConfig.ttsLocalSid) || 18, speed: Math.max(0.5, Math.min(2, rate)) };
    else if (engine === 'qwen3') body = { text, voice: currentVoiceConfig.ttsLocalVoice || 'Vivian', language: 'Auto', speed: 1 };
    else if (engine === 'azure') body = { text, azure: { key: currentVoiceConfig.azureTtsKey, region: currentVoiceConfig.azureTtsRegion, voice: currentVoiceConfig.azureTtsVoice } }; // 🟦 Azure（独立协议）
    else if (engine === 'cosyvoice') body = { text, cosyvoice: { key: currentVoiceConfig.cosyTtsKey, model: currentVoiceConfig.cosyTtsModel, voice: currentVoiceConfig.cosyTtsVoice } }; // 🔵 CosyVoice（独立协议）
    else body = { text, cloud: { baseUrl: currentVoiceConfig.cloudTtsBase, apiKey: currentVoiceConfig.cloudTtsKey, model: currentVoiceConfig.cloudTtsModel, voice: currentVoiceConfig.cloudTtsVoice } }; // cloud（🌐 云端 TTS）
    const res = await fetch(serverUrl + '/speak?engine=' + engine, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: localTtsAbort.signal
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || '本地服务 HTTP ' + res.status);
    }
    const tRes = performance.now() - tClick; // 点击 → 响应头（服务端已开始流式）
    const firstFrame = await playSpeakStream(res, (engine === 'qwen3' || engine === 'cloud') ? rate : 1, volume);
    if (firstFrame >= 0) {
      logDebug('tts', '点击→首帧 ' + (tRes + firstFrame).toFixed(0) + 'ms（请求 ' + tRes.toFixed(0) + ' + 流式首帧 ' + firstFrame.toFixed(0) + '）');
    }
    if (localTtsAbort && localTtsAbort.signal.aborted) throw new DOMException('aborted', 'AbortError');
    if (statusEl) statusEl.textContent = I18N.t('speakDone');
    if (!quiet) showStatus(I18N.t('speakDone'), 'success');
    logDebug('tts', '朗读完成 · 总 ' + (performance.now() - tClick).toFixed(0) + 'ms');
  } catch (e) {
    if (e.name === 'AbortError' || (localTtsAbort && localTtsAbort.signal.aborted)) {
      if (statusEl) statusEl.textContent = '';
      if (!quiet) showStatus(I18N.t('stopSpeak'), 'info');
      logDebug('tts', '已停止');
    } else {
      // fetch 网络层失败（本地服务未启动）→ 明确提示；HTTP 错误已含服务端 detail
      const isConnErr = e instanceof TypeError && !/^本地服务|^HTTP/.test(String(e.message));
      const msg = isConnErr ? I18N.t('ttsLocalServerOffline') : ((e && e.message) || I18N.t('unknown'));
      if (statusEl) statusEl.textContent = I18N.t('speakError') + msg;
      if (!quiet) showStatus(I18N.t('readErrorStatus'), 'error');
      logDebug('tts', '朗读错误: ' + msg, true);
      // 标记「是否已出声」：doSpeak 据此决定是否回退系统 TTS（已出声则不回退，防读两遍）
      if (e && typeof e === 'object') e.audioStarted = localTtsPlayed;
      throw e; // 向上传递：doSpeak 据此回退系统 TTS（AbortError 除外，已在上面处理）
    }
  } finally {
    localTtsActive = false;
    localTtsAbort = null;
    localTtsSrc = null;
    setSpeakButtonState(triggerBtn, false);
  }
}

// 播放一段 PCM（AudioContext 单例，支持语速 playbackRate / 音量 gain）；resolve 于播完或停止
function playLocalBuffer(pcm, playbackRate, volume) {
  return new Promise((resolve) => {
    try {
      if (!localTtsCtx) localTtsCtx = new (window.AudioContext || window.webkitAudioContext)();
      const ctx = localTtsCtx;
      ctx.resume().catch(() => {});
      const buffer = ctx.createBuffer(1, pcm.length, 24000);
      buffer.copyToChannel(pcm, 0);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.playbackRate.value = playbackRate || 1;
      const gain = ctx.createGain();
      gain.gain.value = (typeof volume === 'number' && volume >= 0) ? volume : 1;
      src.connect(gain);
      gain.connect(ctx.destination);
      localTtsSrc = src;
      src.onended = () => resolve();
      const signal = localTtsAbort ? localTtsAbort.signal : null;
      if (signal) {
        signal.addEventListener('abort', () => { try { src.stop(); } catch (e) {} resolve(); }, { once: true });
      }
      localTtsPlayed = true; // 已开始出声（供「已出声不回退」判定）
      src.start();
    } catch (e) {
      resolve();
    }
  });
}

async function speakFullPage(triggerBtn) {
  const statusEl = document.getElementById('ttsStatus');
  try {
    const text = await getFullPageText();
    if (!text.trim()) {
      showStatus(I18N.t('pageNoText'), 'info');
      if (statusEl) statusEl.textContent = I18N.t('noText');
      return;
    }
    doSpeak(text, statusEl, triggerBtn || document.getElementById('ttsSpeakFull'));
  } catch (e) {
    showStatus(I18N.t('speakFail') + e.message, 'error');
    if (statusEl) statusEl.textContent = I18N.t('errorPrefix') + e.message;
  }
}

let activeSpeakBtn = null;   // 当前显示为「停止」的朗读按钮（三个朗读按钮之一）

// 让某个朗读按钮进入/退出「朗读中」态：文本按钮显示「⏹ 停止」，图标按钮只加 .speaking 高亮
function setSpeakButtonState(btn, active) {
  if (!btn) return;
  if (active) {
    if (activeSpeakBtn && activeSpeakBtn !== btn) setSpeakButtonState(activeSpeakBtn, false);
    if (btn.dataset.origHtml == null) btn.dataset.origHtml = btn.innerHTML;
    btn.dataset.origTitle = btn.dataset.i18nTitle || btn.dataset.origTitle || '';
    const isIcon = !!btn.querySelector('svg');
    if (!isIcon) {
      btn.dataset.origI18n = btn.dataset.i18n || btn.dataset.origI18n;
      btn.textContent = I18N.t('ttsStop');
      if (btn.dataset.origTitle) btn.title = I18N.t('ttsStop');
    }
    btn.classList.add('speaking');
    activeSpeakBtn = btn;
  } else {
    if (activeSpeakBtn === btn) activeSpeakBtn = null;
    if (btn.dataset.origHtml != null) {
      btn.innerHTML = btn.dataset.origHtml; // 还原原始内容（含 SVG 图标）
      delete btn.dataset.origHtml;
    }
    if (btn.dataset.origTitle) btn.title = I18N.t(btn.dataset.origTitle);
    btn.classList.remove('speaking');
  }
}

// 是否有朗读正在进行（供 Stop 按钮判断是否需要中断，避免无谓提示）
function isSpeakingActive() {
  return !!(activeSpeakBtn || localTtsActive || _streamSpeaker.active || _streamSpeaker.speaking ||
    (window.speechSynthesis && speechSynthesis.speaking));
}

function stopSpeaking() {
  // 流式朗读：清空队列并停止后续分句（008 §3）
  streamSpeakStop();
  // Web SpeechSynthesis 朗读停止（系统 TTS 优先路径）
  try { if (window.speechSynthesis) speechSynthesis.cancel(); } catch (e) {}
  // 本地 TTS 朗读中：abort 请求 + 停当前音频源
  if (localTtsActive) {
    if (localTtsAbort) localTtsAbort.abort();
    if (localTtsSrc) { try { localTtsSrc.stop(); } catch (e) {} localTtsSrc = null; }
    if (activeSpeakBtn) setSpeakButtonState(activeSpeakBtn, false);
    localTtsActive = false;
    localTtsAbort = null;
    const statusEl = document.getElementById('ttsStatus');
    if (statusEl) statusEl.textContent = '';   // 已停止只弹 toast，不占状态区
    showStatus(I18N.t('stopSpeak'), 'info');
    return;
  }
  chrome.tts.stop();
  if (activeSpeakBtn) setSpeakButtonState(activeSpeakBtn, false);
  const statusEl = document.getElementById('ttsStatus');
  if (statusEl) statusEl.textContent = '';   // 已停止只弹 toast，不占状态区
  showStatus(I18N.t('stopSpeak'), 'info');
}

// ========== 卡片面板 ==========
function cardTextValue() {
  const input = document.getElementById('cardInput');
  return input ? (input.value || '') : '';
}

// ========== 卡片背景/文本色（自定义取色器 + 配色方案） ==========
// 颜色统一以取色器 input 为唯一来源（预设色块 / 配色方案点选都会同步到它）
function currentColor(which) {
  const id = which === 'bg' ? 'ctlBgColor' : 'ctlTextColor';
  const el = document.getElementById(id);
  // 默认：背景浅白 / 文本深黑（非纯白纯黑）
  return (el && el.value) ? el.value : (which === 'bg' ? '#f6f5f2' : '#1a1a1a');
}

function setCurrentColor(which, hex) {
  const id = which === 'bg' ? 'ctlBgColor' : 'ctlTextColor';
  const input = document.getElementById(id);
  if (input) input.value = hex;
  // 同步预设色块高亮：命中某预设则点亮，否则全部熄灭
  const wrapId = which === 'bg' ? 'ctlBg' : 'ctlColor';
  const h = String(hex || '').toLowerCase();
  document.querySelectorAll('#' + wrapId + ' .swatch').forEach(s => {
    s.classList.toggle('sel', (s.dataset.c || '').toLowerCase() === h);
  });
}

// ========== 卡片配色方案（card-colors.json 懒加载，源自 ~/documents/github/color 项目） ==========
let CARD_COLORS = null;        // { sources, palettes[] }
let paletteSource = '';        // 当前来源筛选（'' = 全部）
let paletteTarget = 'bg';      // 弹窗应用目标（bg / text）

async function openPalette(which) {
  paletteTarget = which;
  const overlay = document.getElementById('paletteOverlay');
  if (!overlay) return;
  if (!CARD_COLORS) {
    try {
      const res = await fetch('card-colors.json');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      CARD_COLORS = await res.json();
    } catch (e) {
      showStatus(I18N.t('cardPaletteLoadFail'), 'error');
      return;
    }
  }
  renderPaletteSrcs();
  renderPaletteList();
  overlay.classList.remove('hidden');
}

function closePalette() {
  const overlay = document.getElementById('paletteOverlay');
  if (overlay) overlay.classList.add('hidden');
}

function renderPaletteSrcs() {
  const wrap = document.getElementById('paletteSrcs');
  if (!wrap || !CARD_COLORS) return;
  wrap.innerHTML = '';
  const srcs = CARD_COLORS.sources || {};
  const mk = (s, label) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'palette-src' + (paletteSource === s ? ' active' : '');
    b.textContent = label;
    b.addEventListener('click', () => {
      paletteSource = paletteSource === s ? '' : s;
      renderPaletteSrcs();
      renderPaletteList();
    });
    wrap.appendChild(b);
  };
  mk('', I18N.t('cardPaletteAll'));
  for (const s of Object.keys(srcs)) mk(s, srcs[s]);
}

function renderPaletteList() {
  const body = document.getElementById('paletteBody');
  if (!body || !CARD_COLORS) return;
  const palettes = CARD_COLORS.palettes || [];
  const srcs = CARD_COLORS.sources || {};
  body.innerHTML = '';
  let shown = 0;
  for (const p of palettes) {
    if (paletteSource && p.source !== paletteSource) continue;
    shown++;
    const item = document.createElement('div');
    item.className = 'palette-item';
    const label = document.createElement('div');
    label.className = 'palette-label';
    label.textContent = p.label;
    const tag = document.createElement('span');
    tag.className = 'palette-src-tag';
    tag.textContent = srcs[p.source] || p.source;
    label.appendChild(tag);
    item.appendChild(label);
    const strip = document.createElement('div');
    strip.className = 'palette-strip';
    for (const hex of (p.colors || [])) {
      const b = document.createElement('button');
      b.style.background = hex;
      b.title = hex;
      b.addEventListener('click', () => {
        setCurrentColor(paletteTarget, hex);
        updateCardPreview();
        closePalette();
      });
      strip.appendChild(b);
    }
    item.appendChild(strip);
    body.appendChild(item);
  }
  if (!shown) {
    const empty = document.createElement('div');
    empty.className = 'palette-empty';
    empty.textContent = I18N.t('cardPaletteEmpty');
    body.appendChild(empty);
  }
}

// 用输入框 + 控件状态刷新 HTML 实时预览（与 CardRenderer 渲染参数对齐）
function updateCardPreview() {
  const textEl = document.getElementById('cardText');
  const cardEl = document.getElementById('elegantCard');
  const fitEl = document.getElementById('ecFit');
  if (!textEl || !cardEl) return;
  const text = cardTextValue();
  textEl.textContent = text || I18N.t('emptyPreview');
  textEl.style.fontFamily = currentFontFamilyCSS();
  const bg = currentColor('bg');
  const color = currentColor('text');
  cardEl.style.background = bg;
  textEl.style.color = color;
  cardEl.style.borderRadius = (document.getElementById('ctlRadius')?.value || 8) + 'px';
  textEl.style.padding = (document.getElementById('ctlPad')?.value || 18) + 'px';
  textEl.style.fontSize = (document.getElementById('ctlFontSize')?.value || 60) + 'px';
  const fontSizeV = document.getElementById('ctlFontSizeV');
  if (fontSizeV) fontSizeV.textContent = document.getElementById('ctlFontSize')?.value || 60;
  // 文本框偏移（X/Y，作用于 .ec-fit 而非正文，保证与 canvas 逻辑像素一致；canvas 的 posX/posY 不随内容缩放）
  const posX = getPos('X');
  const posY = getPos('Y');
  const posV = document.getElementById('ctlPosV');
  if (posV) posV.textContent = posX + ', ' + posY;

  // 宽高：宽度来自滑块；比例固定时锁定宽高比。正文按用户字号排版（不做等比缩放）：
  // 放得下则垂直居中（与 canvas contentTop 一致）；放不下则顶对齐裁切（与 canvas 一致）。
  const W = getCardWidth();
  const ratio = document.getElementById('ctlRatio')?.value || '16:9';
  const RATIOS = { '1:1': 1, '2:3': 3 / 2, '3:2': 2 / 3, '4:3': 3 / 4, '16:9': 9 / 16, '9:16': 16 / 9 };
  const ratioH = RATIOS[ratio] || 0;
  const H = ratioH ? Math.round(W * ratioH) : 0;
  cardEl.style.width = W + 'px';
  if (ratioH) {
    cardEl.style.height = H + 'px';
    cardEl.style.overflow = 'hidden';
    cardEl.style.display = 'flex';
    // 文本框自然高 > 卡片可用高 → 溢出裁切，顶对齐（与 canvas 相同）；否则垂直居中
    const availH = H - 2 * 14;   // 与 .elegant-card padding:14 对齐
    const fitH = fitEl ? fitEl.offsetHeight : 0;
    cardEl.style.alignItems = fitH > availH ? 'flex-start' : 'center';
    cardEl.style.justifyContent = 'center';
  } else {
    cardEl.style.height = '';
    cardEl.style.overflow = '';
    cardEl.style.display = '';
    cardEl.style.alignItems = '';
    cardEl.style.justifyContent = '';
  }

  // 正文字号完全由用户控制：固定比例下不再对 .ec-fit 整体缩放（尊重用户选择的字号），
  // 文本过长时被卡片 overflow:hidden 裁切，与 canvas 一致（WYSIWYG）；文本框偏移仍以 translate 施加。
  if (fitEl) {
    fitEl.style.transform = 'translate(' + posX + 'px,' + posY + 'px)';
  }
  // 标题「TabU AI 摘录卡片」字号随卡片宽度联动（与 card.js titleSize 同公式，clamp 9~20）
  const titleEl = cardEl.querySelector('.ec-title');
  if (titleEl) {
    titleEl.style.fontSize = Math.max(9, Math.min(20, Math.round(W / 62))) + 'px';
  }

  // 卡片预览整卡缩放：逻辑宽度默认 800，在窄面板里等比缩小避免横向溢出。
  // transform 不改布局尺寸，需给 .ec-stage 设高度 = 卡片可视高，占住后续控件位置；
  // 下载 PNG 仍按逻辑宽度 W 渲染，预览只是等比缩略（宽高比与 canvas 一致，WYSIWYG）。
  const stageEl = document.getElementById('ecStage');
  if (stageEl) {
    const stageW = stageEl.clientWidth;
    const scale = stageW > 0 ? Math.min(1, (stageW - EC_PREVIEW_GUTTER) / W) : 1;
    cardPreviewScale = scale;
    const visualH = ratioH ? H * scale : (cardEl.offsetHeight || H) * scale;
    cardEl.style.transform = scale < 1 ? 'scale(' + scale + ')' : 'none';
    stageEl.style.height = Math.round(visualH) + 'px';
  }
}

function cardImportSelected() {
  getSelectedText().then((text) => {
    if (!text.trim()) { showStatus(I18N.t('noSelectionAny'), 'info'); return; }
    const input = document.getElementById('cardInput');
    if (input) input.value = text;
    updateCardPreview();
    showStatus(I18N.t('imported'), 'success');
  });
}

async function cardPaste() {
  try {
    // 走统一文本来源 TEXT_SOURCES.clipboard（capabilities.js 通用粘贴文本）
    const text = await TABU_CAPS.TEXT_SOURCES.clipboard.get();
    if (!text || !text.trim()) { showStatus(I18N.t('clipboardEmpty'), 'error'); return; }
    const input = document.getElementById('cardInput');
    if (input) input.value = text;
    updateCardPreview();
    showStatus(I18N.t('pasteSuccess'), 'success');
  } catch (e) {
    showStatus(I18N.t('clipboardFail') + e.message, 'error');
  }
}

// 收集控件参数，供 CardRenderer.render 使用（下载的 PNG 与预览一致，所见即所得）
function getCardOptions() {
  return {
    width: getCardWidth(),
    ratio: document.getElementById('ctlRatio')?.value || '16:9',
    fontFamily: currentFontFamilyCSS(),
    // 完整字体条目传给渲染管线：capabilities.downloadCardImage 渲染前先 loadFont 确保 canvas 字体就绪
    font: selectedFontEntry(),
    // 标题「芫荽」(Iansui)：渲染前同样确保已加载
    titleFont: CARD_TITLE_FONT,
    titleFontFamily: '"Iansui"',
    bgColor: currentColor('bg'),
    textColor: currentColor('text'),
    fontSize: parseInt(document.getElementById('ctlFontSize')?.value) || 60,
    radius: parseInt(document.getElementById('ctlRadius')?.value) || 8,
    padding: parseInt(document.getElementById('ctlPad')?.value) || 18,
    posX: getPos('X'),
    posY: getPos('Y')
  };
}

async function downloadCard() {
  const text = cardTextValue();
  if (!text.trim()) { showStatus(I18N.t('enterCardText'), 'info'); return; }
  // 走统一动作 ACTIONS.card（capabilities.js：CardRenderer 渲染 → PNG 下载）
  const out = await runAction('card', text, getCardOptions());
  if (out.ok) showStatus(I18N.t('cardDownloaded'), 'success');
  else showStatus(out.error || I18N.t('cardDownloadFail'), 'error');
}

function copyCardText() {
  const text = cardTextValue();
  if (!text.trim()) { showStatus(I18N.t('noCopyText'), 'info'); return; }
  // 走统一动作 ACTIONS.copy（capabilities.js）
  runAction('copy', text).then((out) => {
    showToast(out.ok ? I18N.t('cardTextCopied') : I18N.t('copyFail'));
  });
}

// ========== 卡片字体库（card-fonts.json 动态填充 + 按需加载） ==========
// 数据源：004/demo/fonts/fonts.json（442→441 款，已筛选含 license）。仅库字体，按 group 分组。
// 交互：分类 chips（点击直接筛选，替代下拉 optgroup 分组）+ 搜索（名称/拼音/家族/分类）+ 自定义下拉列表。
let CARD_FONTS_LIST = [];
let CARD_FONTS_LOADED = false;
let FONT_PINYIN = {};          // char → 拼音（font-pinyin.json，搜索用；加载失败则仅名称/家族/分类搜索）
let cardFontIndex = -1;         // 当前选中字体下标（-1 = 未选，回退系统字体）
let activeFontGroup = '';       // 当前分类筛选（'' = 全部）
let activeFontLang = '';        // 当前语言筛选（'' = 全部）
let fontLangUserSet = false;    // 用户是否手动选过语言（手动后不再随界面语言改默认）
let CARD_TITLE_FONT = null;     // 卡片标题专用字体「芫荽」(Iansui)
let cardPreviewScale = 1;       // 卡片预览整卡缩放系数（默认宽度 800 时缩到面板内显示；拖拽按此换算）
const EC_PREVIEW_GUTTER = 10;   // 整卡缩放进面板时两侧预留的阴影空隙（px，按比例折算进 scale）

// 当前选中的库字体条目（未选返回 null）
function selectedFontEntry() {
  return CARD_FONTS_LIST[cardFontIndex] || null;
}

// 当前选中的 CSS font-family 串（库字体加引号防空格家族名被拆分；未选返回空串 → 系统字体）
function currentFontFamilyCSS() {
  const f = selectedFontEntry();
  return f ? '"' + f.family + '"' : '';
}

// 把中文字符串转成拼音串（按字查 font-pinyin.json；非 CJK 原样小写拼接）
function fontPinyin(s) {
  let out = '';
  for (const ch of String(s || '').toLowerCase()) {
    out += FONT_PINYIN[ch] || ((ch < '一' || ch > '鿿') ? ch : '');
  }
  return out;
}

// 单条字体是否命中查询（名称 / 家族 / 分类 / 拼音）
function fontMatches(f, q) {
  const name = String(f.name || '');
  return name.toLowerCase().includes(q)
    || String(f.family || '').toLowerCase().includes(q)
    || String(f.category || '').toLowerCase().includes(q)
    || fontPinyin(name).includes(q)
    || fontPinyin(f.category || '').includes(q);
}

// 字体语言判断：langs 字段（card-fonts.json），支持中文/纯拉丁/日/韩/俄/希
function fontLangs(f) {
  return Array.isArray(f.langs) ? f.langs : [];
}
function fontHasLang(f, lang) {
  return fontLangs(f).includes(lang);
}
function fontMatchesLang(f, key) {
  if (!key) return true;
  const L = fontLangs(f);
  const has = k => L.includes(k);
  switch (key) {
    case 'cn':    return has('简体中文') || has('繁体中文');
    case 'latin': return has('拉丁字母 (英)') && !has('简体中文') && !has('繁体中文') && !has('日文') && !has('谚文');
    case 'jp':    return has('日文');
    case 'kr':    return has('谚文');
    case 'ru':    return has('西里尔字母 (俄)');
    case 'gr':    return has('希腊文');
    default:      return true;
  }
}

// 语言徽标（下拉里显示，一眼看出支持哪种文字）
function fontLangBadge(f) {
  const L = fontLangs(f);
  const has = k => L.includes(k);
  if (has('简体中文') || has('繁体中文')) return '中';
  if (has('日文')) return '日';
  if (has('谚文')) return '韩';
  if (has('西里尔字母 (俄)')) return '俄';
  if (has('希腊文')) return '希';
  if (has('拉丁字母 (英)')) return '拉';
  return '';
}

// 同时满足「语言筛选 + 分类筛选」的字体数（chips 数量双向联动用）
function countFonts(langKey, groupKey) {
  let n = 0;
  for (const f of CARD_FONTS_LIST) {
    if (langKey && !fontMatchesLang(f, langKey)) continue;
    if (groupKey && (f.group || '其他') !== groupKey) continue;
    n++;
  }
  return n;
}

// 当前选中的字体是否仍满足语言/分类筛选
function currentFontMatchesFilter() {
  const f = selectedFontEntry();
  if (!f) return false;
  if (activeFontLang && !fontMatchesLang(f, activeFontLang)) return false;
  if (activeFontGroup && (f.group || '其他') !== activeFontGroup) return false;
  return true;
}

// 筛选变化后让选中字体跟随：当前选中不匹配且过滤列表非空时，自动选中第一个匹配字体并加载
function syncSelectionToFilter() {
  if (currentFontMatchesFilter()) return;
  const idxs = filteredFontIndexes();
  if (!idxs.length || idxs[0] === cardFontIndex) return;
  cardFontIndex = idxs[0];
  const f = CARD_FONTS_LIST[cardFontIndex];
  const refresh = () => { renderFontList(); updateCardPreview(); };
  if (f && typeof CardRenderer.loadFont === 'function') CardRenderer.loadFont(f).then(refresh).catch(refresh);
  else refresh();
}

// 当前生效的字体下标列表（语言 chips + 分类 chips + 搜索三重过滤，保留原数组顺序）
function filteredFontIndexes() {
  const q = (document.getElementById('ctlFontSearch')?.value || '').trim().toLowerCase();
  const out = [];
  for (let i = 0; i < CARD_FONTS_LIST.length; i++) {
    const f = CARD_FONTS_LIST[i];
    if (activeFontLang && !fontMatchesLang(f, activeFontLang)) continue;
    if (activeFontGroup && (f.group || '其他') !== activeFontGroup) continue;
    if (q && !fontMatches(f, q)) continue;
    out.push(i);
  }
  return out;
}

// 渲染语言 chips（全部 + 各语言，数量随当前分类联动：= 该语言 ∩ 当前分类）
function renderFontLangs() {
  const wrap = document.getElementById('ctlFontLangs');
  if (!wrap || !CARD_FONTS_LIST.length) return;
  wrap.innerHTML = '';
  const langs = [
    { key: '',       label: I18N.t('cardLangAll') },
    { key: 'cn',     label: I18N.t('cardLangCN') },
    { key: 'latin',  label: I18N.t('cardLangLatin') },
    { key: 'jp',     label: I18N.t('cardLangJP') },
    { key: 'kr',     label: I18N.t('cardLangKR') },
    { key: 'ru',     label: I18N.t('cardLangRU') },
    { key: 'gr',     label: I18N.t('cardLangGR') }
  ];
  // 折叠标题行摘要：当前语言 · 数量（随分类联动）
  const active = langs.find((l) => l.key === activeFontLang) || langs[0];
  const langSummary = document.getElementById('ctlLangSummary');
  if (langSummary) langSummary.textContent = ' · ' + active.label + ' ' + countFonts(activeFontLang, activeFontGroup);
  for (const l of langs) {
    const cnt = countFonts(l.key, activeFontGroup);
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'font-cat' + (activeFontLang === l.key ? ' active' : '');
    b.textContent = l.label + ' ' + cnt;
    b.addEventListener('click', () => {
      fontLangUserSet = true;    // 手动选择后固定，不再跟随界面语言
      activeFontLang = activeFontLang === l.key ? '' : l.key;
      renderFontLangs();
      renderFontCats();          // 联动：语言变化 → 分类数量跟着更新
      syncSelectionToFilter();   // 选中字体跟随筛选（当前不匹配则自动换到第一个匹配字体）
      renderFontList();
      updateCardPreview();
    });
    wrap.appendChild(b);
  }
}

// 渲染分类 chips（全部 + 各 group，数量随当前语言联动：= 该分类 ∩ 当前语言）
function renderFontCats() {
  const wrap = document.getElementById('ctlFontCats');
  if (!wrap) return;
  wrap.innerHTML = '';
  const groups = [];
  for (const f of CARD_FONTS_LIST) {
    const g = f.group || '其他';
    if (!groups.includes(g)) groups.push(g);
  }
  const mk = (g, label) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'font-cat' + (activeFontGroup === g ? ' active' : '');
    b.textContent = label;
    b.addEventListener('click', () => {
      activeFontGroup = activeFontGroup === g ? '' : g;
      renderFontCats();
      renderFontLangs();         // 联动：分类变化 → 语言数量跟着更新
      syncSelectionToFilter();   // 选中字体跟随筛选（当前不匹配则自动换到第一个匹配字体）
      renderFontList();
      updateCardPreview();
    });
    wrap.appendChild(b);
  };
  mk('', I18N.t('cardFontAll') + ' ' + countFonts(activeFontLang, ''));
  for (const g of groups) mk(g, g + ' ' + countFonts(activeFontLang, g));
}

// 渲染字体下拉列表 + 当前字段；列表受分类 chips 与搜索过滤，实时可见
function renderFontList() {
  const listEl = document.getElementById('ctlFontList');
  const fieldEl = document.getElementById('ctlFontField');
  if (!listEl) return;
  const idxs = filteredFontIndexes();
  listEl.innerHTML = '';
  if (!idxs.length) {
    const empty = document.createElement('div');
    empty.className = 'font-empty';
    empty.textContent = I18N.t('cardFontEmpty');
    listEl.appendChild(empty);
  } else {
    for (const i of idxs) {
      const f = CARD_FONTS_LIST[i];
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'font-opt' + (i === cardFontIndex ? ' sel' : '');
      row.addEventListener('click', () => selectFont(i));
      const nm = document.createElement('span');
      nm.textContent = f.name;
      row.appendChild(nm);
      // 语言徽标：中/拉/日/韩/俄/希
      const lb = fontLangBadge(f);
      if (lb) {
        const badge = document.createElement('span');
        badge.className = 'font-opt-lang';
        badge.textContent = lb;
        badge.title = (f.langs || []).join(' · ');
        row.appendChild(badge);
      }
      if (f.license === '未知') {
        const warn = document.createElement('span');
        warn.className = 'font-opt-warn';
        warn.textContent = '⚠ license';
        row.appendChild(warn);
      }
      listEl.appendChild(row);
    }
  }
  if (fieldEl) {
    const cur = selectedFontEntry();
    fieldEl.textContent = cur ? cur.name : I18N.t('cardFontPlaceholder');
  }
}

// 选中字体：记录下标 → 按需加载 → 刷新预览与列表高亮，并收起列表
function selectFont(i) {
  if (i < 0 || i >= CARD_FONTS_LIST.length) return;
  cardFontIndex = i;
  const f = CARD_FONTS_LIST[i];
  const refresh = () => { renderFontList(); updateCardPreview(); };
  if (f && typeof CardRenderer.loadFont === 'function') CardRenderer.loadFont(f).then(refresh).catch(refresh);
  else refresh();
  closeFontList();
}

function toggleFontList() { const l = document.getElementById('ctlFontList'); if (l) l.classList.toggle('open'); }
function closeFontList() { document.querySelectorAll('#ctlFontList.open').forEach(el => el.classList.remove('open')); }

// 卡片宽度：以滑块为准（默认 800px，用户可调），不自动跟随面板宽度
function getCardWidth() {
  const el = document.getElementById('ctlCardW');
  const v = el ? parseInt(el.value, 10) : 0;
  return v > 0 ? v : 800;
}

// 文本框位置 X/Y（-100 ~ 100）
const POS_LIMIT = 100;
function getPos(axis) {
  const el = document.getElementById('ctlPos' + axis);
  const v = el ? parseInt(el.value, 10) : 0;
  return Number.isFinite(v) ? Math.max(-POS_LIMIT, Math.min(POS_LIMIT, v)) : 0;
}
function setPos(x, y) {
  const ex = document.getElementById('ctlPosX');
  const ey = document.getElementById('ctlPosY');
  if (ex) ex.value = String(Math.max(-POS_LIMIT, Math.min(POS_LIMIT, Math.round(x))));
  if (ey) ey.value = String(Math.max(-POS_LIMIT, Math.min(POS_LIMIT, Math.round(y))));
  updateCardPreview();
}

// 语言筛选默认跟随界面语言：英文模式默认「纯拉丁」（更贴合英文用户），中文模式默认「全部」；
// 用户手动点过语言 chips 后不再覆盖（fontLangUserSet）。
function applyFontLangDefault() {
  if (fontLangUserSet) return;
  const isZh = (document.documentElement.lang || 'zh').toLowerCase().startsWith('zh');
  activeFontLang = isZh ? '' : 'latin';
}

// 从 card-fonts.json 加载库（幂等）+ font-pinyin.json（拼音搜索）；失败仅提示
async function initCardFonts() {
  applyFontLangDefault();
  if (CARD_FONTS_LOADED) { renderFontLangs(); renderFontCats(); renderFontList(); return; }
  try {
    const res = await fetch('card-fonts.json');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    CARD_FONTS_LIST = Array.isArray(data.fonts) ? data.fonts : [];
    try {
      const pr = await fetch('font-pinyin.json');
      if (pr.ok) FONT_PINYIN = await pr.json();
    } catch (e) { /* 拼音映射加载失败：仅名称/家族/分类搜索可用 */ }
    CARD_FONTS_LOADED = true;
  } catch (e) {
    showStatus(I18N.t('cardFontsLoadFail'), 'error');
    return;
  }
  // 标题专用字体「芫荽」(Iansui)：提前加载，canvas 与预览才可用（失败静默回退系统字体）
  CARD_TITLE_FONT = CARD_FONTS_LIST.find(f => String(f.family || '').toLowerCase() === 'iansui') || null;
  if (CARD_TITLE_FONT && typeof CardRenderer.loadFont === 'function') {
    CardRenderer.loadFont(CARD_TITLE_FONT);
  }
  // 默认选中第一款库字体并加载
  if (CARD_FONTS_LIST.length) {
    cardFontIndex = 0;
    const f = selectedFontEntry();
    if (f && typeof CardRenderer.loadFont === 'function') await CardRenderer.loadFont(f);
  } else {
    cardFontIndex = -1;
  }
  renderFontLangs();
  renderFontCats();
  renderFontList();
  updateCardPreview();
}

// 卡片默认示例文本跟随界面语言（仅当输入框仍是默认示例时替换，避免覆盖用户已编辑内容）
function syncCardSampleLang() {
  const input = document.getElementById('cardInput');
  if (!input) return;
  const zhSample = I18N.raw('cardSampleText', 'zh');
  const enSample = I18N.raw('cardSampleText', 'en');
  const cur = input.value;
  if (cur === zhSample || cur === enSample) {
    input.value = I18N.t('cardSampleText');
    updateCardPreview();
  }
}

// ========== 截图 ==========
let shotDataUrl = '';

async function captureScreenshot() {
  showStatus(I18N.t('capturing'), 'info');
  const r = await sendMessage('captureViewport');
  if (!r || !r.success) {
    showStatus((r && r.message) || I18N.t('screenshotFail'), 'error');
    return;
  }
  shotDataUrl = r.dataUrl;
  const overlay = document.getElementById('shotOverlay');
  const img = document.getElementById('shotImg');
  if (!overlay || !img) return;
  img.src = shotDataUrl;
  overlay.classList.remove('hidden');
}

function closeScreenshot() {
  const overlay = document.getElementById('shotOverlay');
  if (overlay) overlay.classList.add('hidden');
}

async function downloadScreenshot() {
  if (!shotDataUrl) return;
  const d = new Date();
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}${String(d.getSeconds()).padStart(2, '0')}`;
  try {
    await chrome.downloads.download({ url: shotDataUrl, filename: `tabu-screenshot-${stamp}.png` });
    showStatus(I18N.t('screenshotDownloaded'), 'success');
  } catch (e) {
    showStatus(I18N.t('downloadFail') + e.message, 'error');
  }
}

async function copyScreenshot() {
  if (!shotDataUrl) return;
  try {
    const blob = await (await fetch(shotDataUrl)).blob();
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    showStatus(I18N.t('screenshotCopied'), 'success');
  } catch (e) {
    showStatus(I18N.t('copyImageFail') + e.message, 'error');
  }
}

// ========== 面板控制 ==========

// ========== 注入标签页 ==========
let injectBusy = false; // 注入进行中锁
// 自定义 API（P0-B）：当前配置（loadAiConfig / saveAiConfig 维护）+ 流式中止句柄
let currentAiConfig = { aiProvider: 'openai', aiBaseUrl: '', aiApiKey: '', aiModel: '', aiAllowAnyHost: false };
let aiAbortController = null;

// 注入模板已统一收进 capabilities.js 的 PROCESSORS（translate/summarize/explain/polish/custom）

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function injectGetInput() {
  const input = document.getElementById('injectInput');
  return input ? (input.value || '').trim() : '';
}

function injectSetInput(text) {
  const input = document.getElementById('injectInput');
  if (input) input.value = text || '';
}

// 「关联页面」：开启时（默认）每次发送自动把当前页正文作为上下文并入；关闭则纯聊天
async function pageContextEnabled() {
  try {
    const r = await chrome.storage.local.get('chatPageContext');
    return r.chatPageContext !== false;
  } catch (e) { return true; }
}
async function appendPageContext(text) {
  if (!(await pageContextEnabled())) return text;
  let page = '';
  try { page = await getFullPageText(); } catch (e) { return text; }
  if (!page || !page.trim()) return text;
  return (text ? text + '\n\n' : '') + '> ' + page.trim().replace(/\n/g, '\n> ');
}

function injectSite() {
  return document.getElementById('injectSite')?.value || 'chatgpt';
}

// ===== AI 工作台：素材胶囊（005 P0/P1）=====
// 类型：selection（选中内容）/ fulltext（网页全文）/ file（文本附件，已读为文本）/ image（图片，dataUrl 随发送注入粘贴）
// 选中文本/全文/文本文件 → 引用块并入 prompt；图片 → 随发送在 AI 站点页面内模拟"粘贴"上传（仅浏览器版渠道）
let injectMaterials = [];
let _matSeq = 0;
function injectAddMaterial(m) {
  injectMaterials.push(Object.assign({ id: 'm' + Date.now() + '_' + (++_matSeq) }, m));
  renderInjectMaterials();
  return true;
}
function materialLabel(type) {
  return type === 'selection' ? I18N.t('aiMaterialSel')
    : type === 'fulltext' ? I18N.t('aiMaterialFull')
    : type === 'file' ? I18N.t('aiMaterialFile')
    : I18N.t('aiMaterialImage');
}
function renderInjectMaterials() {
  const box = document.getElementById('injectMaterials');
  if (!box) return;
  box.innerHTML = '';
  box.classList.toggle('hidden', injectMaterials.length === 0);
  injectMaterials.forEach((m) => {
    const chip = document.createElement('span');
    chip.className = 'material-chip';
    const preview = m.type === 'image' ? (m.name || 'image')
      : (m.type === 'file' ? (m.name || '') : (m.text.length > 24 ? m.text.slice(0, 24) + '…' : m.text));
    chip.innerHTML = '<span class="mtag">' + escapeHtml(materialLabel(m.type)) + '</span>' +
      '<span class="mprev" title="' + escapeHtml(m.type === 'image' ? (m.name || '') : String(m.text || '').slice(0, 200)) + '">' + escapeHtml(preview) + '</span>' +
      '<button class="mremove" data-mid="' + m.id + '">✕</button>';
    chip.querySelector('.mremove').addEventListener('click', () => {
      injectMaterials = injectMaterials.filter((x) => x.id !== m.id);
      renderInjectMaterials();
    });
    box.appendChild(chip);
  });
}
// 素材 → { text, images }：文本类并入引用块；图片单独携带（浏览器版渠道在站点页面内粘贴上传）
function composeWithMaterials(base) {
  const images = injectMaterials.filter((m) => m.type === 'image').map((m) => ({ name: m.name || 'image', dataUrl: m.dataUrl }));
  const textMats = injectMaterials.filter((m) => m.type !== 'image');
  const mats = textMats.map((m) => {
    const head = (m.type === 'file' && m.name) ? '[附件 ' + m.name + ']\n' : '';
    return head + '> ' + m.text.replace(/\n/g, '\n> ');
  }).join('\n>\n');
  const text = mats ? (base ? base + '\n\n' : '') + mats : base;
  return { text, images };
}
function injectComposeParts() { return composeWithMaterials(injectGetInput()); }
function injectComposeText() { return injectComposeParts().text; }
function injectClearMaterials() { injectMaterials = []; renderInjectMaterials(); }

// 📎 附件选择：图片（≤5MB，随发送粘贴上传）+ 文本类（≤512KB，读为文本素材）；其余格式提示 P2/手动上传
async function injectAttachPick(fileList) {
  for (const f of Array.from(fileList || [])) {
    try {
      if (/^image\//.test(f.type)) {
        if (f.size > 5 * 1024 * 1024) { showStatus(I18N.t('aiAttachTooLarge', f.name), true); continue; }
        const dataUrl = await new Promise((res, rej) => {
          const r = new FileReader();
          r.onload = () => res(r.result); r.onerror = () => rej(r.error);
          r.readAsDataURL(f);
        });
        injectAddMaterial({ type: 'image', name: f.name, dataUrl });
        showStatus(I18N.t('aiAttachAdded', f.name), 'success');
      } else if (/^(text\/|application\/json)/.test(f.type) || /\.(txt|md|csv|json|log)$/i.test(f.name)) {
        if (f.size > 512 * 1024) { showStatus(I18N.t('aiAttachTooLarge', f.name), true); continue; }
        const text = await f.text();
        injectAddMaterial({ type: 'file', name: f.name, text });
        showStatus(I18N.t('aiAttachAdded', f.name), 'success');
      } else if (f.type === 'application/pdf' || /\.pdf$/i.test(f.name)) {
        // PDF 解析（005 P2）：尽力提取文本，作为文本附件并入 prompt
        if (f.size > 20 * 1024 * 1024) { showStatus(I18N.t('aiAttachTooLarge', f.name), true); continue; }
        const text = await extractPdfText(await f.arrayBuffer());
        if (!text || text.trim().length < 2) { showStatus(I18N.t('aiAttachPdfNoText', f.name), true); continue; }
        injectAddMaterial({ type: 'file', name: f.name, text });
        showStatus(I18N.t('aiAttachAdded', f.name), 'success');
      } else {
        showStatus(I18N.t('aiAttachUnsupported', f.name), true);
      }
    } catch (e) {
      showStatus(I18N.t('aiAttachReadFail', (e && e.message) || ''), true);
    }
  }
}

// ===== PDF 文本提取（005 P2，尽力而为，无第三方依赖）=====
// 思路：扫描 stream…endstream，FlateDecode 用 DecompressionStream 解压，
// 再从内容流里取 BT/ET 文本操作符（Tj / TJ / Td / TD / T*）。扫描件或 CID 字体的中文 PDF 可能取不到文本。
function bytesToLatin1(u8) {
  let s = '';
  for (let i = 0; i < u8.length; i += 0x8000) {
    s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  }
  return s;
}
async function inflatePdfBytes(u8) {
  const inflate = async (fmt) => {
    const ds = new DecompressionStream(fmt);
    const writer = ds.writable.getWriter();
    const reader = ds.readable.getReader();
    const chunks = [];
    let total = 0;
    // 读取端在流结束/尾部杂字节报错时保留已解出的内容（PDF 流常带尾部多余字节）
    const readAll = (async () => {
      try {
        while (true) { const { done, value } = await reader.read(); if (done) break; if (value) { chunks.push(value); total += value.length; } }
      } catch (e) { /* 容忍尾部杂字节 */ }
    })();
    writer.write(u8).then(() => writer.close()).catch(() => {});
    await readAll;
    if (!total) throw new Error('inflate empty');
    const out = new Uint8Array(total);
    let off = 0;
    for (const c of chunks) { out.set(c, off); off += c.length; }
    return out;
  };
  try { return await inflate('deflate'); } catch (e) {}
  return await inflate('deflate-raw'); // 少数 PDF 用裸 deflate
}
function decodePdfString(s) {
  return s.replace(/\\(n|r|t|b|f|\(|\)|\\|[0-7]{1,3})/g, (mm, g) => {
    switch (g) {
      case 'n': return '\n'; case 'r': return '\r'; case 't': return '\t';
      case 'b': return '\b'; case 'f': return '\f';
      case '(': return '('; case ')': return ')'; case '\\': return '\\';
      default: return /^[0-7]{1,3}$/.test(g) ? String.fromCharCode(parseInt(g, 8)) : g;
    }
  });
}
function extractPdfTextOperators(content) {
  let result = '';
  const re = /\((?:\\.|[^\\()])*\)|\[(?:[^\]]*)\]|T[Jj]|T[dD]|T\*|'|"/g;
  let lastStrings = [];
  let m;
  while ((m = re.exec(content)) !== null) {
    const tok = m[0];
    if (tok[0] === '(') {
      lastStrings = [decodePdfString(tok.slice(1, -1))];
    } else if (tok[0] === '[') {
      const arr = [];
      const sre = /\((?:\\.|[^\\()])*\)/g;
      let sm;
      while ((sm = sre.exec(tok)) !== null) arr.push(decodePdfString(sm[0].slice(1, -1)));
      lastStrings = arr;
    } else if (tok === 'Tj') {
      result += lastStrings[0] || '';
    } else if (tok === 'TJ') {
      result += lastStrings.join('');
    } else {
      result += '\n'; // Td / TD / T* / ' / "
    }
  }
  return result;
}
async function extractPdfText(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  const latin1 = bytesToLatin1(bytes);
  const parts = [];
  const re = /stream\r?\n/g;
  let m;
  while ((m = re.exec(latin1)) !== null) {
    const start = m.index + m[0].length;
    const end = latin1.indexOf('endstream', start);
    if (end < 0) break;
    const dictRegion = latin1.slice(Math.max(0, m.index - 600), m.index);
    let contentBytes = bytes.subarray(start, end);
    if (/FlateDecode/.test(dictRegion)) {
      try { contentBytes = await inflatePdfBytes(contentBytes); } catch (e) { /* 解压失败用原始串 */ }
    }
    const t = extractPdfTextOperators(bytesToLatin1(contentBytes));
    if (t && t.trim()) parts.push(t);
    re.lastIndex = end + 9;
  }
  return parts.join('\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

// ===== AI 工作台：站点能力徽章（005 P2：静态声明 + 运行时探测；简洁 SVG 图标，无 emoji）=====
const AI_SITE_CAPABILITIES = {
  chatgpt:  { image: 'ok', file: 'ok' },
  claude:   { image: 'ok', file: 'ok' },
  kimi:     { image: 'ok', file: 'ok' },
  deepseek: { image: 'exp', file: 'exp' } // Vision-Exp 实验性，以站点实际为准
};
const CAP_ICON = {
  image: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>',
  file: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>'
};
let injectCapProbe = null; // 最近一次运行时探测结果 { site, present, fileInput, acceptsImage }
function renderInjectCapBadges() {
  const el = document.getElementById('injectCapBadges');
  if (!el) return;
  const site = injectSite();
  const declared = AI_SITE_CAPABILITIES[site] || { image: 'ok', file: 'ok' };
  const cap = { image: declared.image, file: declared.file };
  const probe = (injectCapProbe && injectCapProbe.site === site) ? injectCapProbe : null;
  if (probe && probe.present) {
    cap.image = probe.acceptsImage ? 'ok' : 'exp';
    cap.file = probe.fileInput ? 'ok' : 'exp';
  }
  const badge = (kind) => {
    const st = cap[kind] === 'ok' ? 'ok' : (cap[kind] === 'exp' ? 'exp' : 'unknown');
    const title = st === 'ok' ? I18N.t('aiCapOkTitle') : (st === 'exp' ? I18N.t('aiCapExpTitle') : I18N.t('aiCapUnknownTitle'));
    const label = I18N.t(kind === 'image' ? 'aiCapImage' : 'aiCapFile');
    return '<span class="cap-badge ' + st + '" title="' + escapeHtml(label + '：' + title) + '">' + CAP_ICON[kind] + '</span>';
  };
  el.innerHTML = badge('image') + badge('file');
}
async function refreshInjectCapBadges() {
  renderInjectCapBadges(); // 先按静态声明渲染，避免空窗
  try {
    const site = injectSite();
    const r = await sendMessage('probeSiteCapabilities', { site });
    if (r && !r.error) { injectCapProbe = Object.assign({ site }, r); renderInjectCapBadges(); }
  } catch (e) {}
}

// ===== AI 工作台：语音输入（browser 后端，识别文本填入输入框可编辑后再发送） =====
let injectVoiceOn = false;
async function toggleInjectVoice() {
  if (injectVoiceOn) { stopBrowserAsr(); return; }
  setChatMode('text'); // 语音填入到文本框：确保文本模式可见
  // 单一音频通道：先停掉其它面板的录音/识别
  if (asrRecording) stopAsrRecording();
  if (vbRecording) stopVoiceCircleRecording();
  const hint = await browserAsrHint();
  if (hint.level === 'unsupported' || hint.level === 'block') { showStatus(hint.msg, true); return; }
  const input = document.getElementById('injectInput');
  if (!input) return;
  const base = input.value ? input.value.replace(/\s*$/, '') + ' ' : '';
  injectVoiceOn = true;
  updateInjectVoiceUi(true);
  try {
    const out = await startBrowserAsr({
      onInterim: (t) => { input.value = base + t; },
      onStatus: (m) => showStatus('🎙 ' + m, 'info')
    });
    if (out.text) input.value = base + out.text;
  } catch (e) {
    showStatus((e && e.message) || I18N.t('unknownError'), true);
  } finally {
    injectVoiceOn = false;
    updateInjectVoiceUi(false);
    try { input.focus(); } catch (e) {}
  }
}
function updateInjectVoiceUi(on) {
  const btn = document.getElementById('injectVoice');
  if (!btn) return;
  btn.textContent = on ? I18N.t('aiVoiceStop') : I18N.t('aiVoiceStart');
  btn.classList.toggle('recording', on);
}

async function injectRun(prompt, images = [], opts = {}) {
  if (injectBusy) { showStatus(I18N.t('injectBusy'), 'info'); return; }
  if ((!prompt || !prompt.trim()) && !images.length) { showStatus(I18N.t('enterTextToSend'), 'info'); return; }
  // 「关联页面」开启时：自动把当前页正文并入**发送内容**（不污染显示气泡）；AI处理等 focused 转换可 skipPageContext
  const displayPrompt = prompt;
  const sendPrompt = opts.skipPageContext ? prompt : await appendPageContext(prompt);
  // 首开面板时 loadAiConfig 可能未完成，config 为空则先向 storage 确认一次
  if (!currentAiConfig.aiBaseUrl) {
    try {
      const r = await chrome.storage.local.get('aiBaseUrl');
      if (r.aiBaseUrl) currentAiConfig.aiBaseUrl = String(r.aiBaseUrl || '').trim();
    } catch (e) {}
  }
  // 后端模式：'local' → 本地 /chat；'api' → 流式（需已配置）；'inject' → 页面注入
  const mode = await getEffectiveAiMode();
  // 图片附件仅浏览器版渠道支持（站点页面内粘贴上传）；其它渠道降级为纯文本并提示
  if (images.length && mode !== 'inject') {
    showStatus(I18N.t('aiAttachDropNonInject'), true);
    images = [];
  }
  if (mode === 'local') {
    // 本地渠道：本地 LLM /chat 问答（008 §2 流式），问答同样进统一对话流
    injectClearMaterials();
    injectBusy = true;
    const sendBtn = document.getElementById('injectSend');
    const stopBtn = document.getElementById('injectStop');
    const statusEl = document.getElementById('injectStatus');
    if (sendBtn) sendBtn.disabled = true;
    if (stopBtn) stopBtn.style.display = 'inline-block';
    if (statusEl) statusEl.textContent = I18N.t('sending');
    renderVoiceOutput(displayPrompt, null, null, I18N.t('chatYou'));
    const ansEl = appendStreamBubble('voice-bot');
    const setAns = (t) => { const s = ansEl && ansEl.querySelector('.stream-text'); if (s) s.textContent = t; };
    const autoOn = await aiSpeakAnswerEnabled();
    const streamOn = autoOn && isStreamSpeakEnabled();
    const spToken = streamOn ? streamSpeakStart(ansEl && ansEl.querySelector('.msg-speak')) : 0;
    const controller = new AbortController();
    aiAbortController = controller;
    let acc = '';
    try {
      const r = await TABU_CAPS.askLocalStream(sendPrompt, {
        signal: controller.signal,
        onDelta: (t) => { acc += t; setAns(acc); if (streamOn) streamSpeakFeed(spToken, t); }
      });
      const answer = (r && r.answer) || acc;
      finalizeStreamBubble(ansEl, answer);
      if (statusEl) statusEl.textContent = I18N.t('injectDone');
      if (streamOn) streamSpeakEnd(spToken); else maybeSpeakAnswer(answer);
    } catch (e) {
      if (streamOn) streamSpeakStop();
      if (controller.signal.aborted) {
        if (statusEl) statusEl.textContent = I18N.t('injectStopped');
      } else if (statusEl) {
        statusEl.textContent = '❌ ' + ((e && e.message) || I18N.t('unknownError'));
      }
    } finally {
      injectBusy = false;
      if (aiAbortController === controller) aiAbortController = null;
      if (sendBtn) sendBtn.disabled = false;
      if (stopBtn) stopBtn.style.display = 'none';
    }
    return;
  }
  if (mode === 'api') {
    if (!currentAiConfig.aiBaseUrl) {
      showStatus(I18N.t('aiBackendApiNoConfig'), 'info');
      return;
    }
    injectClearMaterials(); // 已合成进 prompt，派发前清空胶囊
    return injectRunApi(sendPrompt, displayPrompt);
  }
  injectClearMaterials(); // 已合成进 prompt，派发前清空胶囊
  injectBusy = true;
  const sendBtn = document.getElementById('injectSend');
  const stopBtn = document.getElementById('injectStop');
  const statusEl = document.getElementById('injectStatus');
  if (sendBtn) sendBtn.disabled = true;
  if (stopBtn) stopBtn.style.display = 'inline-block';
  if (statusEl) statusEl.textContent = I18N.t('sending');
  renderVoiceOutput(displayPrompt, null, null, I18N.t('chatYou'));
  // 注入渠道流式（008 §2）：页面 300ms 快照经后台 'injectDeltaPanel' 回传，实时更新气泡
  const streamId = 'sp' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
  const injectAnsEl = appendStreamBubble('voice-bot');
  const setInjectAns = (t) => { const s = injectAnsEl && injectAnsEl.querySelector('.stream-text'); if (s) s.textContent = t; };
  let injectAcc = '';
  const autoOn = await aiSpeakAnswerEnabled();
  const streamOn = autoOn && isStreamSpeakEnabled();
  const spToken = streamOn ? streamSpeakStart(injectAnsEl && injectAnsEl.querySelector('.msg-speak')) : 0;
  let lastSnap = '';

  // 走统一管线 execute（capabilities.js）：动作 inject，后台会话历史自动写入
  execute({
    action: 'inject', text: sendPrompt,
    options: {
      site: injectSite(), images, streamId,
      onDelta: (t) => {
        const snap = String(t || '');
        injectAcc = snap; setInjectAns(snap);
        if (streamOn) { const inc = snap.startsWith(lastSnap) ? snap.slice(lastSnap.length) : snap; lastSnap = snap; streamSpeakFeed(spToken, inc); }
      }
    }
  })
    .then(async (out) => {
      if (out.ok) {
        const think = (out.result && out.result.thinking) || '';
        const showThink = await aiShowThinkingEnabled();
        const finalText = (out.result && out.result.text) || injectAcc;
        finalizeStreamBubble(injectAnsEl, finalText);
        if (showThink && think) {
          const thinkHtml = '<div class="voice-msg voice-think"><b>' + escapeHtml(I18N.t('chatThinking')) + '</b>' + escapeHtml(think) + '</div>';
          if (injectAnsEl && injectAnsEl.parentNode) injectAnsEl.insertAdjacentHTML('beforebegin', thinkHtml);
        }
        if (statusEl) statusEl.textContent = I18N.t('injectDone');
        showStatus(I18N.t('injectSuccess'), 'success');
        if (streamOn) streamSpeakEnd(spToken); else maybeSpeakAnswer(finalText);
      } else {
        if (streamOn) streamSpeakStop();
        const msg = out.result ? (out.result.error || out.error) : (out.error || I18N.t('unknownError'));
        if (injectAnsEl) injectAnsEl.innerHTML = '<b>' + escapeHtml(I18N.t('chatAnswer')) + '</b><div class="md-body">❌ ' + escapeHtml(msg) + '</div>';
        if (statusEl) statusEl.textContent = I18N.t('injectFailed') + '：' + msg;
      }
      renderInjectHistory();
    })
    .catch(() => {
      if (statusEl) statusEl.textContent = I18N.t('requestException');
    })
    .finally(() => {
      injectBusy = false;
      if (sendBtn) sendBtn.disabled = false;
      if (stopBtn) stopBtn.style.display = 'none';
    });
}

// 流式气泡收尾：把逐字纯文本替换为 Markdown 化正文 + 小喇叭操作
function finalizeStreamBubble(el, answer) {
  if (!el) return;
  const text = String(answer || '');
  if (text) lastAnswerText = text;
  el.innerHTML = '<b>' + escapeHtml(I18N.t('chatAnswer')) + '</b><div class="md-body">' + renderMarkdown(text) + '</div><div class="msg-actions">' + msgSpeakBtn() + '</div>';
  // innerHTML 替换后旧按钮节点失效：若流式朗读仍在进行，把「停止」态重新绑到新按钮
  if (_streamSpeaker.active && _streamSpeaker.token) {
    const btn = el.querySelector('.msg-speak');
    if (btn) { _streamSpeaker.btn = btn; setSpeakButtonState(btn, true); }
  }
}

// 自定义 API 流式发送（P2）：aiContext 取 session + 多轮历史 → askApiStream 逐字渲染 → 完成写历史
// sendText = 实际发送内容（可能含关联页面全文）；displayText = 对话流展示的用户消息
async function injectRunApi(sendText, displayText) {
  const prompt = sendText;
  const shown = displayText != null ? displayText : sendText;
  injectBusy = true;
  const sendBtn = document.getElementById('injectSend');
  const stopBtn = document.getElementById('injectStop');
  const statusEl = document.getElementById('injectStatus');
  if (sendBtn) sendBtn.disabled = true;
  if (stopBtn) stopBtn.style.display = 'inline-block';
  if (statusEl) statusEl.textContent = I18N.t('sending');
  renderVoiceOutput(shown, null, null, I18N.t('chatYou'));
  // 流式气泡：思考（灰，受 💭 开关控制）+ 回答（逐字），完成后正文 Markdown 化
  const showThink = await aiShowThinkingEnabled();
  const autoOn = await aiSpeakAnswerEnabled();
  const streamOn = autoOn && isStreamSpeakEnabled();
  const thinkEl = showThink ? appendStreamBubble('voice-think') : null;
  const ansEl = appendStreamBubble('voice-bot');
  const spToken = streamOn ? streamSpeakStart(ansEl && ansEl.querySelector('.msg-speak')) : 0;
  const setThink = (t) => { const s = thinkEl && thinkEl.querySelector('.stream-text'); if (s) s.textContent = t.slice(-600); };
  const setAns = (t) => { const s = ansEl && ansEl.querySelector('.stream-text'); if (s) s.textContent = t; };
  let reasoningAcc = '';

  const controller = new AbortController();
  aiAbortController = controller;
  let acc = '';
  let contentStarted = false;
  try {
    // 多轮上下文：session 内历史消息（后台重建）
    const ctx = await sendMessage('aiContext');
    const session = (ctx && ctx.session) || '';
    const history = (ctx && ctx.history) || [];
    if (ctx && ctx.error) throw new Error(ctx.error);

    const r = await TABU_CAPS.askApiStream(prompt, currentAiConfig, history, {
      signal: controller.signal,
      onDelta: (t) => {
        contentStarted = true;
        acc += t;
        setAns(acc);
        if (streamOn) streamSpeakFeed(spToken, t);
      },
      // 思考增量：思考型模型先吐思考再吐正文；灰色气泡实时显示末尾一段
      onReasoning: (t) => {
        if (contentStarted) return;
        reasoningAcc += t;
        setThink(reasoningAcc);
      }
    });

    if (r && r.aborted) {
      if (streamOn) streamSpeakStop();
      if (statusEl) statusEl.textContent = I18N.t('injectStopped');
      return;
    }
    const answer = (r && r.answer) || acc;
    finalizeStreamBubble(ansEl, answer);
    if (streamOn) streamSpeakEnd(spToken); else maybeSpeakAnswer(answer);
    if (statusEl) statusEl.textContent = I18N.t('injectDone');
    showStatus(I18N.t('injectSuccess'), 'success');
    // 会话历史写库（site:'api' + session，供多轮跟随）
    if (session && answer) {
      sendMessage('saveAiConversation', { session, prompt: shown, answer }).catch(() => {});
    }
  } catch (e) {
    if (streamOn) streamSpeakStop();
    const aborted = controller.signal.aborted;
    if (aborted) {
      if (statusEl) statusEl.textContent = I18N.t('injectStopped');
    } else {
      if (ansEl) ansEl.innerHTML = '<b>' + escapeHtml(I18N.t('chatAnswer')) + '</b><div class="md-body">❌ ' + escapeHtml((e && e.message) || I18N.t('unknownError')) + '</div>';
      if (statusEl) statusEl.textContent = I18N.t('injectFailed');
    }
  } finally {
    injectBusy = false;
    if (aiAbortController === controller) aiAbortController = null;
    if (sendBtn) sendBtn.disabled = false;
    if (stopBtn) stopBtn.style.display = 'none';
    renderInjectHistory();
  }
}

// ===== 工作台回答朗读（🔊 可关）：与语音工作台同一朗读引擎与思维链剥离策略 =====
async function aiSpeakAnswerEnabled() {
  try {
    const r = await chrome.storage.local.get('aiSpeakAnswer');
    return r.aiSpeakAnswer !== false; // 默认开
  } catch (e) { return true; }
}
// 💭 思考显示开关（默认隐藏）：控制思考内容是否显示在对话流（与"朗读是否含思考"是两个独立设置）
async function aiShowThinkingEnabled() {
  try {
    const r = await chrome.storage.local.get('aiShowThinking');
    return r.aiShowThinking === true; // 默认隐藏
  } catch (e) { return false; }
}
function updateAiShowThinkingToggleUi(on) {
  const btn = document.getElementById('aiShowThinkingToggle');
  if (!btn) return;
  btn.textContent = on ? I18N.t('aiShowThinkingOn') : I18N.t('aiShowThinkingOff');
  btn.classList.toggle('on', on);
}
// 仅当当前 LLM 可能产出思考内容时才显示该开关：
// · 注入渠道：主流网页模型（ChatGPT/Claude/Gemini/Qwen/ChatGLM/Kimi/DeepSeek）普遍提供思考/推理 → 显示；
// · API / 本地：按模型名判断，明确非推理模型才隐藏（未知则显示，避免误藏）。
const REASONING_MODEL_RE = /reason|think|r1|qwq|glm-?z|glm-?4\.5|deepseek|qwq|\bo[134]\b|k1|kimi|sonnet-3[.-]7|claude-3[.-]7|gpt-5|gemini-2\.5/i;
async function updateThinkingToggleVisibility() {
  const btn = document.getElementById('aiShowThinkingToggle');
  if (!btn) return;
  let show = true;
  try {
    const mode = await getEffectiveAiMode();
    if (mode === 'inject') {
      show = true;
    } else {
      const model = String((currentAiConfig && (currentAiConfig.aiModel || currentAiConfig.model)) || '').trim();
      show = !model || REASONING_MODEL_RE.test(model);
    }
  } catch (e) { show = true; }
  btn.classList.toggle('hidden', !show);
}
// LLM 回复音色偏好（'' = 跟随系统语音；仅系统朗读路径生效）
async function aiSpeakVoicePref() {
  try {
    const r = await chrome.storage.local.get('aiSpeakVoice');
    return r.aiSpeakVoice || '';
  } catch (e) { return ''; }
}
function maybeSpeakAnswer(text) {
  if (!text || !String(text).trim()) return;
  Promise.all([aiSpeakAnswerEnabled(), aiSpeakVoicePref()]).then(([on, pref]) => {
    if (!on) { logDebug('tts', '自动朗读已关闭（工作台 🔊 开关或蓝区「LLM 回复朗读」）'); return; }
    logDebug('tts', '自动朗读 LLM 回答（' + String(text).length + ' 字）');
    autoSpeakAnswer(String(text), document.getElementById('injectStatus'), !!(currentVoiceConfig && currentVoiceConfig.voiceCircleForceSystem), pref, lastBotSpeakBtn());
  }).catch(() => {});
}
function updateAiSpeakToggleUi(on) {
  const btn = document.getElementById('aiSpeakToggle');
  if (!btn) return;
  btn.textContent = on ? I18N.t('aiSpeakOn') : I18N.t('aiSpeakOff');
  btn.classList.toggle('on', on);
}

// 合并后的发送：输入框文本 + 素材胶囊合成；填写了自定义模板（injectCustomTpl）就套用模板
function injectSend() {
  const tplInput = document.getElementById('injectCustomTpl');
  const tpl = (tplInput && tplInput.value || '').trim();
  const parts = injectComposeParts();
  if (tpl) {
    if (!parts.text) { showStatus(I18N.t('enterTextFirst'), 'info'); return; }
    injectRun(TABU_CAPS.PROCESSORS.custom.apply(parts.text, tpl), parts.images);
  } else {
    injectRun(parts.text, parts.images);
  }
}

function injectStop() {
  // API 模式：真正中断流式请求；页面注入模式：通知后台在下个检查点退出并释放注入锁
  if (aiAbortController) aiAbortController.abort();
  sendMessage('cancelInject').catch(() => {});
  if (isSpeakingActive()) stopSpeaking(); // 中断朗读并清空流式朗读队列（008 §3）
  injectBusy = false;
  const sendBtn = document.getElementById('injectSend');
  const stopBtn = document.getElementById('injectStop');
  const statusEl = document.getElementById('injectStatus');
  if (sendBtn) sendBtn.disabled = false;
  if (stopBtn) stopBtn.style.display = 'none';
  if (statusEl) statusEl.textContent = I18N.t('injectStopped');
}

async function injectNewChat() {
  // 新对话 = 全新开始：清空输入框与素材胶囊（API 模式同时重置后台会话）
  injectSetInput('');
  injectClearMaterials();
  // API 模式：重置会话（新 session 清空多轮上下文），无需操作真实 AI 页面
  if (await getEffectiveAiMode() === 'api') {
    const r = await sendMessage('resetAiSession');
    if (r && r.error) { showStatus(r.error, 'error'); return; }
    showStatus(I18N.t('aiSessionReset'), 'success');
    return;
  }
  const site = injectSite();
  showStatus(I18N.t('newChatStarting'), 'info');
  const r = await sendMessage('newConversation', { site });
  showStatus(r && r.success ? r.message : (r && r.message || I18N.t('newChatFail')), r && r.success ? 'success' : 'error');
}

function fmtTime(ts) {
  const d = new Date(ts);
  return d.toLocaleString();
}

async function renderInjectHistory() {
  const listEl = document.getElementById('injectHistory');
  if (!listEl) return;
  const list = await sendMessage('getConversations', { limit: 50 });
  if (!list || list.length === 0) {
    listEl.innerHTML = `<div class="inject-empty">${I18N.t('noHistory')}</div>`;
    return;
  }
  const siteLabel = { chatgpt: 'ChatGPT', claude: 'Claude', kimi: 'Kimi', deepseek: 'DeepSeek', api: 'API' };
  let html = '';
  for (const c of list) {
    const label = siteLabel[c.site] || c.site;
    const promptSnip = (c.prompt || '').replace(/\n+/g, ' ').slice(0, 60);
    html += `
      <div class="inject-history-item" data-id="${c.id}">
        <div class="ih-top">
          <span class="ih-site">${label}</span>
          <span class="ih-time">${fmtTime(c.timestamp)}</span>
        </div>
        <div class="ih-snippet">${escapeHtml(promptSnip)}</div>
        <div class="ih-body">${escapeHtml(c.prompt)}\n\n${I18N.t('replyDivider')}\n${escapeHtml(c.answer)}</div>
        <div class="ih-actions">
          <button class="btn small secondary ih-toggle">${I18N.t('expand')}</button>
          <button class="btn small danger ih-delete">${I18N.t('deleteBtn')}</button>
        </div>
      </div>
    `;
  }
  listEl.innerHTML = html;

  listEl.querySelectorAll('.inject-history-item').forEach(item => {
    const toggle = item.querySelector('.ih-toggle');
    const body = item.querySelector('.ih-body');
    if (toggle) toggle.addEventListener('click', () => {
      body.classList.toggle('open');
      toggle.textContent = body.classList.contains('open') ? I18N.t('collapse') : I18N.t('expand');
    });
    const del = item.querySelector('.ih-delete');
    if (del) del.addEventListener('click', async () => {
      await sendMessage('deleteConversation', { id: item.dataset.id });
      renderInjectHistory();
    });
  });
}

async function clearInjectHistory() {
  if (!confirm(I18N.t('confirmClearInjectHistory'))) return;
  await sendMessage('clearConversations');
  renderInjectHistory();
  showStatus(I18N.t('cleared'), 'success');
}

// 清空 AI 输入与素材（结果在统一对话流里，由流头部的「清空」负责）
function injectClear() {
  const input = document.getElementById('injectInput');
  const statusEl = document.getElementById('injectStatus');
  injectClearMaterials();
  if (input) input.value = '';
  if (statusEl) statusEl.textContent = '';
}

// ========== 蓝层：系统设置 / 版本保留 / 数据管理 ==========
function speakInputText() {
  const input = document.getElementById('injectInput');
  doSpeak(input ? input.value : '', document.getElementById('ttsStatus'), document.getElementById('ttsSpeakInput'));
}

async function loadBridgeTokenSetting() {
  const input = document.getElementById('bridgeTokenInput');
  if (!input) return;
  const r = await chrome.storage.local.get('bridgeToken');
  input.value = (r.bridgeToken || '').trim();
}

async function saveBridgeToken() {
  const input = document.getElementById('bridgeTokenInput');
  const v = input ? input.value.trim() : '';
  await chrome.storage.local.set({ bridgeToken: v });
  showStatus(I18N.t(v ? 'bridgeTokenSaved' : 'bridgeTokenCleared'), 'success');
}

async function loadInjectSwitchState() {
  const sw = document.getElementById('injectSwitch');
  if (!sw) return;
  const r = await chrome.storage.local.get('inputInjectEnabled');
  sw.classList.toggle('on', !!r.inputInjectEnabled);
}

async function toggleInjectSwitch() {
  const sw = document.getElementById('injectSwitch');
  if (!sw) return;
  const r = await chrome.storage.local.get('inputInjectEnabled');
  const next = !r.inputInjectEnabled;
  await chrome.storage.local.set({ inputInjectEnabled: next });
  sw.classList.toggle('on', next);
  showStatus(I18N.t(next ? 'injectSwitchOn' : 'injectSwitchOff'), next ? 'success' : 'info');
}

// ========== 蓝区「AI 服务」设置（P0-B）+ 红区后端切换 ==========
// 提供商目录/默认模型来自共享 ai-api.js 的 AI_PROVIDERS（2026-08 核对）。

function aiField(id) {
  return document.getElementById(id);
}

function getAiDefaultModel(provider) {
  const meta = (typeof AI_PROVIDERS !== 'undefined' && AI_PROVIDERS[provider]) || null;
  return meta ? meta.defaultModel : '';
}

function populateModelDatalist(provider) {
  const dl = aiField('aiModelList');
  const model = aiField('aiModel');
  const meta = (typeof AI_PROVIDERS !== 'undefined' && AI_PROVIDERS[provider]) || AI_PROVIDERS.custom;
  if (dl) dl.innerHTML = (meta.models || []).map((m) => `<option value="${m}"></option>`).join('');
  if (model) {
    model.placeholder = meta.defaultModel || '…';
    model.setAttribute('list', 'aiModelList');
  }
}

// 切换提供商：填充默认 Base URL（仅当输入框为空、或仍是对应其他提供商的默认值，避免覆盖自定义地址）+ 模型建议
function onAiProviderChange() {
  const sel = aiField('aiProvider');
  const provider = (sel && sel.value) || 'openai';
  const base = aiField('aiBaseUrl');
  if (base) {
    const current = base.value.trim();
    const isOtherDefault = Object.keys(AI_PROVIDERS)
      .filter((k) => k !== provider)
      .some((k) => AI_PROVIDERS[k].baseUrl === current);
    if (!current || isOtherDefault) {
      base.value = (AI_PROVIDERS[provider] && AI_PROVIDERS[provider].baseUrl) || '';
    }
  }
  populateModelDatalist(provider);
}

async function loadAiConfig() {
  const r = await chrome.storage.local.get(['aiProvider', 'aiBaseUrl', 'aiApiKey', 'aiModel', 'aiAllowAnyHost']);
  currentAiConfig = {
    aiProvider: r.aiProvider || 'openai',
    aiBaseUrl: String(r.aiBaseUrl || '').trim(),
    aiApiKey: String(r.aiApiKey || '').trim(),
    aiModel: String(r.aiModel || '').trim(),
    aiAllowAnyHost: !!r.aiAllowAnyHost
  };
  const p = aiField('aiProvider'); if (p) p.value = currentAiConfig.aiProvider;
  const b = aiField('aiBaseUrl'); if (b) b.value = currentAiConfig.aiBaseUrl;
  const k = aiField('aiApiKey'); if (k) k.value = currentAiConfig.aiApiKey;
  const m = aiField('aiModel'); if (m) m.value = currentAiConfig.aiModel;
  const sw = aiField('aiAllowAnySwitch'); if (sw) sw.classList.toggle('on', currentAiConfig.aiAllowAnyHost);
  populateModelDatalist(currentAiConfig.aiProvider);
  await syncAiBackendUi();
}

function collectAiFormConfig() {
  return {
    aiProvider: (aiField('aiProvider') && aiField('aiProvider').value) || 'openai',
    aiBaseUrl: (aiField('aiBaseUrl') && aiField('aiBaseUrl').value || '').trim(),
    aiApiKey: (aiField('aiApiKey') && aiField('aiApiKey').value || '').trim(),
    aiModel: (aiField('aiModel') && aiField('aiModel').value || '').trim(),
    aiAllowAnyHost: !!(aiField('aiAllowAnySwitch') && aiField('aiAllowAnySwitch').classList.contains('on'))
  };
}

async function saveAiConfig() {
  const cfg = collectAiFormConfig();
  await chrome.storage.local.set(cfg);
  currentAiConfig = cfg;
  await syncAiBackendUi();
  showStatus(I18N.t('aiSvcSaved'), 'success');
}

async function testAiConnection() {
  const cfg = collectAiFormConfig();
  if (!cfg.aiBaseUrl) { showStatus(I18N.t('aiNoBaseUrl'), 'info'); return; }
  const statusEl = aiField('aiTestStatus');
  const btn = aiField('aiTestBtn');
  if (btn) btn.disabled = true;
  if (statusEl) statusEl.textContent = I18N.t('aiTesting');
  const r = await sendMessage('askViaApi', { prompt: 'ping', config: cfg });
  if (statusEl) {
    if (r && r.answer) statusEl.textContent = '✅ ' + I18N.t('aiTestOk');
    else statusEl.textContent = '❌ ' + ((r && r.error) || I18N.t('aiTestFail'));
  }
  if (btn) btn.disabled = false;
}

function toggleAiKeyVisible() {
  const input = aiField('aiApiKey');
  const btn = aiField('aiKeyToggle');
  if (!input || !btn) return;
  const isPwd = input.type === 'password';
  input.type = isPwd ? 'text' : 'password';
  btn.textContent = isPwd ? I18N.t('aiKeyHide') : I18N.t('aiKeyShow');
}

function toggleAiAllowAny() {
  const sw = aiField('aiAllowAnySwitch');
  if (sw) sw.classList.toggle('on');
}

// ========== 语音服务（ASR 转写） ==========
// 蓝区「语音服务」设置 + 红区「转写」面板。
// ASR 后端：浏览器内置（Web Speech API）/ 微软 Azure（REST）/ OpenAI Whisper（兼容服务）/ 阿里云（DashScope）/ 本地服务（本地部署 HTTP）。
// browser 后端：Chrome 走 Google 云（中国大陆网络不可达，见 browserAsrHint），Edge 走微软 Azure（国内外可用）。
const ASR_BACKEND_IDS = ['browser', 'azure', 'openai', 'aliyun', 'local'];
const ASR_STORAGE_KEYS = ['voiceAzureKey', 'voiceAzureRegion', 'voiceOpenaiKey', 'voiceOpenaiBase', 'voiceAliyunKey', 'voiceLocalServer', 'asrBackend', 'asrMicDeviceId', 'ttsEngine', 'ttsLocalSid', 'ttsLocalVoice', 'cloudTtsBase', 'cloudTtsKey', 'cloudTtsModel', 'cloudTtsVoice', 'ttsProvider', 'azureTtsKey', 'azureTtsRegion', 'azureTtsVoice', 'cosyTtsKey', 'cosyTtsModel', 'cosyTtsVoice', 'voiceCircleForceSystem', 'ttsReadThinking'];

// 本地 TTS 引擎（本地模型，朗读面板显示「音色」行）
const LOCAL_TTS_ENGINES = ['kokoro', 'qwen3'];
// 走本地服务 /speak 的所有朗读引擎（含云端 OpenAI 兼容，engine 名与 /speak?engine= 对应）
const SPEAK_ENGINES = ['kokoro', 'qwen3', 'cloud', 'azure', 'cosyvoice'];
const QWEN3_VOICES = ['Vivian', 'Serena', 'Uncle_Fu', 'Dylan', 'Eric', 'Ryan', 'Aiden', 'Ono_Anna', 'Sohee'];
const KOKORO_SID_HINT = { 18: '· 混合推荐', 48: '· 中文', 49: '· 中文', 50: '· 中文', 51: '· 中文', 52: '· 中文' };

// 云端 TTS 供应商预设（TTS_ENGINES.cloud，OpenAI 兼容 /audio/speech）：切换时自动填 Base URL + 模型/音色建议
const TTS_CLOUD_PROVIDERS = {
  openai: {
    baseUrl: 'https://api.openai.com/v1',
    models: ['tts-1', 'tts-1-hd', 'gpt-4o-mini-tts'],
    defaultModel: 'tts-1',
    voices: ['alloy', 'coral', 'echo', 'fable', 'onyx', 'nova', 'shimmer'],
    defaultVoice: 'alloy'
  },
  minimax: {
    baseUrl: 'https://api.minimax.io/v1',
    models: ['speech-02-turbo', 'speech-02-hd'],
    defaultModel: 'speech-02-turbo',
    voices: ['male-qn-qingse', 'female-shaonv', 'male-qn-jingying'],
    defaultVoice: 'male-qn-qingse'
  },
  siliconflow: {
    baseUrl: 'https://api.siliconflow.cn/v1',
    models: ['Fishtalk/Fish-Audio-1.5'],
    defaultModel: 'Fishtalk/Fish-Audio-1.5',
    voices: ['fishaudio/default', 'fishaudio/speaker'],
    defaultVoice: 'fishaudio/default'
  },
  custom: {
    baseUrl: '',
    models: [],
    defaultModel: 'tts-1',
    voices: [],
    defaultVoice: 'alloy'
  }
};

let currentVoiceConfig = {
  voiceAzureKey: '',
  voiceAzureRegion: '',
  voiceOpenaiKey: '',
  voiceOpenaiBase: '',
  voiceAliyunKey: '',
  voiceLocalServer: 'http://127.0.0.1:9528',
  asrBackend: 'browser',
  asrMicDeviceId: '',
  ttsEngine: 'system',   // system | kokoro | qwen3 | cloud（朗读引擎）
  ttsLocalSid: 18,       // Kokoro 音色号
  ttsLocalVoice: 'Vivian', // Qwen3 预设音色
  cloudTtsBase: 'https://api.openai.com/v1',  // 🌐 云端 TTS（OpenAI 兼容 /audio/speech）
  cloudTtsKey: '',
  cloudTtsModel: 'tts-1',
  cloudTtsVoice: 'alloy',
  ttsProvider: 'openai',  // 云端 TTS 供应商（TTS_CLOUD_PROVIDERS key）
  azureTtsKey: '',        // 🟦 微软 Azure（独立协议）
  azureTtsRegion: '',
  azureTtsVoice: 'zh-CN-XiaoxiaoNeural',
  cosyTtsKey: '',         // 🔵 阿里云 CosyVoice（独立协议）
  cosyTtsModel: 'cosyvoice-v1',
  cosyTtsVoice: 'longxiaochun',
  voiceCircleForceSystem: false,  // 工作台朗读：true=固定系统 TTS（即时），false=跟随朗读引擎
  ttsReadThinking: false          // 朗读是否包含 AI 思考内容（默认只读正文）
};
let currentAsrBackend = 'browser';

function voiceField(id) { return document.getElementById(id); }

async function loadVoiceConfig() {
  const r = await chrome.storage.local.get(ASR_STORAGE_KEYS);
  currentVoiceConfig = {
    voiceAzureKey: String(r.voiceAzureKey || '').trim(),
    voiceAzureRegion: String(r.voiceAzureRegion || '').trim(),
    voiceOpenaiKey: String(r.voiceOpenaiKey || '').trim(),
    voiceOpenaiBase: String(r.voiceOpenaiBase || 'https://api.openai.com/v1').trim(),
    voiceAliyunKey: String(r.voiceAliyunKey || '').trim(),
    voiceLocalServer: String(r.voiceLocalServer || 'http://127.0.0.1:9528').trim(),
    asrMicDeviceId: String(r.asrMicDeviceId || '').trim(),
    ttsEngine: (['kokoro', 'qwen3', 'cloud'].includes(r.ttsEngine)) ? r.ttsEngine : 'system',
    ttsLocalSid: (!isNaN(Number(r.ttsLocalSid)) && Number(r.ttsLocalSid) >= 0) ? Number(r.ttsLocalSid) : 18,
    ttsLocalVoice: String(r.ttsLocalVoice || 'Vivian').trim(),
    cloudTtsBase: String(r.cloudTtsBase || 'https://api.openai.com/v1').trim(),
    cloudTtsKey: String(r.cloudTtsKey || '').trim(),
    cloudTtsModel: String(r.cloudTtsModel || 'tts-1').trim(),
    cloudTtsVoice: String(r.cloudTtsVoice || 'alloy').trim(),
    ttsProvider: TTS_CLOUD_PROVIDERS[r.ttsProvider] ? r.ttsProvider : 'openai',
    azureTtsKey: String(r.azureTtsKey || '').trim(),
    azureTtsRegion: String(r.azureTtsRegion || '').trim(),
    azureTtsVoice: String(r.azureTtsVoice || 'zh-CN-XiaoxiaoNeural').trim(),
    cosyTtsKey: String(r.cosyTtsKey || '').trim(),
    cosyTtsModel: String(r.cosyTtsModel || 'cosyvoice-v1').trim(),
    cosyTtsVoice: String(r.cosyTtsVoice || 'longxiaochun').trim(),
    voiceCircleForceSystem: !!r.voiceCircleForceSystem,
    ttsReadThinking: !!r.ttsReadThinking
  };
  const key = voiceField('voiceAzureKey'); if (key) key.value = currentVoiceConfig.voiceAzureKey;
  const reg = voiceField('voiceAzureRegion'); if (reg) reg.value = currentVoiceConfig.voiceAzureRegion;
  const ok = voiceField('voiceOpenaiKey'); if (ok) ok.value = currentVoiceConfig.voiceOpenaiKey;
  const ob = voiceField('voiceOpenaiBase'); if (ob) ob.value = currentVoiceConfig.voiceOpenaiBase;
  const ak = voiceField('voiceAliyunKey'); if (ak) ak.value = currentVoiceConfig.voiceAliyunKey;
  const ls = voiceField('voiceLocalServer'); if (ls) ls.value = currentVoiceConfig.voiceLocalServer;
  const ctb = voiceField('cloudTtsBase'); if (ctb) ctb.value = currentVoiceConfig.cloudTtsBase;
  const ctk = voiceField('cloudTtsKey'); if (ctk) ctk.value = currentVoiceConfig.cloudTtsKey;
  const ctm = voiceField('cloudTtsModel'); if (ctm) ctm.value = currentVoiceConfig.cloudTtsModel;
  const ctv = voiceField('cloudTtsVoice'); if (ctv) ctv.value = currentVoiceConfig.cloudTtsVoice;
  const tp = voiceField('ttsProvider'); if (tp) tp.value = currentVoiceConfig.ttsProvider;
  populateTtsCloudDatalist(currentVoiceConfig.ttsProvider);
  const atk = voiceField('azureTtsKey'); if (atk) atk.value = currentVoiceConfig.azureTtsKey;
  const atr = voiceField('azureTtsRegion'); if (atr) atr.value = currentVoiceConfig.azureTtsRegion;
  const atv = voiceField('azureTtsVoice'); if (atv) atv.value = currentVoiceConfig.azureTtsVoice;
  const csk = voiceField('cosyTtsKey'); if (csk) csk.value = currentVoiceConfig.cosyTtsKey;
  const csm = voiceField('cosyTtsModel'); if (csm) csm.value = currentVoiceConfig.cosyTtsModel;
  const csv = voiceField('cosyTtsVoice'); if (csv) csv.value = currentVoiceConfig.cosyTtsVoice;
  const cfs = voiceField('voiceCircleForceSystem'); if (cfs) cfs.checked = currentVoiceConfig.voiceCircleForceSystem;
  const trt = voiceField('ttsReadThinking'); if (trt) trt.checked = currentVoiceConfig.ttsReadThinking;
  currentAsrBackend = ASR_BACKEND_IDS.includes(r.asrBackend) ? r.asrBackend : 'browser';
  syncAsrBackendUi();
  syncTtsEngineUi();
}

function collectVoiceConfig() {
  return {
    voiceAzureKey: (voiceField('voiceAzureKey') && voiceField('voiceAzureKey').value || '').trim(),
    voiceAzureRegion: (voiceField('voiceAzureRegion') && voiceField('voiceAzureRegion').value || '').trim(),
    voiceOpenaiKey: (voiceField('voiceOpenaiKey') && voiceField('voiceOpenaiKey').value || '').trim(),
    voiceOpenaiBase: (voiceField('voiceOpenaiBase') && voiceField('voiceOpenaiBase').value || '').trim(),
    voiceAliyunKey: (voiceField('voiceAliyunKey') && voiceField('voiceAliyunKey').value || '').trim(),
    voiceLocalServer: (voiceField('voiceLocalServer') && voiceField('voiceLocalServer').value || '').trim(),
    ttsEngine: (voiceField('ttsEngineBlue') && voiceField('ttsEngineBlue').value) || currentVoiceConfig.ttsEngine || 'system',
    ttsLocalSid: currentVoiceConfig.ttsLocalSid,
    ttsLocalVoice: currentVoiceConfig.ttsLocalVoice,
    cloudTtsBase: (voiceField('cloudTtsBase') && voiceField('cloudTtsBase').value || '').trim(),
    cloudTtsKey: (voiceField('cloudTtsKey') && voiceField('cloudTtsKey').value || '').trim(),
    cloudTtsModel: (voiceField('cloudTtsModel') && voiceField('cloudTtsModel').value || '').trim(),
    cloudTtsVoice: (voiceField('cloudTtsVoice') && voiceField('cloudTtsVoice').value || '').trim(),
    ttsProvider: (voiceField('ttsProvider') && voiceField('ttsProvider').value) || currentVoiceConfig.ttsProvider || 'openai',
    azureTtsKey: (voiceField('azureTtsKey') && voiceField('azureTtsKey').value || '').trim(),
    azureTtsRegion: (voiceField('azureTtsRegion') && voiceField('azureTtsRegion').value || '').trim(),
    azureTtsVoice: (voiceField('azureTtsVoice') && voiceField('azureTtsVoice').value || 'zh-CN-XiaoxiaoNeural').trim(),
    cosyTtsKey: (voiceField('cosyTtsKey') && voiceField('cosyTtsKey').value || '').trim(),
    cosyTtsModel: (voiceField('cosyTtsModel') && voiceField('cosyTtsModel').value || 'cosyvoice-v1').trim(),
    cosyTtsVoice: (voiceField('cosyTtsVoice') && voiceField('cosyTtsVoice').value || 'longxiaochun').trim(),
    voiceCircleForceSystem: !!(voiceField('voiceCircleForceSystem') && voiceField('voiceCircleForceSystem').checked),
    ttsReadThinking: !!(voiceField('ttsReadThinking') && voiceField('ttsReadThinking').checked)
  };
}

// 蓝区「TTS 朗读」卡保存：云端 TTS + 工作台朗读（引擎/音色已随 change 即时保存）
async function saveTtsConfig() {
  const c = currentVoiceConfig;
  const subset = {
    cloudTtsBase: (voiceField('cloudTtsBase') && voiceField('cloudTtsBase').value || '').trim(),
    cloudTtsKey: (voiceField('cloudTtsKey') && voiceField('cloudTtsKey').value || '').trim(),
    cloudTtsModel: (voiceField('cloudTtsModel') && voiceField('cloudTtsModel').value || '').trim(),
    cloudTtsVoice: (voiceField('cloudTtsVoice') && voiceField('cloudTtsVoice').value || '').trim(),
    ttsProvider: (voiceField('ttsProvider') && voiceField('ttsProvider').value) || c.ttsProvider || 'openai',
    azureTtsKey: (voiceField('azureTtsKey') && voiceField('azureTtsKey').value || '').trim(),
    azureTtsRegion: (voiceField('azureTtsRegion') && voiceField('azureTtsRegion').value || '').trim(),
    azureTtsVoice: (voiceField('azureTtsVoice') && voiceField('azureTtsVoice').value || 'zh-CN-XiaoxiaoNeural').trim(),
    cosyTtsKey: (voiceField('cosyTtsKey') && voiceField('cosyTtsKey').value || '').trim(),
    cosyTtsModel: (voiceField('cosyTtsModel') && voiceField('cosyTtsModel').value || 'cosyvoice-v1').trim(),
    cosyTtsVoice: (voiceField('cosyTtsVoice') && voiceField('cosyTtsVoice').value || 'longxiaochun').trim(),
    voiceCircleForceSystem: !!(voiceField('voiceCircleForceSystem') && voiceField('voiceCircleForceSystem').checked),
    ttsReadThinking: !!(voiceField('ttsReadThinking') && voiceField('ttsReadThinking').checked),
    ttsEngine: c.ttsEngine,
    ttsLocalSid: c.ttsLocalSid,
    ttsLocalVoice: c.ttsLocalVoice
  };
  Object.assign(currentVoiceConfig, subset);
  await chrome.storage.local.set(subset);
  showStatus(I18N.t('ttsSvcSaved'), 'success');
}

// 蓝区「ASR 识别」卡保存：云端三家凭据 + 本地服务地址（供 ASR/TTS/LLM 本地共用）
async function saveAsrConfig() {
  const subset = {
    voiceAzureKey: (voiceField('voiceAzureKey') && voiceField('voiceAzureKey').value || '').trim(),
    voiceAzureRegion: (voiceField('voiceAzureRegion') && voiceField('voiceAzureRegion').value || '').trim(),
    voiceOpenaiKey: (voiceField('voiceOpenaiKey') && voiceField('voiceOpenaiKey').value || '').trim(),
    voiceOpenaiBase: (voiceField('voiceOpenaiBase') && voiceField('voiceOpenaiBase').value || '').trim(),
    voiceAliyunKey: (voiceField('voiceAliyunKey') && voiceField('voiceAliyunKey').value || '').trim(),
    voiceLocalServer: (voiceField('voiceLocalServer') && voiceField('voiceLocalServer').value || '').trim(),
    asrBackend: currentAsrBackend
  };
  Object.assign(currentVoiceConfig, subset);
  await chrome.storage.local.set(subset);
  showStatus(I18N.t('asrSvcSaved'), 'success');
}

// OpenAI 兼容 ASR 的 Key：独立字段优先，否则复用 AI 服务里的 OpenAI Key
function getOpenaiAsrKey() {
  if (currentVoiceConfig.voiceOpenaiKey) return currentVoiceConfig.voiceOpenaiKey;
  if (typeof currentAiConfig !== 'undefined' && currentAiConfig.aiProvider === 'openai') {
    return currentAiConfig.aiApiKey || '';
  }
  return '';
}

// 蓝区「连接测试」：按当前选中的识别后端（本地 / Azure / OpenAI / 阿里云）验证凭据与连通性
async function testAsrConnection() {
  const statusEl = voiceField('asrTestStatus');
  const btn = voiceField('asrConnTestBtn');
  if (btn) btn.disabled = true;
  if (statusEl) statusEl.textContent = I18N.t('asrTesting');
  currentVoiceConfig = collectVoiceConfig();
  try {
    if (currentAsrBackend === 'local') await testLocalAsr(statusEl);
    else if (currentAsrBackend === 'browser') await testBrowserAsr(statusEl);
    else await testCloudAsr(currentAsrBackend, statusEl);
  } catch (e) {
    if (statusEl) statusEl.textContent = '❌ ' + ((e && e.message) || String(e));
  } finally {
    if (btn) btn.disabled = false;
  }
}

// browser 后端测试：能力检测 + Google/Azure 语音服务可达性探测（不消耗录音）
async function testBrowserAsr(statusEl) {
  if (!browserAsrSupported()) {
    if (statusEl) statusEl.textContent = '❌ ' + I18N.t('asrBrowserUnsupported');
    return;
  }
  const reachable = await probeBrowserAsrNetwork();
  if (reachable) {
    if (statusEl) statusEl.textContent = '✅ ' + I18N.t('asrBrowserTestOk');
  } else if (isEdgeBrowser()) {
    if (statusEl) statusEl.textContent = '✅ ' + I18N.t('asrBrowserTestOkEdge');
  } else {
    if (statusEl) {
      statusEl.textContent = '⚠️ ' + I18N.t('asrBrowserChinaWarn');
      statusEl.classList.add('error');
    }
  }
}

// 本地后端测试：检测本地 ASR 服务是否在线（/health），报告引擎与 TTS 状态
async function testLocalAsr(statusEl) {
  const serverUrl = currentVoiceConfig.voiceLocalServer || 'http://127.0.0.1:9528';
  try {
    const r = await fetch(serverUrl.replace(/\/+$/, '') + '/health', { signal: AbortSignal.timeout(5000) });
    const data = await r.json().catch(() => ({}));
    if (r.ok && data.ok) {
      const t = data.tts || {};
      const ttsInfo = (t.kokoro === 'ready' ? 'Kokoro ✓' : 'Kokoro ✗')
        + ' · ' + (t.qwen3 === 'reachable' ? 'Qwen3 ✓' : 'Qwen3 ✗');
      if (statusEl) statusEl.textContent = '✅ 本地服务在线：' + (data.engines || []).join(', ') + ' ｜ TTS ' + ttsInfo;
    } else {
      if (statusEl) statusEl.textContent = '❌ 本地服务未就绪（请先 cd asr-server && npm start）';
    }
  } catch (e) {
    if (statusEl) statusEl.textContent = '❌ 本地服务连接失败：' + (e.message || '请先启动 asr-server');
  }
}

// 合成测试音：1.5s 双频提示音（440+880Hz）→ 16kHz Int16 PCM，非静音避免被判定「无有效音频」
function makeTestTonePcm(rate = 16000, seconds = 1.5, amp = 0.3) {
  const n = Math.floor(rate * seconds);
  const out = new Int16Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    out[i] = Math.round(amp * 32767 * (0.6 * Math.sin(2 * Math.PI * 440 * t) + 0.4 * Math.sin(2 * Math.PI * 880 * t)));
  }
  return out;
}

// 云端后端测试：合成测试音送所选供应商；HTTP 200 即连接成功（凭据/端点有效），有文本则附识别结果
async function testCloudAsr(backend, statusEl) {
  const labels = { azure: 'Azure', openai: 'OpenAI Whisper', aliyun: '阿里云' };
  const label = labels[backend] || backend;
  const pcm16 = makeTestTonePcm();
  let text = '';
  if (backend === 'azure') text = await testAsrAzure(pcm16);
  else if (backend === 'openai') text = await testAsrOpenai(pcm16);
  else if (backend === 'aliyun') text = await testAsrAliyun(pcm16);
  const ok = '✅ ' + I18N.t('asrTestConnOk') + ' · ' + label;
  if (statusEl) {
    statusEl.textContent = text ? (ok + '｜识别到：' + text) : ok;
  }
}

// 微软 Azure STT 连接测试：请求构造同 asrViaAzure，但 HTTP 200 即视为成功（NoMatch 不判失败）
async function testAsrAzure(pcm16) {
  const cfg = currentVoiceConfig;
  if (!cfg.voiceAzureKey || !cfg.voiceAzureRegion) throw new Error(I18N.t('asrNoConfig'));
  const region = cfg.voiceAzureRegion.replace(/^https?:\/\//, '').split('.')[0];
  const lang = String(document.documentElement.lang).startsWith('zh') ? 'zh-CN' : 'en-US';
  const url = `https://${region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=${lang}&format=detailed`;
  const wav = encodeWav(pcm16, 16000);
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': cfg.voiceAzureKey,
      'Content-Type': 'audio/wav; codecs=audio/pcm; samplerate=16000',
      'Accept': 'application/json'
    },
    body: wav,
    signal: AbortSignal.timeout(30000)
  });
  if (!res.ok) throw new Error('Azure HTTP ' + res.status);
  const data = await res.json().catch(() => ({}));
  if (data.RecognitionStatus === 'Success') return data.DisplayText || '';
  return ''; // NoMatch：连接成功但未识别到语音
}

// OpenAI Whisper 连接测试：multipart /audio/transcriptions，HTTP 200 即成功
async function testAsrOpenai(pcm16) {
  const cfg = currentVoiceConfig;
  const key = getOpenaiAsrKey();
  if (!key) throw new Error(I18N.t('asrNoConfig'));
  const base = (cfg.voiceOpenaiBase || 'https://api.openai.com/v1').replace(/\/+$/, '');
  const wav = encodeWav(pcm16, 16000);
  const form = new FormData();
  form.append('model', 'whisper-1');
  form.append('response_format', 'json');
  form.append('file', new Blob([wav], { type: 'audio/wav' }), 'test.wav');
  const res = await fetch(base + '/audio/transcriptions', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + key },
    body: form,
    signal: AbortSignal.timeout(30000)
  });
  if (!res.ok) throw new Error('OpenAI HTTP ' + res.status);
  const data = await res.json().catch(() => ({}));
  return (data.text || '').trim();
}

// 阿里云 DashScope Qwen-ASR 连接测试：chat/completions + base64 WAV，HTTP 200 即成功
async function testAsrAliyun(pcm16) {
  const cfg = currentVoiceConfig;
  if (!cfg.voiceAliyunKey) throw new Error(I18N.t('asrNoConfig'));
  const wav = encodeWav(pcm16, 16000);
  let binary = '';
  const bytes = new Uint8Array(wav.buffer || wav);
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  }
  const dataUrl = 'data:audio/wav;base64,' + btoa(binary);
  const res = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + cfg.voiceAliyunKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'qwen3-asr-flash',
      messages: [{ role: 'user', content: [{ type: 'input_audio', input_audio: dataUrl }] }],
      stream: false,
      asr_options: { language: String(document.documentElement.lang).startsWith('zh') ? 'zh' : undefined }
    }),
    signal: AbortSignal.timeout(60000)
  });
  if (!res.ok) throw new Error('阿里云 HTTP ' + res.status);
  const data = await res.json().catch(() => ({}));
  const text = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
  return String(text || '').trim();
}

// ---- 蓝区「真人语音测试」：录音 → 送当前选中的识别后端真实转写 ----
let asrTestRecorder = null, asrTestStream = null, asrTestChunks = [], asrTestRecording = false;

function setAsrVoiceTestBtnRecording(on) {
  const btn = voiceField('asrVoiceTestBtn');
  if (btn) {
    btn.textContent = on ? I18N.t('asrVoiceTestStop') : I18N.t('asrVoiceTestBtn');
    btn.classList.toggle('recording', on);
  }
}

async function toggleAsrVoiceTest() {
  if (asrTestRecording) { stopAsrVoiceTest(); return; }
  const statusEl = voiceField('asrTestStatus');
  if (statusEl) statusEl.textContent = '🎙 ' + I18N.t('asrStarting');
  try {
    // 与转写面板一致：关闭音频处理，保留原始信号；支持指定麦克风设备
    const audioConstraints = { echoCancellation: false, noiseSuppression: false, autoGainControl: false };
    if (currentVoiceConfig.asrMicDeviceId) audioConstraints.deviceId = { exact: currentVoiceConfig.asrMicDeviceId };
    const stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
    asrTestStream = stream;
    asrTestChunks = [];
    let mime = '';
    if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) mime = 'audio/webm;codecs=opus';
    else if (MediaRecorder.isTypeSupported('audio/webm')) mime = 'audio/webm';
    asrTestRecorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    asrTestRecorder.ondataavailable = (e) => { if (e.data && e.data.size) asrTestChunks.push(e.data); };
    asrTestRecorder.onstop = onAsrVoiceTestDone;
    asrTestRecorder.start();
    asrTestRecording = true;
    setAsrVoiceTestBtnRecording(true);
    if (statusEl) {
      statusEl.textContent = '🎙 ' + I18N.t('asrPreparing');
      setTimeout(() => { if (asrTestRecording && statusEl) statusEl.textContent = I18N.t('asrRecording'); }, 600);
    }
  } catch (e) {
    // MV3 侧边栏无法弹授权弹窗：NotAllowedError 时引导去可见授权页授权一次
    const name = e && (e.name || e.message);
    if (statusEl) statusEl.textContent = (name && /NotAllowed|PermissionDismissed|SecurityError/.test(name))
      ? I18N.t('asrMicPermNeeded') : I18N.t('asrMicrophoneDenied');
  }
}

function stopAsrVoiceTest() {
  if (asrTestRecorder && asrTestRecorder.state !== 'inactive') asrTestRecorder.stop();
}

async function onAsrVoiceTestDone() {
  const recorder = asrTestRecorder;
  asrTestRecorder = null;
  asrTestRecording = false;
  setAsrVoiceTestBtnRecording(false);
  if (asrTestStream) { asrTestStream.getTracks().forEach(t => t.stop()); asrTestStream = null; }
  const type = (recorder && recorder.mimeType) || 'audio/webm';
  const blob = new Blob(asrTestChunks, { type });
  asrTestChunks = [];
  const statusEl = voiceField('asrTestStatus');
  try {
    const buf = await blob.arrayBuffer();
    const pcm16 = await decodeAndResample(buf, 16000);
    if (pcm16.length < 4800) { if (statusEl) statusEl.textContent = I18N.t('asrAudioTooShort'); return; } // < 0.3s
    // 自动增益：弱麦克风采集音量偏低时放大到合理范围
    let peak = 0;
    for (let i = 0; i < pcm16.length; i++) peak = Math.max(peak, Math.abs(pcm16[i]));
    if (peak > 0.01 && peak < 0.5) {
      const gain = 0.8 / peak;
      for (let i = 0; i < pcm16.length; i++) pcm16[i] = Math.max(-1, Math.min(1, pcm16[i] * gain));
    }
    // 静音检测：RMS 过低说明麦克风没真正录到声音
    let sum = 0;
    for (let i = 0; i < pcm16.length; i++) sum += pcm16[i] * pcm16[i];
    const rms = Math.sqrt(sum / pcm16.length);
    if (rms < 0.01) { if (statusEl) statusEl.textContent = I18N.t('asrSilent', rms.toFixed(4)); return; }
    if (statusEl) statusEl.textContent = '⏳ ' + I18N.t('asrTesting');
    const text = await runAsr(pcm16); // 走当前选中的识别后端
    if (statusEl) {
      statusEl.textContent = text
        ? '✅ ' + I18N.t('asrTestOk') + '｜' + text
        : I18N.t('asrNoAudioError');
    }
  } catch (e) {
    if (statusEl) statusEl.textContent = '❌ ' + ((e && e.message) || I18N.t('asrNoAudioError'));
  }
}

// ---- 朗读引擎 UI（系统 / Kokoro / Qwen3 / 云端）----
// 引擎设置存 storage，朗读面板与蓝区语音服务卡共用，双向同步
function syncTtsEngineUi() {
  const engine = currentVoiceConfig.ttsEngine;
  const selBlue = voiceField('ttsEngineBlue');
  const selChat = voiceField('chatTtsEngine');
  if (selBlue) selBlue.value = engine;
  if (selChat) selChat.value = engine;
  // i 设置里的音色行仅系统引擎适用（本地/云端音色各自在蓝区配置）
  const chatVoiceRow = document.getElementById('chatTtsVoiceRow');
  if (chatVoiceRow) chatVoiceRow.classList.toggle('hidden', engine !== 'system');
  const isLocal = LOCAL_TTS_ENGINES.includes(engine);   // 本地引擎 → 显示本地音色行
  const isSys = engine === 'system';                     // 系统 → 显示系统音色行
  // 蓝区 TTS 卡：系统音色行 / 本地音色行 显隐
  const sysRow = document.getElementById('ttsSysVoiceRowBlue');
  const localRow = document.getElementById('ttsLocalVoiceRowBlue');
  if (sysRow) sysRow.classList.toggle('hidden', !isSys);
  if (localRow) localRow.classList.toggle('hidden', !isLocal);
  if (['cloud', 'azure', 'cosyvoice'].includes(engine)) {
    // 云端引擎（含独立协议）：隐藏系统/本地音色行，云端音色由各渠道自己的配置区设定
    if (sysRow) sysRow.classList.add('hidden');
    if (localRow) localRow.classList.add('hidden');
  }
  populateLocalVoices();
}

function setTtsEngine(engine) {
  if (!['system', 'kokoro', 'qwen3', 'cloud', 'azure', 'cosyvoice'].includes(engine)) return;
  currentVoiceConfig.ttsEngine = engine;
  chrome.storage.local.set({ ttsEngine: engine });
  syncTtsEngineUi();
}

// ---- 云端 TTS 供应商：切换自动填 Base URL + 模型/音色建议 ----
function populateTtsCloudDatalist(provider) {
  const meta = TTS_CLOUD_PROVIDERS[provider] || TTS_CLOUD_PROVIDERS.custom;
  const mdlList = voiceField('cloudTtsModelList');
  const model = voiceField('cloudTtsModel');
  if (mdlList) mdlList.innerHTML = (meta.models || []).map((m) => `<option value="${m}"></option>`).join('');
  if (model && meta.defaultModel) model.placeholder = meta.defaultModel;
  const vceList = voiceField('cloudTtsVoiceList');
  const voice = voiceField('cloudTtsVoice');
  if (vceList) vceList.innerHTML = (meta.voices || []).map((v) => `<option value="${v}"></option>`).join('');
  if (voice && meta.defaultVoice) voice.placeholder = meta.defaultVoice;
}

function onTtsProviderChange() {
  const sel = voiceField('ttsProvider');
  const provider = (sel && sel.value) || 'openai';
  const base = voiceField('cloudTtsBase');
  if (base) {
    const current = base.value.trim();
    const isOtherDefault = Object.keys(TTS_CLOUD_PROVIDERS)
      .filter((k) => k !== provider)
      .some((k) => TTS_CLOUD_PROVIDERS[k].baseUrl === current);
    if (!current || isOtherDefault) {
      base.value = (TTS_CLOUD_PROVIDERS[provider] && TTS_CLOUD_PROVIDERS[provider].baseUrl) || '';
    }
  }
  populateTtsCloudDatalist(provider);
}

// 填充本地音色下拉（Kokoro 从 /health 拿音色数；Qwen3 用预设 speaker 名）
async function populateLocalVoices() {
  const selBlue = voiceField('ttsLocalVoiceBlue');
  if (!selBlue) return;
  const engine = currentVoiceConfig.ttsEngine;
  const serverUrl = (currentVoiceConfig.voiceLocalServer || 'http://127.0.0.1:9528').replace(/\/+$/, '');
  let options = [];
  let selected = '';
  if (engine === 'kokoro') {
    let count = 53;
    try {
      const r = await fetch(serverUrl + '/health', { signal: AbortSignal.timeout(4000) });
      const data = await r.json().catch(() => ({}));
      if (data && data.tts && data.tts.kokoroSpeakers) count = data.tts.kokoroSpeakers;
    } catch (e) { /* 服务未就绪时用默认 53 */ }
    for (let i = 0; i < count; i++) {
      options.push({ value: String(i), label: 'sid ' + i + (KOKORO_SID_HINT[i] ? ' ' + KOKORO_SID_HINT[i] : '') });
    }
    selected = String(currentVoiceConfig.ttsLocalSid);
  } else if (engine === 'qwen3') {
    options = QWEN3_VOICES.map(v => ({ value: v, label: v }));
    selected = currentVoiceConfig.ttsLocalVoice || 'Vivian';
  }
  const apply = (select) => {
    if (!select) return;
    select.innerHTML = '';
    if (!options.length) {
      select.innerHTML = `<option value="">${I18N.t('ttsLocalNotReady', I18N.t('ttsLocalServerOffline'))}</option>`;
      return;
    }
    for (const o of options) {
      const opt = document.createElement('option');
      opt.value = o.value;
      opt.textContent = o.label;
      select.appendChild(opt);
    }
    if (options.some(o => o.value === selected)) select.value = selected;
    else select.selectedIndex = 0;
  };
  apply(selBlue);
}

// 音色选择变化 → 写入 storage（Kokoro 存 sid 数字，Qwen3 存 speaker 名）
function saveLocalVoice(sel) {
  if (!sel || !sel.value) return;
  const engine = currentVoiceConfig.ttsEngine;
  if (engine === 'kokoro') {
    currentVoiceConfig.ttsLocalSid = Number(sel.value);
    chrome.storage.local.set({ ttsLocalSid: Number(sel.value) });
  } else if (engine === 'qwen3') {
    currentVoiceConfig.ttsLocalVoice = sel.value;
    chrome.storage.local.set({ ttsLocalVoice: sel.value });
  }
}

// ---- 本地模型管理（014 §5.2：/models 清单 + /install-model NDJSON 进度）----
const MODEL_CAT_LABEL = { tts: 'TTS', asr: 'ASR', llm: 'LLM' };

function loadVoiceModels() {
  const box = document.getElementById('modelManager');
  const statusEl = document.getElementById('modelManagerStatus');
  const btn = document.getElementById('modelRefreshBtn');
  if (!box) return;
  if (btn) btn.disabled = true;
  if (statusEl) statusEl.textContent = I18N.t('modelLoading');
  const serverUrl = (currentVoiceConfig.voiceLocalServer || 'http://127.0.0.1:9528').replace(/\/+$/, '');
  fetch(serverUrl + '/models', { signal: AbortSignal.timeout(5000) })
    .then(async (r) => {
      const data = await r.json().catch(() => ({}));
      if (!r.ok || !Array.isArray(data.models)) throw new Error('bad');
      renderModelRows(box, data.models);
      if (statusEl) statusEl.textContent = '';
    })
    .catch(() => {
      box.innerHTML = `<div class="hint" style="color:#f87171;">${I18N.t('modelServerOffline')}</div>`;
      if (statusEl) statusEl.textContent = '';
    })
    .finally(() => { if (btn) btn.disabled = false; });
}

function renderModelRows(box, models) {
  box.innerHTML = models.map(m => `
    <div class="model-row" data-engine="${m.engine}">
      <span class="model-info">${MODEL_CAT_LABEL[m.category] || m.category} · ${m.label}<em>${m.size}</em></span>
      <span class="model-status${m.installed ? ' ok' : ''}">${m.installed ? I18N.t('modelStatusInstalled') : I18N.t('modelStatusMissing')}</span>
      <button type="button" class="mini-btn"${m.installed ? ' disabled' : ''}>${I18N.t('modelInstall')}</button>
    </div>`).join('');
  box.querySelectorAll('.model-row').forEach(row => {
    const btn = row.querySelector('.mini-btn');
    if (!btn || btn.disabled) return;
    btn.addEventListener('click', () => installModel(row, btn));
  });
}

async function installModel(row, btn) {
  const engine = row.dataset.engine;
  const statusEl = row.querySelector('.model-status');
  const serverUrl = (currentVoiceConfig.voiceLocalServer || 'http://127.0.0.1:9528').replace(/\/+$/, '');
  btn.disabled = true;
  statusEl.className = 'model-status downloading';
  statusEl.textContent = I18N.t('modelStatusDownloading');
  try {
    const res = await fetch(serverUrl + '/install-model?engine=' + encodeURIComponent(engine), { method: 'POST' });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      statusEl.className = 'model-status';
      statusEl.textContent = '❌ ' + (data.error || ('HTTP ' + res.status));
      return;
    }
    // NDJSON 流式读安装进度（每行 {type:'log'|'done'|'error', message}）
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let idx;
      while ((idx = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, idx).trim();
        buf = buf.slice(idx + 1);
        if (!line) continue;
        let obj;
        try { obj = JSON.parse(line); } catch { continue; }
        if (obj.type === 'log') {
          statusEl.className = 'model-status downloading';
          statusEl.textContent = '⏳ ' + String(obj.message || '');
        } else if (obj.type === 'done') {
          statusEl.className = 'model-status ok';
          statusEl.textContent = '✅ ' + String(obj.message || I18N.t('modelStatusInstalled'));
        } else if (obj.type === 'error') {
          throw new Error(String(obj.message || '安装失败'));
        }
      }
    }
    loadVoiceModels(); // 安装完成 → 刷新状态
  } catch (e) {
    statusEl.className = 'model-status';
    statusEl.textContent = '❌ ' + ((e && e.message) || e);
  } finally {
    btn.disabled = false;
  }
}

// ---- 转写面板：后端切换 ----
function setAsrBackend(id) {
  if (!ASR_BACKEND_IDS.includes(id)) return;
  currentAsrBackend = id;
  chrome.storage.local.set({ asrBackend: id });
  syncAsrBackendUi();
}

function syncAsrBackendUi() {
  const selBlue = voiceField('asrBackendBlue');
  if (selBlue) selBlue.value = currentAsrBackend;
  const selChat = document.getElementById('chatAsrBackend');
  if (selChat) selChat.value = currentAsrBackend;
  const map = { asrBackendBrowser: 'browser', asrBackendAzure: 'azure', asrBackendOpenai: 'openai', asrBackendAliyun: 'aliyun', asrBackendLocal: 'local' };
  document.querySelectorAll('#panel-asr .ai-backend').forEach(btn => {
    btn.classList.toggle('active', map[btn.id] === currentAsrBackend);
  });
  // browser 后端提示行：显示可达性/Edge 建议；其它后端隐藏
  if (currentAsrBackend === 'browser') {
    syncBrowserAsrHint().catch(() => {});
  } else {
    ['asrBrowserHint', 'asrBrowserHintBlue'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.add('hidden');
    });
  }
  if (!asrRecording) {
    const cfg = currentVoiceConfig;
    const missing = (currentAsrBackend === 'azure' && (!cfg.voiceAzureKey || !cfg.voiceAzureRegion)) ||
                    (currentAsrBackend === 'openai' && !getOpenaiAsrKey()) ||
                    (currentAsrBackend === 'aliyun' && !cfg.voiceAliyunKey);
    setAsrStatus(missing ? I18N.t('asrNoConfig') : I18N.t('asrStatusIdle'), missing);
  }
}

function setAsrStatus(msg, isError) {
  const el = document.getElementById('asrStatus');
  if (!el) return;
  el.textContent = msg;
  el.classList.toggle('error', !!isError);
}

// ---- 后端：浏览器内置识别（Web Speech API） ----
// Chrome 实现把音频送 Google 云（中国大陆网络不可达 → network 错误）；
// Edge 实现走微软 Azure（国内外可用）。同一套 API，按浏览器区分提示。
function browserAsrSupported() {
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}
function isEdgeBrowser() {
  return /Edg\//.test(navigator.userAgent || '');
}

// Google 语音服务可达性探测（Chrome 的识别服务走 Google 基础设施；Edge 走微软云，无需探测）。
// 必须探 www.google.com：gstatic 在国内部分可达会误报"可达"，而识别服务实际不可达。
// 结果分级缓存：可达 10 分钟；不可达只缓存 1 分钟（用户挂上代理后能尽快恢复）。
let _browserAsrProbe = { t: 0, ok: false };
async function probeBrowserAsrNetwork(timeoutMs = 3000) {
  const CACHE_MS = 10 * 60 * 1000;
  if (Date.now() - _browserAsrProbe.t < CACHE_MS) return _browserAsrProbe.ok;
  let ok = false;
  try {
    await fetch('https://www.google.com/generate_204', {
      mode: 'no-cors',
      cache: 'no-store',
      signal: AbortSignal.timeout(timeoutMs)
    });
    ok = true;
  } catch (e) { ok = false; }
  _browserAsrProbe = { t: ok ? Date.now() : Date.now() - 9 * 60 * 1000, ok };
  return ok;
}

// browser 后端可用性评估：{ level: 'ok'|'block'|'unsupported', msg }
// block = 检测到必然失败（非 Edge + Google 不可达）→ 直接拦下，不让用户白试受挫
async function browserAsrHint() {
  if (!browserAsrSupported()) {
    return { level: 'unsupported', msg: I18N.t('asrBrowserUnsupported') };
  }
  if (isEdgeBrowser()) {
    // Edge 走微软语音服务，国内外均可用，不做 Google 探测
    return { level: 'ok', msg: I18N.t('asrBrowserHintEdge') };
  }
  const reachable = await probeBrowserAsrNetwork();
  if (!reachable) {
    return { level: 'block', msg: I18N.t('asrBrowserChinaWarn') };
  }
  return { level: 'ok', msg: I18N.t('asrBrowserHintOk') };
}

// 刷新设置页/转写面板里的 browser 提示行（异步，不阻塞 UI）
async function syncBrowserAsrHint() {
  if (currentAsrBackend !== 'browser') return;
  const hint = await browserAsrHint();
  for (const id of ['asrBrowserHint', 'asrBrowserHintBlue']) {
    const el = document.getElementById(id);
    if (!el) continue;
    el.textContent = hint.msg;
    el.classList.remove('hidden');
    el.classList.toggle('error', hint.level !== 'ok');
  }
}

// 启动一次 browser 识别会话（自有麦克风会话，与 MediaRecorder 路径互斥）。
// opts: { onInterim(text), onStatus(msg) }；resolve({ text }) 或 reject(Error)。
// 兜底：Edge 已知会偶发丢 onend 事件 → 最长 60s 强制结束；onresult 最终结果与 onend 谁先到都收敛。
function startBrowserAsr(opts = {}) {
  return new Promise((resolve, reject) => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return reject(new Error(I18N.t('asrBrowserUnsupported')));
    const rec = new SR();
    const lang = String(document.documentElement.lang).startsWith('zh') ? 'zh-CN' : 'en-US';
    rec.lang = lang;
    rec.continuous = false;      // 说完停顿自动出最终结果（适合语音输入）
    rec.interimResults = true;   // 边说边出字
    rec.maxAlternatives = 1;

    let finalText = '';
    let interimText = '';
    let gotResult = false;
    let settled = false;
    const finish = (fn, val) => {
      if (settled) return;
      settled = true;
      clearTimeout(maxTimer);
      clearTimeout(watchdog);
      browserAsrStopFn = null;
      try { rec.onresult = rec.onerror = rec.onend = rec.onstart = null; } catch (e) {}
      try { if (rec.state !== 'inactive') rec.stop(); } catch (e) {}
      fn(val);
    };
    const maxTimer = setTimeout(() => finish(resolve, { text: (finalText || interimText).trim() }), 60000);
    // 看门狗：15s 内没有任何识别结果（含中间结果）→ 多半是语音服务连接被静默挂起
    //（GFW 丢包时 Chrome 不触发 network 错误而是无限等待）→ 主动终止并给出可行动的提示
    const watchdog = setTimeout(() => {
      if (!gotResult) finish(reject, new Error(I18N.t('asrBrowserStuck')));
    }, 15000);

    rec.onstart = () => { if (opts.onStatus) opts.onStatus(I18N.t('asrBrowserListening')); };
    rec.onresult = (ev) => {
      gotResult = true;
      interimText = '';
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const r = ev.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interimText += r[0].transcript;
      }
      if (opts.onInterim) opts.onInterim((finalText + interimText).trim());
      if (finalText.trim()) finish(resolve, { text: finalText.trim() });
    };
    rec.onerror = (ev) => {
      const code = ev && ev.error;
      if (code === 'aborted' && (finalText || interimText)) return finish(resolve, { text: (finalText || interimText).trim() });
      const map = {
        'not-allowed': I18N.t('asrMicPermNeeded'),
        'service-not-allowed': I18N.t('asrMicPermNeeded'),
        'network': isEdgeBrowser() ? I18N.t('asrBrowserNetErr') : I18N.t('asrBrowserNetErrChrome'),
        'no-speech': I18N.t('asrNoAudioError'),
        'audio-capture': I18N.t('asrMicrophoneDenied'),
        'language-not-supported': I18N.t('asrBrowserUnsupported')
      };
      finish(reject, new Error(map[code] || (I18N.t('asrError', code || 'unknown'))));
    };
    // 正常结束（无最终结果也收敛，避免 Edge 丢 onend 时挂死——有 maxTimer 兜底）
    rec.onend = () => {
      if (finalText.trim() || interimText.trim()) finish(resolve, { text: (finalText || interimText).trim() });
      else finish(reject, new Error(I18N.t('asrNoAudioError')));
    };
    try {
      rec.start();
      browserAsrStopFn = () => { try { if (rec.state !== 'inactive') rec.stop(); } catch (e) {} };
    } catch (e) { finish(reject, e); }
  });
}

// 停止进行中的 browser 识别（两个面板共用一个会话槽：同屏只会有一路）
let browserAsrStopFn = null;
function stopBrowserAsr() {
  if (browserAsrStopFn) { const fn = browserAsrStopFn; browserAsrStopFn = null; fn(); }
}

// ---- 录音（四后端共用）：getUserMedia → MediaRecorder → decode → 16kHz 单声道 Float32 ----
let asrRecorder = null;
let asrStream = null;
let asrChunks = [];
let asrRecording = false;

async function toggleAsrRecord() {
  if (asrRecording) { stopAsrRecording(); return; }
  if (currentAsrBackend === 'browser') { await toggleBrowserAsrRecord(); return; }
  setAsrStatus('🎙 ' + I18N.t('asrStarting'));
  try {
    // ⚠️ 关闭音频处理（echoCancellation/noiseSuppression/autoGainControl）：
    // Chrome 默认处理会把部分 USB 麦（如 Insta360）压成静音（RMS=0），识别需要原始信号。
    // 并支持指定麦克风设备（多麦时避免选错）。
    const audioConstraints = { echoCancellation: false, noiseSuppression: false, autoGainControl: false };
    if (currentVoiceConfig.asrMicDeviceId) audioConstraints.deviceId = { exact: currentVoiceConfig.asrMicDeviceId };
    const stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
    asrStream = stream;
    asrChunks = [];
    let mime = '';
    if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) mime = 'audio/webm;codecs=opus';
    else if (MediaRecorder.isTypeSupported('audio/webm')) mime = 'audio/webm';
    asrRecorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    asrRecorder.ondataavailable = (e) => { if (e.data && e.data.size) asrChunks.push(e.data); };
    asrRecorder.onstop = onAsrRecordingDone;
    asrRecorder.start();
    asrRecording = true;
    updateAsrRecordUi();
    // 录音启动延迟（getUserMedia/编码器预热）会导致开头截断：
    // 先显示「准备…」，约 0.6s 后录音确已开始，再提示说话
    setAsrStatus('🎙 ' + I18N.t('asrPreparing'));
    setTimeout(() => { if (asrRecording) setAsrStatus(I18N.t('asrRecording')); }, 600);
  } catch (e) {
    // MV3 侧边栏无法弹授权弹窗：NotAllowedError 时引导去可见授权页授权一次
    const name = e && (e.name || e.message);
    if (name && /NotAllowed|PermissionDismissed|SecurityError/.test(name)) {
      setAsrStatus(I18N.t('asrMicPermNeeded'), true);
    } else {
      setAsrStatus(I18N.t('asrMicrophoneDenied'), true);
    }
  }
}

// 转写面板 browser 后端：Web Speech API 自管麦克风，边说边出字，说完自动出最终结果
async function toggleBrowserAsrRecord() {
  // 单一音频通道：若圆球正在 MediaRecorder 录音，先停掉
  if (vbRecording) stopVoiceCircleRecording();
  const hint = await browserAsrHint();
  if (hint.level === 'unsupported' || hint.level === 'block') {
    // 直接拦下：检测到必然失败（Chrome + Google 不可达），不让用户白试受挫
    setAsrStatus(hint.msg, true);
    return;
  }
  asrRecording = true;
  updateAsrRecordUi();
  setAsrStatus('🎙 ' + I18N.t('asrBrowserStarting'));
  try {
    const out = await startBrowserAsr({
      onInterim: (t) => setAsrStatus('🎙 ' + (t || I18N.t('asrBrowserListening'))),
      onStatus: (m) => setAsrStatus('🎙 ' + m)
    });
    const outEl = document.getElementById('asrResult');
    if (outEl) outEl.value = out.text || '';
    setAsrStatus(out.text ? '✅ ' + I18N.t('asrTestOk') : I18N.t('asrNoAudioError'), !out.text);
  } catch (e) {
    setAsrStatus(I18N.t('asrError', (e && e.message) || I18N.t('asrNoAudioError')), true);
  } finally {
    asrRecording = false;
    updateAsrRecordUi();
  }
}

// 打开麦克风授权页（新标签页可见扩展页，弹出授权弹窗）
async function openMicPermissionPage() {
  await sendMessage('openMicPermission');
  setAsrStatus(I18N.t('asrMicPermHint'));
}

// 枚举麦克风设备，填充设备选择下拉；授权后可取到设备名
async function loadAsrDevices() {
  const sel = document.getElementById('asrMicDevice');
  if (!sel) return;
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const mics = devices.filter(d => d.kind === 'audioinput');
    const cur = currentVoiceConfig.asrMicDeviceId;
    sel.innerHTML = '';
    if (!mics.length) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = '默认麦克风';
      sel.appendChild(opt);
    } else {
      mics.forEach((d, i) => {
        const opt = document.createElement('option');
        opt.value = d.deviceId;
        opt.textContent = d.label || ('麦克风 ' + (i + 1));
        sel.appendChild(opt);
      });
      if (mics.some(d => d.deviceId === cur)) sel.value = cur;
    }
  } catch (e) { /* 未授权时 deviceId 为空，保留默认 */ }
}

function stopAsrRecording() {
  if (currentAsrBackend === 'browser') { stopBrowserAsr(); return; }
  if (asrRecorder && asrRecorder.state !== 'inactive') asrRecorder.stop();
}

function updateAsrRecordUi() {
  const btn = document.getElementById('asrRecord');
  if (!btn) return;
  btn.textContent = asrRecording ? I18N.t('asrRecordStop') : I18N.t('asrRecordStart');
  btn.classList.toggle('recording', asrRecording);
  if (asrRecording) setAsrStatus(I18N.t('asrRecording'));
}

async function onAsrRecordingDone() {
  const recorder = asrRecorder;
  asrRecorder = null;
  asrRecording = false;
  updateAsrRecordUi();
  if (asrStream) { asrStream.getTracks().forEach(t => t.stop()); asrStream = null; }
  const type = (recorder && recorder.mimeType) || 'audio/webm';
  const blob = new Blob(asrChunks, { type });
  asrChunks = [];
  try {
    const buf = await blob.arrayBuffer();
    const pcm16 = await decodeAndResample(buf, 16000);
    if (pcm16.length < 4800) { setAsrStatus(I18N.t('asrAudioTooShort'), true); return; } // < 0.3s
    // 自动增益：弱麦克风（如部分 USB 麦）采集音量偏低时放大到合理范围
    let peak = 0;
    for (let i = 0; i < pcm16.length; i++) peak = Math.max(peak, Math.abs(pcm16[i]));
    if (peak > 0.01 && peak < 0.5) {
      const gain = 0.8 / peak;
      for (let i = 0; i < pcm16.length; i++) pcm16[i] = Math.max(-1, Math.min(1, pcm16[i] * gain));
    }
    // 静音检测：RMS 过低说明麦克风没真正录到声音（识别模型会因此幻觉）
    let sum = 0;
    for (let i = 0; i < pcm16.length; i++) sum += pcm16[i] * pcm16[i];
    const rms = Math.sqrt(sum / pcm16.length);
    if (rms < 0.01) {
      setAsrStatus(I18N.t('asrSilent', rms.toFixed(4)), true);
      return;
    }
    setAsrStatus('⏳ ' + I18N.t('asrTesting'));
    const text = await runAsr(pcm16);
    const out = document.getElementById('asrResult');
    if (out) out.value = text || '';
    setAsrStatus(text ? '✅ ' + I18N.t('asrTestOk') : I18N.t('asrNoAudioError'));
  } catch (e) {
    setAsrStatus(I18N.t('asrError', (e && e.message) || I18N.t('asrNoAudioError')), true);
  }
}

// ========== 顶部圆形语音工作台：一键「识别 → LLM → 输出并朗读」 ==========
let vbRecorder = null, vbChunks = [], vbStream = null, vbRecording = false;
let vbSuppress = false; // 被对话录音接管时抑制本段处理
let vcPipelineRunning = false; // 问答管线进行中（LLM/站点注入等待）→ 再次点击圆球 = 请求停止
let voiceCircleMode = 'manual'; // manual（点击停止）/ vad（说话自动停）
let vadTimer = null, vadSource = null, vadAnalyser = null, vadHadSpeech = false;
let _voiceRoundSeq = 0; // 每轮语音对话序号（调试日志）

// 运行日志：同时输出到控制台与红区底部日志区（默认展开）
const DEBUG_LOG_MAX = 200;
function logDebug(scope, msg, isErr) {
  const t = new Date().toLocaleTimeString();
  console.log(`[${scope}]`, msg);
  const body = document.getElementById('debugLogBody');
  if (!body) return;
  const empty = body.querySelector('.debug-log-empty');
  if (empty) empty.remove();
  const line = document.createElement('div');
  line.className = 'debug-log-line' + (isErr ? ' dl-err' : '');
  line.innerHTML = '<span class="dl-time">' + t + '</span><span class="dl-scope">[' + escapeHtml(scope) + ']</span> ' + escapeHtml(msg);
  body.appendChild(line);
  while (body.children.length > DEBUG_LOG_MAX) body.removeChild(body.firstChild);
  body.scrollTop = body.scrollHeight;
}
function debugLogClear() {
  const body = document.getElementById('debugLogBody');
  if (body) body.innerHTML = '<div class="debug-log-empty">—</div>';
}

// 语音状态行：非错误提示显示数秒后自动隐藏（避免 UI 一直堆着一行字）
let vcStatusHideTimer = null;
function setVoiceCircleStatus(msg, isError) {
  const el = document.getElementById('voiceCircleStatus');
  if (!el) return;
  if (msg) { el.textContent = msg; el.classList.remove('hidden'); }
  el.classList.toggle('error', !!isError);
  clearTimeout(vcStatusHideTimer);
  if (msg && !isError) {
    vcStatusHideTimer = setTimeout(() => { el.classList.add('hidden'); }, 5000);
  }
}

// 预热 AudioContext：在用户点击手势内创建并 resume，避免首次朗读因自动播放策略静默（"没有朗读"）
function warmAudioContext() {
  try {
    if (!localTtsCtx) localTtsCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (localTtsCtx.state === 'suspended') localTtsCtx.resume().catch(() => {});
  } catch (e) {}
}

// 圆形模式切换：manual（点击一直录，再点停止）/ vad（说话自动停）
function setVoiceCircleMode(mode) {
  voiceCircleMode = (mode === 'vad') ? 'vad' : 'manual';
  chrome.storage.local.set({ voiceCircleMode }).catch(() => {});
  document.querySelectorAll('#voiceCircleMode .vc-mode').forEach(b => {
    b.classList.toggle('active', b.dataset.vcmode === voiceCircleMode);
  });
}

async function loadVoiceCircleMode() {
  try {
    const r = await chrome.storage.local.get('voiceCircleMode');
    if (r.voiceCircleMode === 'vad' || r.voiceCircleMode === 'manual') {
      voiceCircleMode = r.voiceCircleMode;
      document.querySelectorAll('#voiceCircleMode .vc-mode').forEach(b => {
        b.classList.toggle('active', b.dataset.vcmode === voiceCircleMode);
      });
    }
  } catch (e) {}
}

// ===== 主对话面板（chatMain 扶正）：语音/文本模式 + i 设置 =====
// chatMode：'voice'（默认，圆球）| 'text'（输入框）
// chatVoiceBehavior：'direct'（识别后直接问答+朗读）| 'compose'（识别后填入文本可编辑再发）
// chatInputExpanded：S 模式下文本输入框的展开状态（默认收起）
let chatMode = 'voice';
let chatVoiceBehavior = 'direct';
let chatInputExpanded = false;

function updateChatBodies() {
  const voiceBody = document.getElementById('chatVoiceBody');
  const textBody = document.getElementById('chatTextBody');
  const showText = (chatMode === 'text') || chatInputExpanded;
  if (voiceBody) voiceBody.classList.toggle('hidden', chatMode !== 'voice');
  if (textBody) textBody.classList.toggle('hidden', !showText);
  const toggle = document.getElementById('chatInputToggle');
  if (toggle) toggle.classList.toggle('on', chatInputExpanded);
  // 「语音填入」只在文本模式有意义（S 模式已有圆球）；附件两种模式都保留
  const voiceFill = document.getElementById('injectVoice');
  if (voiceFill) voiceFill.classList.toggle('hidden', chatMode === 'voice');
}

function setChatMode(mode) {
  chatMode = (mode === 'text') ? 'text' : 'voice';
  chrome.storage.local.set({ chatMode }).catch(() => {});
  const btn = document.getElementById('chatModeSwitch');
  if (btn) {
    // 按钮显示「切换目标」：语音态显示 T（去文本），文本态显示 S（去语音）
    btn.textContent = chatMode === 'voice' ? 'T' : 'S';
    const key = chatMode === 'voice' ? 'chatModeToText' : 'chatModeToVoice';
    btn.setAttribute('data-i18n-title', key);
    btn.title = I18N.t(key);
  }
  updateChatBodies();
  // 当前对话：T 默认展开、S 默认折叠（无记录时整体隐藏）
  voiceOutputCollapsed = (chatMode === 'voice');
  renderVoiceOutputState();
}
async function loadChatMode() {
  try {
    const r = await chrome.storage.local.get('chatMode');
    setChatMode(r.chatMode === 'text' ? 'text' : 'voice');
  } catch (e) { setChatMode('voice'); }
}
// S 模式下展开/收起文本输入框
function toggleChatInput() {
  chatInputExpanded = !chatInputExpanded;
  updateChatBodies();
}

// i 设置区：默认收起；点击展开/收起
function toggleChatSettings() {
  const el = document.getElementById('chatSettings');
  const btn = document.getElementById('chatSettingsToggle');
  if (!el) return;
  const show = el.classList.toggle('hidden') === false;
  if (btn) btn.classList.toggle('active', show);
}
async function loadChatSettings() {
  const el = document.getElementById('chatSettings');
  if (el) el.classList.add('hidden');
  const btn = document.getElementById('chatSettingsToggle');
  if (btn) btn.classList.remove('active');
  try {
    const r = await chrome.storage.local.get('chatVoiceBehavior');
    chatVoiceBehavior = (r.chatVoiceBehavior === 'compose') ? 'compose' : 'direct';
  } catch (e) { chatVoiceBehavior = 'direct'; }
  document.querySelectorAll('input[name="chatVoiceBehavior"]').forEach(radio => {
    radio.checked = radio.value === chatVoiceBehavior;
  });
}

// 语音识别完成后的分流：compose → 填入文本框并切到文本模式；direct → 直接问答+朗读
async function handleVoiceRecognized(text) {
  if (!text) return;
  if (chatVoiceBehavior === 'compose') {
    const input = document.getElementById('injectInput');
    if (input) input.value = text;
    setChatMode('text');
    setVoiceCircleStatus('✅ ' + I18N.t('chatVoiceFilled'));
    try { input.focus(); } catch (e) {}
    return;
  }
  renderVoiceOutput(text, null);
  await runVoiceCirclePipeline(text);
}

// ===== 选区操作条（仅当前页有选中文本时出现）：朗读 / AI处理 / 加入上下文 =====
let hasPageSelection = false;
function setPageSelectionState(has) {
  hasPageSelection = !!has;
  const bar = document.getElementById('selectionBar');
  if (bar) bar.classList.toggle('hidden', !hasPageSelection);
  if (!hasPageSelection) {
    const menu = document.getElementById('selAiMenu');
    if (menu) menu.classList.add('hidden');
    const aiBtn = document.getElementById('selAiBtn');
    if (aiBtn) aiBtn.classList.remove('active');
  }
}
async function refreshPageSelection() {
  try {
    const t = await TABU_CAPS.getSelectedText();
    setPageSelectionState(!!(t && t.trim()));
  } catch (e) {}
}
function toggleSelAiMenu() {
  const menu = document.getElementById('selAiMenu');
  const btn = document.getElementById('selAiBtn');
  if (!menu) return;
  const show = menu.classList.toggle('hidden') === false;
  if (btn) btn.classList.toggle('active', show);
}
// 朗读选中文本（等价「朗读页面 → 朗读选中」）
async function selReadText() {
  const text = await TABU_CAPS.getSelectedText().catch(() => '');
  if (!text || !text.trim()) { showStatus(I18N.t('noSelectionAny'), 'info'); return; }
  doSpeak(text, document.getElementById('injectStatus'), document.getElementById('selRead'));
}
// 把选中文本加入对话上下文（替代原素材行「选中文本」按钮）
async function selAddToContext() {
  const text = await TABU_CAPS.getSelectedText().catch(() => '');
  if (!text || !text.trim()) { showStatus(I18N.t('noSelectionAny'), 'info'); return; }
  if (injectAddMaterial({ type: 'selection', text })) showStatus(I18N.t('captureSelDone'), 'success');
}
// AI处理：对选中文本做 翻译/总结/润色/解释（走当前 LLM 渠道；不带页面全文上下文）
// 选区翻译：走免费翻译（MyMemory，capabilities.translateText）
async function selRunProcessor(type) {
  const text = await TABU_CAPS.getSelectedText().catch(() => '');
  if (!text || !text.trim()) { showStatus(I18N.t('noSelectionAny'), 'info'); return; }
  const body = text.trim();
  if (type === 'translate') { await freeTranslate(body); return; }
  const proc = TABU_CAPS.PROCESSORS[type];
  if (!proc) return;
  await injectRun(proc.apply(body), [], { skipPageContext: true });
}

// 目标/源语言代码（供免费翻译）
function transSrcCode() {
  const v = document.getElementById('selSrcLang')?.value;
  return (!v || v === 'auto') ? 'en' : v;
}
function transTgtCode() {
  return document.getElementById('selTgtLang')?.value || 'zh-CN';
}

// 免费翻译（MyMemory）：结果进对话流；供 选区AI处理 / 主界面 共用
async function freeTranslate(text) {
  if (!text || !text.trim()) { showStatus(I18N.t('enterTextFirst'), 'info'); return; }
  setChatMode('text');
  renderVoiceOutput(text.trim(), null, null, I18N.t('aiTplTranslate'));
  try {
    const out = await TABU_CAPS.translateText(text.trim(), { source: transSrcCode(), target: transTgtCode() });
    renderVoiceOutput(null, out || '');
  } catch (e) {
    showStatus(I18N.t('translateFail') + ((e && e.message) || ''), 'error');
  }
}
// 主界面：免费翻译输入框内容
async function translateInputFree() {
  const text = injectGetInput();
  if (!text) { showStatus(I18N.t('enterTextFirst'), 'info'); return; }
  await freeTranslate(text);
}

// VAD 监控：检测到有说话后，静音持续超过阈值 → 自动结束录音；超长 30s 强制结束兜底
function startVad(stream) {
  try {
    const ctx = localTtsCtx || new (window.AudioContext || window.webkitAudioContext)();
    vadSource = ctx.createMediaStreamSource(stream);
    vadAnalyser = ctx.createAnalyser();
    vadAnalyser.fftSize = 512;
    vadSource.connect(vadAnalyser);
    const data = new Uint8Array(vadAnalyser.fftSize);
    vadHadSpeech = false;
    const CHECK_MS = 100, SILENCE_MS = 1500, MAX_MS = 30000;
    let silentMs = 0, totalMs = 0;
    vadTimer = setInterval(() => {
      totalMs += CHECK_MS;
      vadAnalyser.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        const v = (data[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / data.length);
      if (rms > 0.02) { vadHadSpeech = true; silentMs = 0; }
      else if (vadHadSpeech) {
        silentMs += CHECK_MS;
        if (silentMs >= SILENCE_MS) stopVoiceCircleRecording();
      }
      if (totalMs >= MAX_MS) stopVoiceCircleRecording();
    }, CHECK_MS);
  } catch (e) { /* VAD 启动失败 → 退回手动点击停止 */ }
}

function stopVad() {
  if (vadTimer) { clearInterval(vadTimer); vadTimer = null; }
  if (vadSource) { try { vadSource.disconnect(); } catch (e) {} vadSource = null; }
  vadAnalyser = null;
  vadHadSpeech = false;
}

// 结束录音（手动点击停止 或 VAD 自动触发）
function stopVoiceCircleRecording() {
  stopVad();
  if (currentAsrBackend === 'browser') { stopBrowserAsr(); return; }
  if (vbRecorder && vbRecorder.state !== 'inactive') vbRecorder.stop();
}

// 点击圆形：开始/结束录音；停止后自动「识别 → 渠道LLM → 输出栏 + 朗读」
async function toggleVoiceCircle() {
  if (vcPipelineRunning) {
    // 问答管线进行中（等待 LLM/站点注入）：再次点击 = 请求停止，后台会在下个检查点退出并释放注入锁
    if (isSpeakingActive()) stopSpeaking(); // 同时中断朗读并清空流式朗读队列
    sendMessage('cancelInject').catch(() => {});
    setVoiceCircleStatus(I18N.t('vcStopRequested'));
    return;
  }
  if (vbRecording) { stopVoiceCircleRecording(); return; }
  if (currentAsrBackend === 'browser') { await toggleVoiceCircleBrowser(); return; }
  // 单一音频通道：先停掉其它录音
  warmAudioContext();
  setVoiceCircleStatus('🎙 ' + I18N.t('asrStarting'));
  try {
    const audioConstraints = { echoCancellation: false, noiseSuppression: false, autoGainControl: false };
    if (currentVoiceConfig.asrMicDeviceId) audioConstraints.deviceId = { exact: currentVoiceConfig.asrMicDeviceId };
    const stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
    vbStream = stream;
    vbChunks = [];
    let mime = '';
    if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) mime = 'audio/webm;codecs=opus';
    else if (MediaRecorder.isTypeSupported('audio/webm')) mime = 'audio/webm';
    vbRecorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    vbRecorder.ondataavailable = (e) => { if (e.data && e.data.size) vbChunks.push(e.data); };
    vbRecorder.onstop = onVoiceCircleDone;
    vbRecorder.start();
    vbRecording = true;
    const btn = document.getElementById('voiceCircleBtn');
    if (btn) btn.classList.add('recording');
    if (voiceCircleMode === 'vad') {
      startVad(stream);
      setVoiceCircleStatus('🎙 ' + I18N.t('voiceVadRecording'));
    } else {
      setVoiceCircleStatus('🎙 ' + I18N.t('voiceCircleRecording'));
    }
  } catch (e) {
    const name = e && (e.name || e.message);
    if (name && /NotAllowed|PermissionDismissed|SecurityError/.test(name)) {
      setVoiceCircleStatus(I18N.t('asrMicPermNeeded'), true);
      sendMessage('openMicPermission').catch(() => {});
    } else {
      setVoiceCircleStatus(I18N.t('asrMicrophoneDenied'), true);
    }
  }
}

async function onVoiceCircleDone() {
  stopVad();
  const recorder = vbRecorder;
  vbRecorder = null;
  vbRecording = false;
  const circleBtn = document.getElementById('voiceCircleBtn');
  if (circleBtn) circleBtn.classList.remove('recording');
  if (vbStream) { vbStream.getTracks().forEach(t => t.stop()); vbStream = null; }
  const type = (recorder && recorder.mimeType) || 'audio/webm';
  const blob = new Blob(vbChunks, { type });
  vbChunks = [];
  if (vbSuppress) { vbSuppress = false; return; } // 被对话录音接管，丢弃本段
  try {
    const buf = await blob.arrayBuffer();
    const pcm16 = await decodeAndResample(buf, 16000);
    if (pcm16.length < 4800) { setVoiceCircleStatus(I18N.t('asrAudioTooShort'), true); return; }
    // 自动增益 + 静音诊断（与对话/转写面板同策略）
    let peak = 0;
    for (let i = 0; i < pcm16.length; i++) peak = Math.max(peak, Math.abs(pcm16[i]));
    if (peak > 0.01 && peak < 0.5) {
      const gain = 0.8 / peak;
      for (let i = 0; i < pcm16.length; i++) pcm16[i] = Math.max(-1, Math.min(1, pcm16[i] * gain));
    }
    let sum = 0;
    for (let i = 0; i < pcm16.length; i++) sum += pcm16[i] * pcm16[i];
    const rms = Math.sqrt(sum / pcm16.length);
    if (rms < 0.01) { setVoiceCircleStatus(I18N.t('asrSilent', rms.toFixed(4)), true); return; }

    setVoiceCircleStatus('⏳ ' + I18N.t('voiceCircleRecognizing'));
    const text = await runAsr(pcm16); // 跟随当前识别后端（browser 后端不经过本路径）
    if (!text) { setVoiceCircleStatus(I18N.t('asrNoAudioError'), true); return; }
    await handleVoiceRecognized(text);
  } catch (e) {
    logDebug('voice', '失败: ' + ((e && e.message) || ''), true);
    setVoiceCircleStatus(I18N.t('chatError') + ((e && e.message) || I18N.t('asrNoAudioError')), true);
  }
}

// 识别文本 → 公共管线：渠道 LLM 问答 → 输出并朗读（与识别后端无关；browser 后端也走这里）
// 素材胶囊（选中文本/全文）会并入本轮问题 —— 语音 + 素材组合发送（005 P0.5）
async function runVoiceCirclePipeline(text) {
  vcPipelineRunning = true;
  try {
    const parts = composeWithMaterials(text); // 素材胶囊并入问题（图片仅浏览器版渠道支持）
    const question = parts.text;
    if (question !== text || parts.images.length) injectClearMaterials();
    const questionCtx = await appendPageContext(question); // 「关联页面」自动并入当前页正文
    const round = ++_voiceRoundSeq;
    const tRound = performance.now();
    let vcAnsEl = null;
    logDebug('voice#' + round, '新一轮语音对话开始 → ' + String(question).slice(0, 40));
    try {
      // ② LLM 按渠道问答（本地 /chat · api 流式 · 浏览器注入）——三渠道均边出边显示（008 §2）
      setVoiceCircleStatus('💭 ' + I18N.t('voiceCircleThinking'));
      const mode = await getEffectiveAiMode();
      const tLlm0 = performance.now();
      const showThink = await aiShowThinkingEnabled();
      const autoOn = await aiSpeakAnswerEnabled();
      const streamOn = autoOn && isStreamSpeakEnabled();
      const ansEl = appendStreamBubble('voice-bot');
      vcAnsEl = ansEl;
      const spToken = streamOn ? streamSpeakStart(ansEl && ansEl.querySelector('.msg-speak')) : 0;
      const setAns = (t) => { const s = ansEl && ansEl.querySelector('.stream-text'); if (s) s.textContent = t; };
      let streamAcc = '';
      let reasoningAcc = '';
      const llmOut = await voiceChatAskText(questionCtx, mode, {
        images: parts.images,
        onDelta: (t) => { streamAcc += t; setAns(streamAcc); if (streamOn) streamSpeakFeed(spToken, t); },
        onReasoning: (t) => {
          reasoningAcc += t;
          setVoiceCircleStatus('💭 ' + t.slice(-80)); // 思考增量实时显示在状态行（灰色块最终进输出栏）
        }
      });
      const answer = (llmOut && llmOut.answer) || streamAcc;
      const pageThinking = (llmOut && llmOut.thinking) || '';
      const thinkingAll = reasoningAcc.trim() || pageThinking; // API 思考回调 / 站点提取的思考块
      const tLlm = performance.now() - tLlm0;
      if (answer) {
        finalizeStreamBubble(ansEl, answer);
        if (showThink && thinkingAll) {
          const thinkHtml = '<div class="voice-msg voice-think"><b>' + escapeHtml(I18N.t('chatThinking')) + '</b>' + escapeHtml(thinkingAll) + '</div>';
          if (ansEl && ansEl.parentNode) ansEl.insertAdjacentHTML('beforebegin', thinkHtml);
          else renderVoiceOutput(null, null, thinkingAll);
        }
      } else if (ansEl) {
        ansEl.remove();
      }
      logDebug('voice#' + round, 'LLM ' + tLlm.toFixed(0) + 'ms（渠道 ' + mode + '）→ ' + (answer ? String(answer).slice(0, 80) : '(无/在站点)'));

    // ③ 朗读（文本输出 → 发起朗读的间隔；首帧延迟见 [tts] 日志）
    // 思考内容默认不朗读；设置「朗读包含思考内容」开启时先读思考再读正文。
    // inject 渠道的回答现在也会回传 → 有答案就朗读；无答案才落到底部提示
    if (answer) {
      const reasoning = thinkingAll;
      const spoken = (currentVoiceConfig.ttsReadThinking && reasoning) ? reasoning + '\n\n' + answer : answer;
      const tSpk0 = performance.now();
      // 工作台自动朗读：默认跟随朗读引擎（voiceCircleForceSystem=true 时固定系统 TTS 即时）
      // 流式朗读开启时：分句队列已随流式喂入，这里只收尾；否则整段朗读（autoSpeakAnswer 去重）
      if (streamOn) streamSpeakEnd(spToken);
      else autoSpeakAnswer(spoken, document.getElementById('voiceCircleStatus'), !!(currentVoiceConfig && currentVoiceConfig.voiceCircleForceSystem), undefined, lastBotSpeakBtn());
      logDebug('voice#' + round, '输出→朗读发起 ' + (performance.now() - tSpk0).toFixed(0) + 'ms');
      logDebug('voice#' + round, '语音闭环总 ' + (performance.now() - tRound).toFixed(0) + 'ms（到发起朗读）');
    } else {
      if (streamOn) streamSpeakStop();
      setVoiceCircleStatus('✅ ' + (mode === 'inject' ? I18N.t('voiceSentToSite') : I18N.t('voiceCircleDone')));
      logDebug('voice#' + round, '结束（' + (mode === 'inject' ? '已发送到站点，站点未返回文本' : '无回答') + '）· 总 ' + (performance.now() - tRound).toFixed(0) + 'ms');
    }
    } catch (e) {
      streamSpeakStop();
      // 出错时若气泡还是空的（未收到任何增量），移除占位
      if (vcAnsEl) {
        const st = vcAnsEl.querySelector('.stream-text');
        if (!st || !String(st.textContent || '').trim()) vcAnsEl.remove();
      }
      logDebug('voice', '失败: ' + ((e && e.message) || ''), true);
      setVoiceCircleStatus(I18N.t('chatError') + ((e && e.message) || I18N.t('asrNoAudioError')), true);
    }
  } finally {
    vcPipelineRunning = false; // 管线退出（含被取消）后恢复圆球可点击
  }
}

// 圆球 browser 后端：Web Speech API 直出文本 → 公共管线。
// 与 MediaRecorder 路径的差异：识别自管麦克风、说完自动断句出结果，VAD 不适用（60s 强制兜底）。
async function toggleVoiceCircleBrowser() {
  const hint = await browserAsrHint();
  if (hint.level === 'unsupported' || hint.level === 'block') {
    // 直接拦下：检测到必然失败，不让用户白试受挫
    setVoiceCircleStatus(hint.msg, true);
    return;
  }
  vbRecording = true;
  const btn = document.getElementById('voiceCircleBtn');
  if (btn) btn.classList.add('recording');
  setVoiceCircleStatus('🎙 ' + I18N.t('asrBrowserStarting'));
  try {
    const out = await startBrowserAsr({
      onInterim: (t) => {
        setVoiceCircleStatus('🎙 ' + (t || I18N.t('asrBrowserListening')));
        // S 模式文本输入折叠时，也把实时识别写进输入框（展开即可见/可改）
        const input = document.getElementById('injectInput');
        if (input) input.value = t || '';
      },
      onStatus: (m) => setVoiceCircleStatus('🎙 ' + m)
    });
    if (vbSuppress) { vbSuppress = false; return; } // 被对话录音接管，丢弃本段
    if (!out.text) { setVoiceCircleStatus(I18N.t('asrNoAudioError'), true); return; }
    await handleVoiceRecognized(out.text);
  } catch (e) {
    logDebug('voice', 'browser 识别失败: ' + ((e && e.message) || ''), true);
    setVoiceCircleStatus(I18N.t('chatError') + ((e && e.message) || I18N.t('asrNoAudioError')), true);
  } finally {
    vbRecording = false;
    if (btn) btn.classList.remove('recording');
  }
}

// 按渠道文本问答：api → askApiStream；inject → 页面注入；local → /chat
// opts.onReasoning(t)：思考增量回调（供 UI 灰色展示；朗读默认不含思考内容）
// opts.onDelta(t)：回答增量回调（008 §2：三渠道均支持边出边显示）
async function voiceChatAskText(text, mode, opts = {}) {
  const onDelta = opts.onDelta || (() => {});
  if (mode === 'api') {
    if (!currentAiConfig.aiBaseUrl) throw new Error(I18N.t('aiBackendApiNoConfig'));
    let acc = '';
    await TABU_CAPS.askApiStream(text, currentAiConfig, [], {
      onDelta: (t) => { acc += t; onDelta(t); },
      onReasoning: (t) => { if (opts.onReasoning) opts.onReasoning(t); }
    });
    return { answer: acc, thinking: '' };
  }
  if (mode === 'inject') {
    const streamId = 'sp' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    // 注入渠道回传的是「累计全文快照」→ 换算为增量后再 onDelta（与 api/local 语义一致）
    let prevSnap = '';
    const onInjectDelta = (snap) => {
      const s = String(snap || '');
      const inc = s.startsWith(prevSnap) ? s.slice(prevSnap.length) : s;
      prevSnap = s;
      if (inc) onDelta(inc);
    };
    const out = await execute({ action: 'inject', text, options: { site: injectSite(), images: opts.images || [], streamId, onDelta: onInjectDelta } });
    if (!out.ok) throw new Error(out.result ? (out.result.error || out.error) : (out.error || I18N.t('unknownError')));
    // 站点回复的答案 + 思考（分离结构）带回语音管线显示/朗读
    return {
      answer: (out.result && out.result.text) || null,
      thinking: (out.result && out.result.thinking) || ''
    };
  }
  // local（008 §2 流式）
  const r = await TABU_CAPS.askLocalStream(text, {
    serverUrl: currentVoiceConfig.voiceLocalServer,
    onDelta
  });
  return { answer: (r && r.answer) || '', thinking: '' };
}

// 统一对话流渲染（006 方案二）：语音/文本/本地/API 的问答都追加到同一容器。
// recognized = 用户消息；answer = AI 回答（Markdown）；reasoning = 思考（灰）；userLabel = 用户消息标签（默认"识别"）
// 追加式渲染（insertAdjacentHTML，避免 innerHTML += 重复解析导致的内容丢失）+ 自动滚到底部。
let lastAnswerText = '';
// 每条消息底部的小喇叭图标（简洁 SVG，非 emoji；点击朗读这一条；朗读中显示停止方块）
function msgSpeakBtn() {
  return '<button class="msg-speak" type="button" data-i18n-title="msgSpeakTitle" title="朗读这条" aria-label="朗读">'
    + '<svg class="ic-speak" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
    + '<path d="M11 5 6 9H2v6h4l5 4V5z"></path><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path></svg>'
    + '<svg class="ic-stop" viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"></rect></svg>'
    + '</button>';
}
function renderVoiceOutput(recognized, answer, reasoning, userLabel) {
  const body = document.getElementById('voiceOutputContent');
  if (!body) return;
  const empty = document.getElementById('voiceOutputEmpty');
  if (empty) empty.remove();
  let html = '';
  const uLabel = userLabel || I18N.t('chatRecognized');
  if (reasoning) html += '<div class="voice-msg voice-think"><b>' + escapeHtml(I18N.t('chatThinking')) + '</b>' + escapeHtml(reasoning) + '</div>';
  if (recognized) html += '<div class="voice-msg voice-user"><b>' + escapeHtml(uLabel) + '</b> ' + escapeHtml(recognized) + '<div class="msg-actions">' + msgSpeakBtn() + '</div></div>';
  if (answer) {
    lastAnswerText = String(answer);
    html += '<div class="voice-msg voice-bot"><b>' + escapeHtml(I18N.t('chatAnswer')) + '</b><div class="md-body">' + renderMarkdown(answer) + '</div><div class="msg-actions">' + msgSpeakBtn() + '</div></div>';
  }
  if (html) body.insertAdjacentHTML('beforeend', html);
  body.scrollTop = body.scrollHeight;
  renderVoiceOutputState();
}

// 流式气泡（API 渠道逐字渲染用）：返回 { set(text), finish(markdown) }
function appendStreamBubble(kind) {
  const body = document.getElementById('voiceOutputContent');
  if (!body) return null;
  const empty = document.getElementById('voiceOutputEmpty');
  if (empty) empty.remove();
  const el = document.createElement('div');
  el.className = 'voice-msg ' + kind;
  el.innerHTML = '<b>' + escapeHtml(kind === 'voice-think' ? I18N.t('chatThinking') : I18N.t('chatAnswer')) + '</b><span class="stream-text"></span><div class="msg-actions">' + (kind === 'voice-bot' ? msgSpeakBtn() : '') + '</div>';
  body.appendChild(el);
  body.scrollTop = body.scrollHeight;
  renderVoiceOutputState();
  return el;
}

function voiceOutputClear() {
  const body = document.getElementById('voiceOutputContent');
  if (!body) return;
  body.innerHTML = '<div class="voice-output-empty" id="voiceOutputEmpty">' + escapeHtml(I18N.t('voiceOutputEmpty')) + '</div>';
  renderVoiceOutputState();
}

// 当前对话：无记录时整体隐藏；有记录时可展开/折叠（折叠只留标题行）
// 默认：T 模式展开、S 模式折叠
let voiceOutputCollapsed = (chatMode === 'voice');
function voiceHasRecords() {
  const body = document.getElementById('voiceOutputContent');
  return !!(body && body.querySelector('.voice-msg'));
}
function renderVoiceOutputState() {
  const out = document.getElementById('voiceOutput');
  if (!out) return;
  const has = voiceHasRecords();
  out.classList.toggle('hidden', !has);
  out.classList.toggle('collapsed', has && !!voiceOutputCollapsed);
}
function toggleVoiceOutput() {
  voiceOutputCollapsed = !voiceOutputCollapsed;
  renderVoiceOutputState();
}

async function runAsr(pcm16) {
  // 统一来源「自动」时按可达性解析后端；否则沿用当前显式后端
  const backend = await resolveEffectiveAsrBackend();
  return runAsrOnBackend(pcm16, backend);
}

// 指定后端识别（音频导入需固定后端：浏览器内置不吃文件，见 008 §1）
function runAsrOnBackend(pcm16, backend) {
  if (backend === 'azure') return asrViaAzure(pcm16);
  if (backend === 'openai') return asrViaOpenai(pcm16);
  if (backend === 'aliyun') return asrViaAliyun(pcm16);
  if (backend === 'local') return asrViaLocal(pcm16);
  throw new Error(I18N.t('asrNoAudioError'));
}

// ===== 音频文件导入识别（008 §1）：mp3/wav/m4a → 解码 → 16k → 分段 ASR =====
async function asrImportAudioFile(file) {
  if (!file) return;
  const MAX_FILE = 50 * 1024 * 1024;
  if (file.size > MAX_FILE) { setAsrStatus(I18N.t('asrImportTooLarge'), true); return; }
  const outEl = document.getElementById('asrResult');
  setAsrStatus('📁 ' + I18N.t('asrImportDecoding'));
  try {
    const buf = await file.arrayBuffer();
    const pcm = await decodeAndResample(buf, 16000);
    if (!pcm.length) throw new Error(I18N.t('asrNoAudioError'));
    // 后端：浏览器内置（Web Speech）只吃实时麦克风，文件必须走 local/云端
    let backend = await resolveEffectiveAsrBackend();
    if (backend === 'browser') {
      if (await localReachable()) backend = 'local';
      else { setAsrStatus(I18N.t('asrImportBrowserUnsupported'), true); return; }
    }
    const SR = 16000, SEG = 28 * SR; // 28s/段（Azure ≤60s、本地模型单段有限）
    let text = '';
    if (pcm.length <= SEG) {
      setAsrStatus('📁 ' + I18N.t('asrImportProgress', '1', '1'));
      text = await runAsrOnBackend(pcm, backend);
    } else {
      const total = Math.ceil(pcm.length / SEG);
      const parts = [];
      for (let i = 0, idx = 1; i < pcm.length; i += SEG, idx++) {
        const seg = pcm.subarray(i, Math.min(i + SEG, pcm.length));
        if (seg.length < SR * 0.3) break; // <0.3s 尾段忽略
        setAsrStatus('📁 ' + I18N.t('asrImportProgress', String(idx), String(total)));
        const t = await runAsrOnBackend(seg, backend);
        if (t) parts.push(String(t).trim());
      }
      text = parts.join('\n');
    }
    text = String(text || '').trim();
    if (outEl) outEl.value = text;
    setAsrStatus(text ? '✅ ' + I18N.t('asrTestOk') : I18N.t('asrNoAudioError'), !text);
  } catch (e) {
    setAsrStatus(I18N.t('asrError', (e && e.message) || I18N.t('asrNoAudioError')), true);
  }
}

// ===== 抓标签页音视频（007 §3 B 原型）：tabCapture → 分段 ASR → 结果框 =====
let tabAudioState = null;
async function toggleTabAudioCapture() {
  if (tabAudioState && tabAudioState.active) { stopTabAudioCapture(); return; }
  const btn = document.getElementById('asrTabAudio');
  if (!chrome.tabCapture || !chrome.tabCapture.getMediaStreamId) {
    setAsrStatus(I18N.t('asrTabAudioFail', '当前环境不支持 tabCapture'), true); return;
  }
  // 先取 tabId 并完成捕获（tabCapture 依赖用户手势，尽量减少其前的 await）
  let tabId = null;
  try { const tabs = await chrome.tabs.query({ active: true, currentWindow: true }); tabId = tabs[0] && tabs[0].id; } catch (e) {}
  if (tabId == null) { setAsrStatus(I18N.t('asrTabAudioNoTab'), true); return; }
  let stream = null;
  try {
    setAsrStatus('🎧 ' + I18N.t('asrTabAudioStarting'));
    const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tabId });
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { mandatory: { chromeMediaSource: 'tab', chromeMediaSourceId: streamId } },
      video: false
    });
  } catch (e) {
    setAsrStatus(I18N.t('asrTabAudioFail', (e && e.message) || I18N.t('unknown')), true);
    return;
  }
  // 浏览器内置（Web Speech）无法处理标签流 → 强制 local/云端
  let backend = await resolveEffectiveAsrBackend();
  if (backend === 'browser') {
    if (await localReachable()) backend = 'local';
    else { try { stream.getTracks().forEach((t) => t.stop()); } catch (e) {} setAsrStatus(I18N.t('asrTabAudioBrowserUnsupported'), true); return; }
  }
  try {
    // 捕获后标签默认静音：接回 destination 让用户继续听到声音
    let ctx = null;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      ctx.createMediaStreamSource(stream).connect(ctx.destination);
      ctx.resume().catch(() => {});
    } catch (e) { ctx = null; }
    const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus'
      : (MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '');
    tabAudioState = { stream, ctx, recorder: null, timer: null, active: true, backend, mime, pending: Promise.resolve() };
    startTabAudioRecorder(tabAudioState);
    if (btn) { btn.classList.add('recording'); btn.textContent = I18N.t('asrTabAudioStop'); }
    setAsrStatus('🎧 ' + I18N.t('asrTabAudioRecording'));
  } catch (e) {
    stopTabAudioCapture();
    setAsrStatus(I18N.t('asrTabAudioFail', (e && e.message) || I18N.t('unknown')), true);
  }
}
// 每 ~4s 一段：停旧 recorder → 完整 blob → 解码识别 → 起新 recorder
function startTabAudioRecorder(state) {
  if (tabAudioState !== state) return;
  let rec;
  try { rec = new MediaRecorder(state.stream, state.mime ? { mimeType: state.mime } : undefined); }
  catch (e) { setAsrStatus(I18N.t('asrTabAudioFail', (e && e.message) || ''), true); stopTabAudioCapture(); return; }
  state.recorder = rec;
  const chunks = [];
  rec.ondataavailable = (ev) => { if (ev.data && ev.data.size) chunks.push(ev.data); };
  rec.onstop = () => {
    const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' });
    if (tabAudioState === state) {
      state.pending = state.pending.then(() => tabAudioChunkToText(blob)).catch(() => {});
      startTabAudioRecorder(state); // 下一段
    }
  };
  try { rec.start(); } catch (e) { return; }
  state.timer = setTimeout(() => { try { if (rec.state === 'recording') rec.stop(); } catch (e) {} }, 4000);
}
async function tabAudioChunkToText(blob) {
  const state = tabAudioState;
  if (!state || !state.active) return;
  try {
    const buf = await blob.arrayBuffer();
    const pcm = await decodeAndResample(buf, 16000);
    if (pcm.length < 1600) return; // <0.1s
    const t = await runAsrOnBackend(pcm, state.backend);
    if (t && tabAudioState === state) {
      const outEl = document.getElementById('asrResult');
      if (outEl) outEl.value = (outEl.value ? outEl.value.replace(/\s*$/, '') + '\n' : '') + String(t).trim();
      setAsrStatus('🎧 ' + I18N.t('asrTabAudioRecording'));
    }
  } catch (e) {
    // 单段失败不终止整体（网络抖动/空段），仅提示
    logDebug('asr', '标签页音频分段识别失败: ' + ((e && e.message) || ''), true);
  }
}
function stopTabAudioCapture() {
  const st = tabAudioState;
  tabAudioState = null;
  const btn = document.getElementById('asrTabAudio');
  if (btn) { btn.classList.remove('recording'); btn.textContent = I18N.t('asrTabAudio'); }
  if (!st) return;
  if (st.timer) clearTimeout(st.timer);
  try { if (st.recorder && st.recorder.state !== 'inactive') st.recorder.stop(); } catch (e) {}
  try { if (st.stream) st.stream.getTracks().forEach((t) => t.stop()); } catch (e) {}
  try { if (st.ctx) st.ctx.close(); } catch (e) {}
  setAsrStatus(I18N.t('asrTabAudioStopped'));
}

// 本地服务（本地部署 asr-server）：POST WAV → http://127.0.0.1:9528/transcribe
// 不指定 engine → 服务端自动选（SenseVoice 中文优先，否则 whisper 兜底）
async function asrViaLocal(pcm16) {
  const serverUrl = (currentVoiceConfig.voiceLocalServer || 'http://127.0.0.1:9528').replace(/\/+$/, '');
  const wav = encodeWav(float32ToInt16(pcm16), 16000);
  const res = await fetch(serverUrl + '/transcribe', {
    method: 'POST',
    headers: { 'Content-Type': 'audio/wav' },
    body: wav,
    signal: AbortSignal.timeout(60000)
  });
  if (!res.ok) throw new Error('本地服务 HTTP ' + res.status + '（请确认 asr-server 已启动）');
  const data = await res.json().catch(() => ({}));
  if (data.text) return data.text;
  throw new Error('本地服务: ' + (data.error || '未返回结果'));
}

// 微软 Azure（REST，≤60s 短音频）：POST WAV，Ocp-Apim-Subscription-Key 认证
async function asrViaAzure(pcm16) {
  const cfg = currentVoiceConfig;
  if (!cfg.voiceAzureKey || !cfg.voiceAzureRegion) throw new Error(I18N.t('asrNoConfig'));
  const region = cfg.voiceAzureRegion.replace(/^https?:\/\//, '').split('.')[0];
  const lang = String(document.documentElement.lang).startsWith('zh') ? 'zh-CN' : 'en-US';
  const url = `https://${region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=${lang}&format=detailed`;
  const wav = encodeWav(float32ToInt16(pcm16), 16000);
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': cfg.voiceAzureKey,
      'Content-Type': 'audio/wav; codecs=audio/pcm; samplerate=16000',
      'Accept': 'application/json'
    },
    body: wav,
    signal: AbortSignal.timeout(30000)
  });
  if (!res.ok) throw new Error('Azure HTTP ' + res.status);
  const data = await res.json();
  if (data.RecognitionStatus === 'Success' && data.DisplayText) return data.DisplayText;
  throw new Error('Azure: ' + (data.RecognitionStatus || '未返回结果'));
}

// OpenAI Whisper（OpenAI 兼容，可用 SiliconFlow/Groq 等改 Base）：multipart POST /audio/transcriptions
async function asrViaOpenai(pcm16) {
  const cfg = currentVoiceConfig;
  const key = getOpenaiAsrKey();
  if (!key) throw new Error(I18N.t('asrNoConfig'));
  const base = (cfg.voiceOpenaiBase || 'https://api.openai.com/v1').replace(/\/+$/, '');
  const wav = encodeWav(float32ToInt16(pcm16), 16000);
  const form = new FormData();
  form.append('model', 'whisper-1');
  form.append('response_format', 'json');
  form.append('file', new Blob([wav], { type: 'audio/wav' }), 'recording.wav');
  const res = await fetch(base + '/audio/transcriptions', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + key },
    body: form,
    signal: AbortSignal.timeout(30000)
  });
  if (!res.ok) throw new Error('OpenAI HTTP ' + res.status);
  const data = await res.json();
  if (data.text) return data.text;
  throw new Error('OpenAI: ' + (data.error && data.error.message || '未返回结果'));
}

// 阿里云 DashScope（Qwen-ASR，OpenAI 兼容 chat/completions）：base64 WAV → 文本
// 参考：https://www.alibabacloud.com/help/en/model-studio/qwen-asr-api-reference
async function asrViaAliyun(pcm16) {
  const cfg = currentVoiceConfig;
  if (!cfg.voiceAliyunKey) throw new Error(I18N.t('asrNoConfig'));
  const wav = encodeWav(float32ToInt16(pcm16), 16000);
  // 转 base64 data URL（≤10MB，短录音足够）
  let binary = '';
  const bytes = new Uint8Array(wav.buffer || wav);
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  }
  const dataUrl = 'data:audio/wav;base64,' + btoa(binary);
  const res = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + cfg.voiceAliyunKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'qwen3-asr-flash',
      messages: [{ role: 'user', content: [{ type: 'input_audio', input_audio: dataUrl }] }],
      stream: false,
      asr_options: { language: String(document.documentElement.lang).startsWith('zh') ? 'zh' : undefined }
    }),
    signal: AbortSignal.timeout(60000)
  });
  if (!res.ok) throw new Error('阿里云 HTTP ' + res.status);
  const data = await res.json();
  const text = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
  if (text) return String(text).trim();
  throw new Error('阿里云: ' + (data.error && data.error.message || '未返回结果'));
}

// ---- 音频工具：解码 / 重采样 / 编码 ----
// 健壮版：OfflineAudioContext 解码 + 高质量重采样到 16k 单声道，
// 兼容各种采样率/声道的麦克风（USB 麦常见 48k/96k、多声道）。
async function decodeAndResample(arrayBuffer, targetRate = 16000) {
  // 1. 解码（OfflineAudioContext 解码不依赖运行中的 AudioContext，更可靠）
  const decodeCtx = new OfflineAudioContext(1, 1, targetRate);
  const audioBuf = await decodeCtx.decodeAudioData(arrayBuffer);
  // 2. 多声道 → 单声道（平均）
  const chCount = Math.max(1, audioBuf.numberOfChannels);
  const len = audioBuf.length;
  const mono = new Float32Array(len);
  for (let c = 0; c < chCount; c++) {
    const d = audioBuf.getChannelData(c);
    for (let i = 0; i < len; i++) mono[i] += d[i] / chCount;
  }
  const srcRate = audioBuf.sampleRate;
  if (srcRate === targetRate) return mono;
  // 3. 高质量重采样：经 OfflineAudioContext 渲染到目标采样率（自动低通滤波，避免抽样混叠）
  const outLen = Math.max(1, Math.ceil(len * targetRate / srcRate));
  const offCtx = new OfflineAudioContext(1, outLen, targetRate);
  const monoBuf = new AudioBuffer({ length: len, numberOfChannels: 1, sampleRate: srcRate });
  monoBuf.copyToChannel(mono, 0);
  const src = offCtx.createBufferSource();
  src.buffer = monoBuf;
  src.connect(offCtx.destination);
  src.start(0);
  const rendered = await offCtx.startRendering();
  return rendered.getChannelData(0);
}

function float32ToInt16(pcm) {
  const out = new Int16Array(pcm.length);
  for (let i = 0; i < pcm.length; i++) {
    out[i] = Math.max(-32768, Math.min(32767, Math.round(pcm[i] * 32767))) | 0;
  }
  return out;
}

// 16-bit 单声道 PCM → WAV（44 字节头）
function encodeWav(int16, sampleRate = 16000) {
  const n = int16.length;
  const buffer = new ArrayBuffer(44 + n * 2);
  const view = new DataView(buffer);
  const w = (o, s) => { for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); view.setUint32(4, 36 + n * 2, true); w(8, 'WAVE');
  w(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  w(36, 'data'); view.setUint32(40, n * 2, true);
  new Int16Array(buffer, 44).set(int16);
  return new Uint8Array(buffer);
}

// 清洗识别文本：去掉 <|...|>（SenseVoice 语种/情感标记等）并压缩空白
function cleanAsrText(text) {
  return String(text || '').replace(/<\|[^|]*\|>/g, '').replace(/\s+/g, ' ').trim();
}

// ---- 结果操作：复制 / 发给朗读 / 翻译 / AI ----
async function asrCopyResult() {
  const out = document.getElementById('asrResult');
  if (!out || !out.value) return;
  try {
    await navigator.clipboard.writeText(out.value);
    showStatus('✅ ' + I18N.t('copied'), 'success');
  } catch (e) {
    out.select();
    document.execCommand('copy');
    showStatus('✅ ' + I18N.t('copied'), 'success');
  }
}

function asrClearResult() {
  const out = document.getElementById('asrResult');
  if (out) out.value = '';
  setAsrStatus(I18N.t('asrStatusIdle'));
}

function asrSendToTts() {
  const out = document.getElementById('asrResult');
  if (!out || !out.value.trim()) return;
  // 朗读标签已移除：转写结果填入对话输入框并朗读
  setChatMode('text');
  injectSetInput(out.value);
  speakInputText();
}

async function asrSendToTrans() {
  const out = document.getElementById('asrResult');
  if (!out || !out.value.trim()) return;
  // 独立翻译标签已移除：转写结果翻译改走对话 AI处理（LLM 渠道），目标语言取选区条的语言选择
  const sel = document.getElementById('selTgtLang');
  const target = (sel && sel.selectedOptions[0]) ? sel.selectedOptions[0].textContent.trim() : '中文(简体)';
  setChatMode('text');
  await injectRun('请将以下内容翻译成' + target + '：\n\n' + out.value.trim(), [], { skipPageContext: true });
}

async function asrSendToAi() {
  const out = document.getElementById('asrResult');
  if (!out || !out.value.trim()) return;
  // 工作台已上移主界面：直接填入输入框并发送，按当前渠道路由（local/api/inject），无需跳转 AI 标签页
  injectSetInput(out.value);
  injectSend();
}

// 抓取当前网页视频字幕/台词 → 填入转写结果框（下游可 朗读/翻译/发给 AI）
async function asrFetchPageSubtitles() {
  const out = document.getElementById('asrResult');
  setAsrStatus(I18N.t('asrSubsLoading'));
  try {
    const text = await TABU_CAPS.getPageSubtitles();
    if (!text || !text.trim()) { setAsrStatus(I18N.t('asrSubsNone'), true); return; }
    if (out) out.value = text;
    setAsrStatus(I18N.t('asrSubsFound'));
  } catch (e) {
    setAsrStatus(I18N.t('asrSubsNone'), true);
  }
}

// AI 渠道：'local' 本地版（默认）/ 'inject' 浏览器版（页面注入）/ 'api' API 版
// 旧 'trans'（免费翻译）已合并进「AI处理」，一律回退为 local
async function getEffectiveAiMode() {
  const r = await chrome.storage.local.get('aiMode');
  if (r.aiMode === 'local' || r.aiMode === 'inject' || r.aiMode === 'api') return r.aiMode;
  return 'local'; // 首次默认本地版（本地 LLM）
}

async function setAiMode(mode) {
  await chrome.storage.local.set({ aiMode: mode });
  await syncAiBackendUi();
}

// 同步渠道切换 UI + 提示 + 站点下拉置灰
async function syncAiBackendUi() {
  const mode = await getEffectiveAiMode();
  const localBtn = aiField('aiBackendLocal');
  const injectBtn = aiField('aiBackendInject');
  const apiBtn = aiField('aiBackendApi');
  if (localBtn) localBtn.classList.toggle('active', mode === 'local');
  if (injectBtn) injectBtn.classList.toggle('active', mode === 'inject');
  if (apiBtn) apiBtn.classList.toggle('active', mode === 'api');

  const hint = aiField('aiModeHint');
  const siteSelEl = document.getElementById('injectSite');
  const siteRow = siteSelEl ? siteSelEl.closest('.cfg-row') : null;
  const apiConfigured = !!currentAiConfig.aiBaseUrl;
  if (siteRow) siteRow.classList.toggle('api-mode', mode === 'api');
  if (hint) {
    if (mode === 'api') {
      if (apiConfigured) {
        let host = '?';
        try { host = new URL(currentAiConfig.aiBaseUrl).host; } catch (e) {}
        hint.textContent = I18N.t('aiModeApi', currentAiConfig.aiModel || getAiDefaultModel(currentAiConfig.aiProvider), host);
      } else {
        hint.textContent = I18N.t('aiBackendApiNoConfig');
      }
      hint.classList.remove('hidden');
    } else if (mode === 'inject') {
      // 免费浏览器版说明：需先打开并登录对话界面（站点名与下方「发送到」选中项一致）
      const siteSel = document.getElementById('injectSite');
      const siteName = (siteSel && siteSel.selectedOptions[0]) ? siteSel.selectedOptions[0].textContent.trim() : '';
      hint.textContent = I18N.t('aiBackendInjectHint', siteName);
      hint.classList.remove('hidden');
    } else {
      hint.classList.add('hidden');
    }
  }
  updateThinkingToggleVisibility();
}

// ========== 统一能力来源设置区（TTS / LLM / ASR 三维度） ==========
// 维度标签页切换（识别/LLM/朗读）：只显示当前面板，其余隐藏
function switchCapTab(name) {
  document.querySelectorAll('.cap-tab').forEach(b => b.classList.toggle('active', b.getAttribute('data-captab') === name));
  document.querySelectorAll('[data-captab-panel]').forEach(p => p.classList.toggle('hidden', p.getAttribute('data-captab-panel') !== name));
}

// 能力自动回退开关（每个能力独立，存 capAutoTts / capAutoAsr / capAutoLlm；
// 旧全局 capAutoFallback 迁移为三者的初始值）
async function loadCapabilityAutos() {
  const r = await chrome.storage.local.get(['capAutoFallback', 'capAutoTts', 'capAutoAsr', 'capAutoLlm']);
  const legacy = !!r.capAutoFallback;
  const patch = {};
  [['capAutoTts', 'capAutoTts'], ['capAutoAsr', 'capAutoAsr'], ['capAutoLlm', 'capAutoLlm']].forEach(([key, id]) => {
    const v = (key in r) ? !!r[key] : legacy;
    patch[key] = v;
    const el = document.getElementById(id);
    if (el) el.checked = v;
  });
  await chrome.storage.local.set(patch).catch(() => {});
}
// ========== 统一来源 · 运行时解析（TTS / ASR / LLM 自动回退） ==========
// 每个能力独立的「自动按可达性回退」开关（capAutoTts / capAutoAsr / capAutoLlm，蓝区各详细卡内）；
// 开关关闭 = 完全沿用当前显式设置。
let _localReachCache = null; // { ok, at } 短暂缓存本地可达性，避免高频 /health
async function localReachable(ttlMs = 5000) {
  const now = Date.now();
  if (_localReachCache && now - _localReachCache.at < ttlMs) return _localReachCache.ok;
  const serverUrl = (currentVoiceConfig && currentVoiceConfig.voiceLocalServer) || 'http://127.0.0.1:9528';
  let ok = false;
  try { ok = (await fetch(serverUrl.replace(/\/+$/, '') + '/health', { signal: AbortSignal.timeout(2500) })).ok; } catch (e) {}
  _localReachCache = { ok, at: now };
  return ok;
}

async function resolveEffectiveTtsEngine() {
  const r = await chrome.storage.local.get('capAutoTts');
  if (r.capAutoTts) {
    const reach = await localReachable();
    if (reach) return 'kokoro'; // 本地在线 → 本地引擎；离线/失败 → 系统（运行中失败也会自动回退，见 doSpeak）
    return 'system';
  }
  return (currentVoiceConfig && currentVoiceConfig.ttsEngine) || 'system';
}

async function resolveEffectiveAsrBackend() {
  const r = await chrome.storage.local.get('capAutoAsr');
  if (r.capAutoAsr) {
    const reach = await localReachable();
    if (reach) return 'local';
  }
  return currentAsrBackend;
}

async function resolveEffectiveAiModeForChat() {
  const r = await chrome.storage.local.get('capAutoLlm');
  if (r.capAutoLlm) {
    const reach = await localReachable();
    if (reach) return 'local';
    return (currentAiConfig && currentAiConfig.aiBaseUrl) ? 'api' : 'inject';
  }
  return getEffectiveAiMode();
}

async function loadVersionSettings() {
  const r = await chrome.storage.local.get(['bookmarkMaxVersions', 'historyMaxVersions']);
  const bm = document.getElementById('bmMaxVersions');
  const hist = document.getElementById('histMaxVersions');
  if (bm) bm.value = r.bookmarkMaxVersions || 20;
  if (hist) hist.value = r.historyMaxVersions || 20;
}

async function saveBmMaxVersions() {
  const input = document.getElementById('bmMaxVersions');
  const v = Math.max(1, Math.min(100, parseInt(input?.value) || 20));
  await chrome.storage.local.set({ bookmarkMaxVersions: v });
  showStatus(I18N.t('bmMaxSaved'), 'success');
}

async function saveHistMaxVersions() {
  const input = document.getElementById('histMaxVersions');
  const v = Math.max(1, Math.min(100, parseInt(input?.value) || 20));
  await chrome.storage.local.set({ historyMaxVersions: v });
  showStatus(I18N.t('histMaxSaved'), 'success');
}

// ========== 定时保存快照 ==========
const AUTO_SAVE_INTERVAL_VALUES = ['0', '1', '6', '12', '24', '48'];
function autoSaveTimeInput() { return document.getElementById('autoSaveDailyAt'); }

async function loadAutoSaveSettings() {
  const sel = document.getElementById('autoSaveInterval');
  const timeInput = autoSaveTimeInput();
  if (sel && timeInput) {
    const r = await chrome.storage.local.get(['autoSnapshotIntervalHours', 'autoSnapshotDailyAt']);
    const dailyAt = r.autoSnapshotDailyAt;
    if (typeof dailyAt === 'string' && /^\d{2}:\d{2}$/.test(dailyAt)) {
      sel.value = 'daily';
      timeInput.value = dailyAt;
    } else {
      sel.value = String(r.autoSnapshotIntervalHours ?? 12);
      if (!AUTO_SAVE_INTERVAL_VALUES.includes(sel.value)) sel.value = '12';
    }
    timeInput.hidden = sel.value !== 'daily';
  }
  const last = document.getElementById('autoSaveLastAt');
  if (last) {
    const r = await chrome.storage.local.get('lastAutoSnapshotAt');
    last.textContent = r.lastAutoSnapshotAt ? new Date(r.lastAutoSnapshotAt).toLocaleString() : '—';
  }
}

async function saveAutoSaveInterval() {
  const sel = document.getElementById('autoSaveInterval');
  const timeInput = autoSaveTimeInput();
  const v = sel?.value || '0';
  if (v === 'daily') {
    const t = (timeInput?.value || '21:00');
    await chrome.storage.local.set({ autoSnapshotDailyAt: t });
    await chrome.storage.local.remove('autoSnapshotIntervalHours');
    await sendMessage('rescheduleAutoSnapshot'); // 让后台按新调度重建 alarm
    showStatus(I18N.t('autoSaveDailySaved', t), 'success');
  } else {
    const hours = Math.max(0, parseInt(v) || 0);
    await chrome.storage.local.set({ autoSnapshotIntervalHours: hours });
    await chrome.storage.local.remove('autoSnapshotDailyAt');
    await sendMessage('rescheduleAutoSnapshot'); // 让后台按新周期重建 alarm
    showStatus(hours > 0 ? I18N.t('autoSaveSaved', hours) : I18N.t('autoSaveOffMsg'), 'success');
  }
}

// ========== 关于：反馈 / 评价弹窗（可手动关闭） ==========
function openAboutModal(kind) {
  const modal = document.getElementById('aboutModal');
  if (!modal) return;
  document.getElementById('aboutModalTitle').textContent = I18N.t(kind === 'review' ? 'aboutReview' : 'aboutFeedback');
  document.getElementById('aboutModalMsg').textContent = I18N.t(kind === 'review' ? 'aboutReviewMsg' : 'aboutFeedbackMsg');
  modal.classList.remove('hidden');
}
function closeAboutModal() {
  const modal = document.getElementById('aboutModal');
  if (modal) modal.classList.add('hidden');
}

async function clearSnapshotsData() {
  if (!confirm(I18N.t('confirmClearSnapshots'))) return;
  const r = await sendMessage('clearAllSnapshots');
  if (r && r.success) {
    showStatus(I18N.t('clearedAllSnapshots'), 'success');
    await loadStats();
  } else {
    showStatus(I18N.t('clearFail'), 'error');
  }
}

async function clearBookmarkVersionsData() {
  if (!confirm(I18N.t('confirmClearBmVersions'))) return;
  const r = await sendMessage('clearAllBookmarkVersions');
  if (r && r.success) {
    showStatus(I18N.t('clearedBmVersions'), 'success');
    await loadStats();
  } else {
    showStatus(I18N.t('clearFail'), 'error');
  }
}

async function clearHistoryVersionsData() {
  if (!confirm(I18N.t('confirmClearHistVersions'))) return;
  const r = await sendMessage('clearAllHistoryVersions');
  if (r && r.success) {
    showStatus(I18N.t('clearedHistVersions'), 'success');
    await loadStats();
  } else {
    showStatus(I18N.t('clearFail'), 'error');
  }
}

// 从 JSON 文件导入备份
async function importDataFromFile(file) {
  if (!file) return;
  try {
    const text = await file.text();
    showStatus(I18N.t('importing'), 'info');
    const r = await sendMessage('importData', { jsonData: text });
    if (r && r.success) showStatus(I18N.t('importSuccess', r.count), 'success');
    else showStatus(I18N.t('importFail') + ((r && r.message) || I18N.t('unknownError')), 'error');
  } catch (e) {
    showStatus(I18N.t('importFail') + e.message, 'error');
  }
}

// ========== 初始化 ==========
document.addEventListener('DOMContentLoaded', () => {
  console.log('TabU AI sidepanel loaded');
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // ===== 红蓝层切换 =====
  document.querySelectorAll('.layer-btn').forEach(btn => {
    btn.addEventListener('click', () => switchLayer(btn.dataset.layer));
  });

  // ===== 文本工具切换（朗读/翻译/AI/卡片） =====
  document.querySelectorAll('.tool-tab').forEach(btn => {
    btn.addEventListener('click', () => switchTool(btn.dataset.tool));
  });

  // ===== 朗读 =====
  // 朗读全文/输入框按钮（i 设置内）即「开始/停止」开关：朗读中点击同按钮 = 停止
  const ttsSpeakFull = document.getElementById('ttsSpeakFull');
  if (ttsSpeakFull) ttsSpeakFull.addEventListener('click', () => {
    if (activeSpeakBtn === ttsSpeakFull) stopSpeaking(); else speakFullPage(ttsSpeakFull);
  });
  const ttsSpeakInput = document.getElementById('ttsSpeakInput');
  if (ttsSpeakInput) ttsSpeakInput.addEventListener('click', () => {
    if (activeSpeakBtn === ttsSpeakInput) stopSpeaking(); else speakInputText();
  });
  // 蓝区系统音色/语言筛选（红区朗读面板已移除，蓝区为唯一来源）
  const blueLang = document.getElementById('ttsLangFilterBlue');
  const blueVoice = document.getElementById('ttsVoiceBlue');
  if (blueLang) blueLang.addEventListener('change', () => {
    applyVoiceFilter();
    chrome.storage.local.set({ ttsLangFilterSel: blueLang.value }).catch(() => {});
  });
  if (blueVoice) blueVoice.addEventListener('change', () => {
    chrome.storage.local.set({ ttsVoiceSel: blueVoice.value }).catch(() => {});
    mirrorVoiceExtras(blueVoice);
  });
  // OS TTS 引擎常懒加载语音：等 voiceschanged 再补一次列表（首次可能返回空）
  if (window.speechSynthesis && speechSynthesis.addEventListener) {
    speechSynthesis.addEventListener('voiceschanged', () => { populateVoices(); });
  } else if (chrome.tts && chrome.tts.onVoicesChanged) {
    chrome.tts.onVoicesChanged.addListener(() => { if (allVoices.length === 0) populateVoices(); });
  }
  // 滑块标签 + 持久化（语速/语调/音量；滑块现位于蓝区 TTS 卡）
  ['ttsRate', 'ttsPitch', 'ttsVolume'].forEach(id => {
    const input = document.getElementById(id);
    const label = document.getElementById(id + 'Label');
    if (input && label) {
      input.addEventListener('input', () => {
        label.textContent = parseFloat(input.value).toFixed(1);
      });
      input.addEventListener('change', () => {
        chrome.storage.local.set({ [id + 'Sel']: parseFloat(input.value) }).catch(() => {});
        // 语速同步到主对话面板 i 设置
        if (id === 'ttsRate') {
          const c = document.getElementById('chatTtsRate');
          const cl = document.getElementById('chatTtsRateLabel');
          if (c && c.value !== input.value) { c.value = input.value; if (cl) cl.textContent = parseFloat(input.value).toFixed(1); }
        }
      });
    }
  });
  // 恢复存储的语速/语调/音量
  chrome.storage.local.get(['ttsRateSel', 'ttsPitchSel', 'ttsVolumeSel']).then((r) => {
    [['ttsRate', 'ttsRateSel'], ['ttsPitch', 'ttsPitchSel'], ['ttsVolume', 'ttsVolumeSel']].forEach(([id, key]) => {
      const input = document.getElementById(id);
      const label = document.getElementById(id + 'Label');
      const v = r[key];
      if (input && typeof v === 'number') {
        input.value = v;
        if (label) label.textContent = v.toFixed(1);
      }
    });
    // 语速恢复到 i 设置
    const c = document.getElementById('chatTtsRate');
    const cl = document.getElementById('chatTtsRateLabel');
    if (c && typeof r.ttsRateSel === 'number') { c.value = r.ttsRateSel; if (cl) cl.textContent = r.ttsRateSel.toFixed(1); }
  }).catch(() => {});
  // 朗读引擎（蓝区）
  const ttsEngineBlue = document.getElementById('ttsEngineBlue');
  if (ttsEngineBlue) ttsEngineBlue.addEventListener('change', () => setTtsEngine(ttsEngineBlue.value));
  // 蓝区识别后端（与转写面板共用 asrBackend）
  const asrBackendBlue = document.getElementById('asrBackendBlue');
  if (asrBackendBlue) asrBackendBlue.addEventListener('change', () => setAsrBackend(asrBackendBlue.value));
  const ttsLocalVoiceBlue = document.getElementById('ttsLocalVoiceBlue');
  if (ttsLocalVoiceBlue) ttsLocalVoiceBlue.addEventListener('change', () => saveLocalVoice(ttsLocalVoiceBlue));
  // 云端 TTS 供应商切换 → 自动填 Base URL + 模型/音色建议
  const ttsProviderSel = document.getElementById('ttsProvider');
  if (ttsProviderSel) ttsProviderSel.addEventListener('change', onTtsProviderChange);
  // 蓝区「测试朗读」：读一句样例，验证本地 TTS
  const ttsLocalTestBtn = document.getElementById('ttsLocalTestBtn');
  if (ttsLocalTestBtn) ttsLocalTestBtn.addEventListener('click', () => {
    const engine = currentVoiceConfig.ttsEngine;
    if (!SPEAK_ENGINES.includes(engine)) {
      const tip = I18N.t('ttsLocalNeedServer');
      showStatus(tip, 'error');
      if (voiceField('ttsTestStatus')) voiceField('ttsTestStatus').textContent = tip;
      return;
    }
    const round = ++speakRoundSeq; activeSpeakRound = round;
    speakLocalTts(I18N.t('ttsLocalSample'), voiceField('ttsTestStatus'), ttsLocalTestBtn, engine, round);
  });

  // 本地模型管理（014 §5.2）：刷新按钮 + 首次加载状态
  const modelRefreshBtn = document.getElementById('modelRefreshBtn');
  if (modelRefreshBtn) modelRefreshBtn.addEventListener('click', loadVoiceModels);
  loadVoiceModels();

  // 防止按钮按下时抢走焦点，导致网页上的文字选区被清除
  ['cardImportSel'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('mousedown', (e) => e.preventDefault());
  });


  // ===== 卡片 =====
  // 卡片控件标签栏（字体/样式/位置/颜色），避免所有控件堆叠占高
  document.querySelectorAll('.card-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.card-tab').forEach(b => b.classList.toggle('active', b === btn));
      const ctab = btn.dataset.ctab;
      document.querySelectorAll('.card-ctab').forEach(p => p.classList.toggle('hidden', p.dataset.ctab !== ctab));
    });
  });
  const cardInputEl = document.getElementById('cardInput');
  if (cardInputEl) cardInputEl.addEventListener('input', updateCardPreview);
  const cardImportSelEl = document.getElementById('cardImportSel');
  if (cardImportSelEl) cardImportSelEl.addEventListener('click', cardImportSelected);
  const cardPasteEl = document.getElementById('cardPaste');
  if (cardPasteEl) cardPasteEl.addEventListener('click', cardPaste);
  const ctlFontFieldEl = document.getElementById('ctlFontField');
  if (ctlFontFieldEl) ctlFontFieldEl.addEventListener('click', (e) => { e.stopPropagation(); toggleFontList(); });
  const ctlFontSearchEl = document.getElementById('ctlFontSearch');
  if (ctlFontSearchEl) {
    // 搜索即实时过滤并展开列表（修复原 select 需点开才可见筛选结果的问题）
    ctlFontSearchEl.addEventListener('focus', () => { const l = document.getElementById('ctlFontList'); if (l) l.classList.add('open'); });
    ctlFontSearchEl.addEventListener('input', () => {
      renderFontList();
      if (ctlFontSearchEl.value.trim()) { const l = document.getElementById('ctlFontList'); if (l) l.classList.add('open'); }
    });
  }
  // 点击面板其它区域时收起字体列表
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.font-ctrl')) closeFontList();
  });
  // 卡片比例 / 宽度
  const ctlRatioEl = document.getElementById('ctlRatio');
  if (ctlRatioEl) ctlRatioEl.addEventListener('change', updateCardPreview);
  const ctlCardWEl = document.getElementById('ctlCardW');
  const ctlCardWVEl = document.getElementById('ctlCardWV');
  if (ctlCardWEl) {
    ctlCardWEl.addEventListener('input', () => {
      if (ctlCardWVEl) ctlCardWVEl.textContent = ctlCardWEl.value;
      updateCardPreview();
    });
    // 默认宽度 800px（HTML value=800）；不自动跟随面板宽度
    if (ctlCardWVEl) ctlCardWVEl.textContent = ctlCardWEl.value;
  }
  // 侧边栏宽度可被用户拖拽，窗口 resize 时重算卡片预览缩放（卡片已迁至蓝区，蓝层激活时才更新）
  window.addEventListener('resize', () => {
    const app = document.getElementById('app');
    if (app && app.dataset.layer === 'blue') updateCardPreview();
  });
  document.querySelectorAll('#ctlBg .swatch, #ctlColor .swatch').forEach(s => {
    s.style.background = s.dataset.c; // 色块背景取自 data-c，否则看不见颜色
    s.addEventListener('click', () => {
      const which = s.parentElement.id === 'ctlBg' ? 'bg' : 'text';
      setCurrentColor(which, s.dataset.c);
      updateCardPreview();
    });
  });
  // 自定义取色器：自由选色（命中预设则点亮对应色块）
  [['bg', 'ctlBgColor'], ['text', 'ctlTextColor']].forEach(([which, id]) => {
    const input = document.getElementById(id);
    if (input) input.addEventListener('input', () => {
      setCurrentColor(which, input.value);
      updateCardPreview();
    });
  });
  // 配色方案弹窗
  document.querySelectorAll('.palette-btn').forEach(b => {
    b.addEventListener('click', () => openPalette(b.dataset.which === 'text' ? 'text' : 'bg'));
  });
  const paletteCloseEl = document.getElementById('paletteClose');
  if (paletteCloseEl) paletteCloseEl.addEventListener('click', closePalette);
  const paletteOverlayEl = document.getElementById('paletteOverlay');
  if (paletteOverlayEl) paletteOverlayEl.addEventListener('click', (e) => { if (e.target === paletteOverlayEl) closePalette(); });
  ['ctlRadius', 'ctlPad', 'ctlFontSize'].forEach(id => {
    const input = document.getElementById(id);
    const label = document.getElementById(id + 'V');
    if (input) {
      input.addEventListener('input', () => {
        if (label) label.textContent = input.value;
        updateCardPreview();
      });
    }
  });
  // 文本框位置：X/Y 滑块（标签在 updateCardPreview 里统一更新为 "x, y"）
  ['ctlPosX', 'ctlPosY'].forEach(id => {
    const input = document.getElementById(id);
    if (input) input.addEventListener('input', () => updateCardPreview());
  });
  const ctlPosReset = document.getElementById('ctlPosReset');
  if (ctlPosReset) ctlPosReset.addEventListener('click', () => setPos(0, 0));
  // 卡片内直接拖拽文本框移动位置（作用于 .ec-fit，translate 在 scale 外 → 1:1 映射 canvas posX/posY）
  // 整卡被预览缩放后，屏幕像素 → 逻辑像素按 cardPreviewScale 换算，文本框跟随光标移动 1:1
  const ecFitEl = document.getElementById('ecFit');
  if (ecFitEl) {
    let drag = null;
    ecFitEl.addEventListener('pointerdown', (e) => {
      drag = { sx: e.clientX, sy: e.clientY, px: getPos('X'), py: getPos('Y') };
      ecFitEl.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    ecFitEl.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const k = cardPreviewScale || 1;
      setPos(drag.px + (e.clientX - drag.sx) / k, drag.py + (e.clientY - drag.sy) / k);
    });
    const endDrag = () => { drag = null; };
    ecFitEl.addEventListener('pointerup', endDrag);
    ecFitEl.addEventListener('pointercancel', endDrag);
  }
  const cardDownloadEl = document.getElementById('cardDownload');
  if (cardDownloadEl) cardDownloadEl.addEventListener('click', downloadCard);
  const cardCopyTextEl = document.getElementById('cardCopyText');
  if (cardCopyTextEl) cardCopyTextEl.addEventListener('click', copyCardText);

  // ===== 截图浮层 =====
  const shotCloseEl = document.getElementById('shotClose');
  if (shotCloseEl) shotCloseEl.addEventListener('click', closeScreenshot);
  const shotDownloadEl = document.getElementById('shotDownload');
  if (shotDownloadEl) shotDownloadEl.addEventListener('click', downloadScreenshot);
  const shotCopyEl = document.getElementById('shotCopy');
  if (shotCopyEl) shotCopyEl.addEventListener('click', copyScreenshot);

  // ===== 注入（AI 面板） =====
  const injectVoiceEl = document.getElementById('injectVoice');
  if (injectVoiceEl) injectVoiceEl.addEventListener('click', toggleInjectVoice);
  const injectTranslateFree = document.getElementById('injectTranslateFree');
  if (injectTranslateFree) injectTranslateFree.addEventListener('click', translateInputFree);
  // 🔊 朗读回答开关（默认开）
  const speakToggle = document.getElementById('aiSpeakToggle');
  if (speakToggle) {
    chrome.storage.local.get('aiSpeakAnswer').then((r) => updateAiSpeakToggleUi(r.aiSpeakAnswer !== false)).catch(() => {});
    speakToggle.addEventListener('click', async () => {
      const on = !(await aiSpeakAnswerEnabled());
      await chrome.storage.local.set({ aiSpeakAnswer: on });
      updateAiSpeakToggleUi(on);
    });
  }
  // 📎 附件：图片（随发送粘贴上传）+ 文本类（读为文本素材）
  const injectAttachBtn = document.getElementById('injectAttach');
  const injectAttachFile = document.getElementById('injectAttachFile');
  if (injectAttachBtn && injectAttachFile) {
    injectAttachBtn.addEventListener('click', () => injectAttachFile.click());
    injectAttachFile.addEventListener('change', () => {
      injectAttachPick(injectAttachFile.files);
      injectAttachFile.value = ''; // 允许重复选择同一文件
    });
  }
  // 💭 思考显示开关（默认隐藏；仅当当前 LLM 可能产出思考时显示，S/T 两模式通用）
  const showThinkToggle = document.getElementById('aiShowThinkingToggle');
  if (showThinkToggle) {
    chrome.storage.local.get('aiShowThinking').then((r) => updateAiShowThinkingToggleUi(r.aiShowThinking === true)).catch(() => {});
    showThinkToggle.addEventListener('click', async () => {
      const on = !(await aiShowThinkingEnabled());
      await chrome.storage.local.set({ aiShowThinking: on });
      updateAiShowThinkingToggleUi(on);
    });
    updateThinkingToggleVisibility();
  }
  // 后台注入进度提示（方案 A：AI 标签页后台打开，不抢当前页面焦点）
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg && msg.type === 'injectNote' && msg.text) {
      const el = document.getElementById('injectStatus');
      if (el) el.textContent = msg.text;
      showStatus(msg.text, 'info');
    }
    // 页面选区状态 → 控制选区操作条显隐
    if (msg && msg.type === 'selectionState') setPageSelectionState(!!msg.hasSelection);
  });
  const newChatEl = document.getElementById('injectNewChat');
  if (newChatEl) newChatEl.addEventListener('click', injectNewChat);
  const sendEl = document.getElementById('injectSend');
  if (sendEl) sendEl.addEventListener('click', injectSend);
  const stopEl = document.getElementById('injectStop');
  if (stopEl) stopEl.addEventListener('click', injectStop);
  // 自定义模板输入框（已移蓝区）：值在发送时实时读取，无需额外绑定
  const injectClearEl = document.getElementById('injectClear');
  if (injectClearEl) injectClearEl.addEventListener('click', injectClear);
  // 免费浏览器版说明跟随「发送到」站点变化
  const injectSiteSel = document.getElementById('injectSite');
  if (injectSiteSel) injectSiteSel.addEventListener('change', () => { syncAiBackendUi(); refreshInjectCapBadges(); });
  const clearHistoryEl = document.getElementById('injectClearHistory');
  if (clearHistoryEl) clearHistoryEl.addEventListener('click', clearInjectHistory);

  // ===== 蓝层：数据工具 =====
  const blueScreenshot = document.getElementById('blueScreenshot');
  if (blueScreenshot) blueScreenshot.addEventListener('click', captureScreenshot);
  const bluePrint = document.getElementById('bluePrint');
  if (bluePrint) bluePrint.addEventListener('click', printCurrentTab);
  const blueMail = document.getElementById('blueMail');
  if (blueMail) blueMail.addEventListener('click', mailExport);
  const blueExport = document.getElementById('blueExport');
  if (blueExport) blueExport.addEventListener('click', exportData);
  const blueImport = document.getElementById('blueImport');
  const blueImportFile = document.getElementById('blueImportFile');
  if (blueImport && blueImportFile) {
    blueImport.addEventListener('click', () => blueImportFile.click());
    blueImportFile.addEventListener('change', (e) => {
      importDataFromFile(e.target.files && e.target.files[0]);
      e.target.value = ''; // 允许重复选择同一文件
    });
  }

  // ===== 蓝层：系统设置 =====
  const bridgeTokenSave = document.getElementById('bridgeTokenSave');
  if (bridgeTokenSave) bridgeTokenSave.addEventListener('click', saveBridgeToken);
  const injectSwitch = document.getElementById('injectSwitch');
  if (injectSwitch) injectSwitch.addEventListener('click', toggleInjectSwitch);
  // ===== 蓝层：AI 服务（P0-B） =====
  const aiSaveBtn = document.getElementById('aiSaveBtn');
  if (aiSaveBtn) aiSaveBtn.addEventListener('click', saveAiConfig);
  const aiTestBtn = document.getElementById('aiTestBtn');
  if (aiTestBtn) aiTestBtn.addEventListener('click', testAiConnection);
  const aiKeyToggle = document.getElementById('aiKeyToggle');
  if (aiKeyToggle) aiKeyToggle.addEventListener('click', toggleAiKeyVisible);
  const aiAllowAnySwitch = document.getElementById('aiAllowAnySwitch');
  if (aiAllowAnySwitch) aiAllowAnySwitch.addEventListener('click', toggleAiAllowAny);
  const aiProviderSel = document.getElementById('aiProvider');
  if (aiProviderSel) aiProviderSel.addEventListener('change', onAiProviderChange);
  // 红区 AI 渠道切换（本地版 / 浏览器版 / API版）
  const aiBackendLocal = document.getElementById('aiBackendLocal');
  if (aiBackendLocal) aiBackendLocal.addEventListener('click', () => setAiMode('local'));
  const aiBackendInject = document.getElementById('aiBackendInject');
  if (aiBackendInject) aiBackendInject.addEventListener('click', () => setAiMode('inject'));
  const aiBackendApi = document.getElementById('aiBackendApi');
  if (aiBackendApi) aiBackendApi.addEventListener('click', () => setAiMode('api'));

  // ===== 顶部圆形语音工作台 + 输出栏 =====
  const voiceCircleBtn = document.getElementById('voiceCircleBtn');
  if (voiceCircleBtn) voiceCircleBtn.addEventListener('click', toggleVoiceCircle);
  document.querySelectorAll('#voiceCircleMode .vc-mode').forEach(b => {
    b.addEventListener('click', () => setVoiceCircleMode(b.dataset.vcmode));
  });
  loadVoiceCircleMode();
  // 初始提示（"点击说话…"）显示几秒后自动隐藏
  vcStatusHideTimer = setTimeout(() => { document.getElementById('voiceCircleStatus')?.classList.add('hidden'); }, 5000);
  // ===== 主对话面板：语音/文本模式切换 + i 设置 =====
  const chatModeSwitch = document.getElementById('chatModeSwitch');
  if (chatModeSwitch) chatModeSwitch.addEventListener('click', () => setChatMode(chatMode === 'voice' ? 'text' : 'voice'));
  const chatSettingsToggle = document.getElementById('chatSettingsToggle');
  if (chatSettingsToggle) chatSettingsToggle.addEventListener('click', toggleChatSettings);
  const chatInputToggle = document.getElementById('chatInputToggle');
  if (chatInputToggle) chatInputToggle.addEventListener('click', toggleChatInput);
  // 「关联页面」开关（默认开）：控制发送时是否自动并入当前页正文
  const chatPageContext = document.getElementById('chatPageContext');
  if (chatPageContext) {
    chrome.storage.local.get('chatPageContext').then((r) => {
      chatPageContext.checked = r.chatPageContext !== false;
    }).catch(() => {});
    chatPageContext.addEventListener('change', () => chrome.storage.local.set({ chatPageContext: !!chatPageContext.checked }).catch(() => {}));
  }
  loadChatMode();
  loadChatSettings();
  // ===== 选区操作条：朗读 / AI处理（+语言） / 加入上下文 =====
  const selReadBtn = document.getElementById('selRead');
  if (selReadBtn) selReadBtn.addEventListener('click', selReadText);
  const selAiBtn = document.getElementById('selAiBtn');
  if (selAiBtn) selAiBtn.addEventListener('click', toggleSelAiMenu);
  const selAddCtxBtn = document.getElementById('selAddCtx');
  if (selAddCtxBtn) selAddCtxBtn.addEventListener('click', selAddToContext);
  document.querySelectorAll('#selAiMenu [data-selproc]').forEach(btn => {
    btn.addEventListener('click', () => selRunProcessor(btn.dataset.selproc));
  });
  // 免费翻译语言：持久化（供选区AI处理 与 主界面免费翻译 共用）
  const selSrcLang = document.getElementById('selSrcLang');
  const selTgtLang = document.getElementById('selTgtLang');
  chrome.storage.local.get(['chatTransSource', 'chatTransTarget']).then((r) => {
    if (selSrcLang && r.chatTransSource) selSrcLang.value = r.chatTransSource;
    if (selTgtLang && r.chatTransTarget) selTgtLang.value = r.chatTransTarget;
  }).catch(() => {});
  if (selSrcLang) selSrcLang.addEventListener('change', () => chrome.storage.local.set({ chatTransSource: selSrcLang.value }).catch(() => {}));
  if (selTgtLang) selTgtLang.addEventListener('change', () => chrome.storage.local.set({ chatTransTarget: selTgtLang.value }).catch(() => {}));
  refreshPageSelection();
  window.addEventListener('focus', refreshPageSelection);
  // 转写标签页：仅页面含音视频时显示；随标签页切换/加载更新
  updateAsrTabVisibility();
  window.addEventListener('focus', updateAsrTabVisibility);
  if (chrome.tabs && chrome.tabs.onActivated) chrome.tabs.onActivated.addListener(() => { updateAsrTabVisibility(); refreshPageSelection(); });
  if (chrome.tabs && chrome.tabs.onUpdated) chrome.tabs.onUpdated.addListener((id, info) => { if (info.status === 'complete' || info.url) updateAsrTabVisibility(); });
  // 语音模式行为（识别后直接发 / 填入文本）
  document.querySelectorAll('input[name="chatVoiceBehavior"]').forEach(radio => {
    radio.addEventListener('change', () => {
      if (!radio.checked) return;
      chatVoiceBehavior = radio.value === 'compose' ? 'compose' : 'direct';
      chrome.storage.local.set({ chatVoiceBehavior }).catch(() => {});
    });
  });
  // i 设置：识别后端 / 朗读引擎 / 系统音色 / 语速（与红区面板、蓝区双向同步）
  const chatAsrBackend = document.getElementById('chatAsrBackend');
  if (chatAsrBackend) chatAsrBackend.addEventListener('change', () => setAsrBackend(chatAsrBackend.value));
  const chatTtsEngine = document.getElementById('chatTtsEngine');
  if (chatTtsEngine) chatTtsEngine.addEventListener('change', () => setTtsEngine(chatTtsEngine.value));
  const chatTtsVoice = document.getElementById('chatTtsVoice');
  if (chatTtsVoice) chatTtsVoice.addEventListener('change', () => {
    const blue = document.getElementById('ttsVoiceBlue');
    if (blue) { blue.value = chatTtsVoice.value; blue.dispatchEvent(new Event('change')); }
  });
  const chatTtsRate = document.getElementById('chatTtsRate');
  if (chatTtsRate) {
    const label = document.getElementById('chatTtsRateLabel');
    chatTtsRate.addEventListener('input', () => { if (label) label.textContent = parseFloat(chatTtsRate.value).toFixed(1); });
    chatTtsRate.addEventListener('change', () => {
      chrome.storage.local.set({ ttsRateSel: parseFloat(chatTtsRate.value) }).catch(() => {});
      const red = document.getElementById('ttsRate');
      if (red) { red.value = chatTtsRate.value; red.dispatchEvent(new Event('change')); }
    });
  }
  // 对话记录折叠
  const voiceOutputToggle = document.getElementById('voiceOutputToggle');
  if (voiceOutputToggle) voiceOutputToggle.addEventListener('click', () => toggleVoiceOutput());
  const voiceOutputClearBtn = document.getElementById('voiceOutputClear');
  // 复制最近一条 AI 回答（统一对话流）
  const copyLastBtn = document.getElementById('voiceCopyLast');
  if (copyLastBtn) copyLastBtn.addEventListener('click', async () => {
    if (!lastAnswerText) { showStatus(I18N.t('noTextToSpeak'), 'info'); return; }
    try {
      await navigator.clipboard.writeText(lastAnswerText);
      showStatus(I18N.t('chatCopied'), 'success');
    } catch (e) {
      showStatus(I18N.t('unknownError'), true);
    }
  });
  // 每条消息的小喇叭：委托点击，朗读该条（提问/回答）；朗读中再点同一条 = 停止
  const voiceOutputContentEl = document.getElementById('voiceOutputContent');
  if (voiceOutputContentEl) voiceOutputContentEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.msg-speak');
    if (!btn) return;
    if (activeSpeakBtn === btn) { stopSpeaking(); return; }
    const msg = btn.closest('.voice-msg');
    if (!msg) return;
    const clone = msg.cloneNode(true);
    clone.querySelectorAll('b, .msg-actions').forEach((n) => n.remove());
    const text = (clone.innerText || clone.textContent || '').trim();
    if (!text) return;
    doSpeak(text, document.getElementById('injectStatus'), btn);
  });
  // 蓝区「LLM 回复朗读」：自动朗读开关（与工作台 🔊 双向同步）+ 回复音色
  const speakAnswerBlue = document.getElementById('aiSpeakAnswerBlue');
  if (speakAnswerBlue) {
    aiSpeakAnswerEnabled().then((on) => { speakAnswerBlue.checked = on; }).catch(() => {});
    speakAnswerBlue.addEventListener('change', async () => {
      await chrome.storage.local.set({ aiSpeakAnswer: !!speakAnswerBlue.checked });
      updateAiSpeakToggleUi(speakAnswerBlue.checked);
    });
  }
  // 流式朗读开关（008 §3）：边生成边分句朗读
  const streamSpeakBlue = document.getElementById('ttsStreamSpeakBlue');
  if (streamSpeakBlue) {
    loadStreamSpeakPref().then(() => { streamSpeakBlue.checked = isStreamSpeakEnabled(); }).catch(() => {});
    streamSpeakBlue.addEventListener('change', () => setStreamSpeakPref(streamSpeakBlue.checked));
  } else {
    loadStreamSpeakPref().catch(() => {});
  }
  const aiSpeakVoiceSel = document.getElementById('aiSpeakVoice');
  if (aiSpeakVoiceSel) {
    aiSpeakVoicePref().then((v) => { aiSpeakVoiceSel.value = v; }).catch(() => {});
    aiSpeakVoiceSel.addEventListener('change', () => chrome.storage.local.set({ aiSpeakVoice: aiSpeakVoiceSel.value }).catch(() => {}));
  }
  if (voiceOutputClearBtn) voiceOutputClearBtn.addEventListener('click', voiceOutputClear);
  renderVoiceOutputState();

  // ===== 运行日志 =====
  const debugLogClearBtn = document.getElementById('debugLogClear');
  if (debugLogClearBtn) debugLogClearBtn.addEventListener('click', debugLogClear);
  logDebug('sys', '日志区就绪');

  // ===== 蓝区：TTS 朗读 / ASR 识别（拆分保存） =====
  const ttsSaveBtn = document.getElementById('ttsSaveBtn');
  if (ttsSaveBtn) ttsSaveBtn.addEventListener('click', saveTtsConfig);
  const asrSaveBtn = document.getElementById('asrSaveBtn');
  if (asrSaveBtn) asrSaveBtn.addEventListener('click', saveAsrConfig);
  const asrConnTestBtn = document.getElementById('asrConnTestBtn');
  if (asrConnTestBtn) asrConnTestBtn.addEventListener('click', testAsrConnection);
  const asrVoiceTestBtn = document.getElementById('asrVoiceTestBtn');
  if (asrVoiceTestBtn) asrVoiceTestBtn.addEventListener('click', toggleAsrVoiceTest);

  // ===== 转写面板（ASR） =====
  const asrRecordBtn = document.getElementById('asrRecord');
  if (asrRecordBtn) asrRecordBtn.addEventListener('click', toggleAsrRecord);
  const asrMicPermBtn = document.getElementById('asrMicPerm');
  if (asrMicPermBtn) asrMicPermBtn.addEventListener('click', openMicPermissionPage);
  const asrMicDeviceSel = document.getElementById('asrMicDevice');
  if (asrMicDeviceSel) asrMicDeviceSel.addEventListener('change', () => {
    currentVoiceConfig.asrMicDeviceId = asrMicDeviceSel.value || '';
    chrome.storage.local.set({ asrMicDeviceId: asrMicDeviceSel.value || '' });
  });
  loadAsrDevices();
  const asrClearBtn = document.getElementById('asrClear');
  if (asrClearBtn) asrClearBtn.addEventListener('click', asrClearResult);
  const asrPageSubsBtn = document.getElementById('asrPageSubs');
  if (asrPageSubsBtn) asrPageSubsBtn.addEventListener('click', asrFetchPageSubtitles);
  // 📁 导入音频（008 §1）：选择文件 → 解码 → 分段 ASR → 填结果框
  const asrImportBtn = document.getElementById('asrImportAudio');
  const asrImportFile = document.getElementById('asrImportFile');
  if (asrImportBtn && asrImportFile) {
    asrImportBtn.addEventListener('click', () => asrImportFile.click());
    asrImportFile.addEventListener('change', (e) => {
      const f = e.target.files && e.target.files[0];
      if (f) asrImportAudioFile(f);
      e.target.value = ''; // 允许重复选择同一文件
    });
  }
  // 🎧 网页音频（007 §3）：捕获当前标签页声音实时转写
  const asrTabAudioBtn = document.getElementById('asrTabAudio');
  if (asrTabAudioBtn) asrTabAudioBtn.addEventListener('click', toggleTabAudioCapture);
  const asrCopyBtn = document.getElementById('asrCopy');
  if (asrCopyBtn) asrCopyBtn.addEventListener('click', asrCopyResult);
  const asrSendTtsBtn = document.getElementById('asrSendTts');
  if (asrSendTtsBtn) asrSendTtsBtn.addEventListener('click', asrSendToTts);
  const asrSendTransBtn = document.getElementById('asrSendTrans');
  if (asrSendTransBtn) asrSendTransBtn.addEventListener('click', asrSendToTrans);
  const asrSendAiBtn = document.getElementById('asrSendAi');
  if (asrSendAiBtn) asrSendAiBtn.addEventListener('click', asrSendToAi);

  // 后端切换
  const asrBackendMap = { asrBackendBrowser: 'browser', asrBackendAzure: 'azure', asrBackendOpenai: 'openai', asrBackendAliyun: 'aliyun', asrBackendLocal: 'local' };
  Object.entries(asrBackendMap).forEach(([id, backend]) => {
    const btn = document.getElementById(id);
    if (btn) btn.addEventListener('click', () => setAsrBackend(backend));
  });
  // 注入站点选择持久化：重开侧边栏/重载扩展后恢复用户上次的选择（否则会重置回 ChatGPT）
  //（injectSiteSel 已在上方声明并绑定 syncAiBackendUi）
  if (injectSiteSel) {
    const INJECT_SITES = ['chatgpt', 'claude', 'kimi', 'deepseek'];
    chrome.storage.local.get('injectSite').then((r) => {
      if (r.injectSite && INJECT_SITES.includes(r.injectSite)) injectSiteSel.value = r.injectSite;
      refreshInjectCapBadges(); // 站点就绪后按声明 + 运行时探测渲染能力徽章
    }).catch(() => { refreshInjectCapBadges(); });
    injectSiteSel.addEventListener('change', () => {
      chrome.storage.local.set({ injectSite: injectSiteSel.value }).catch(() => {});
    });
  } else {
    refreshInjectCapBadges();
  }
  const bmMaxVersionsSave = document.getElementById('bmMaxVersionsSave');
  if (bmMaxVersionsSave) bmMaxVersionsSave.addEventListener('click', saveBmMaxVersions);
  const histMaxVersionsSave = document.getElementById('histMaxVersionsSave');
  if (histMaxVersionsSave) histMaxVersionsSave.addEventListener('click', saveHistMaxVersions);

  // ===== 蓝层：数据管理 =====
  const clearSnapshotsBtn = document.getElementById('clearSnapshots');
  if (clearSnapshotsBtn) clearSnapshotsBtn.addEventListener('click', clearSnapshotsData);
  const clearBookmarkVersionsBtn = document.getElementById('clearBookmarkVersions');
  if (clearBookmarkVersionsBtn) clearBookmarkVersionsBtn.addEventListener('click', clearBookmarkVersionsData);
  const clearHistoryVersionsBtn = document.getElementById('clearHistoryVersions');
  if (clearHistoryVersionsBtn) clearHistoryVersionsBtn.addEventListener('click', clearHistoryVersionsData);

  // ===== 蓝层：定时保存快照 =====
  const autoSaveIntervalSave = document.getElementById('autoSaveIntervalSave');
  if (autoSaveIntervalSave) autoSaveIntervalSave.addEventListener('click', saveAutoSaveInterval);
  const autoSaveIntervalSel = document.getElementById('autoSaveInterval');
  if (autoSaveIntervalSel) {
    autoSaveIntervalSel.addEventListener('change', () => {
      const t = autoSaveTimeInput();
      if (t) t.hidden = autoSaveIntervalSel.value !== 'daily';
    });
  }

  // ===== 蓝层：关于（反馈 / 评价弹窗） =====
  const aboutFeedback = document.getElementById('aboutFeedback');
  if (aboutFeedback) aboutFeedback.addEventListener('click', () => openAboutModal('feedback'));
  const aboutReview = document.getElementById('aboutReview');
  if (aboutReview) aboutReview.addEventListener('click', () => openAboutModal('review'));
  const aboutModalClose = document.getElementById('aboutModalClose');
  if (aboutModalClose) aboutModalClose.addEventListener('click', closeAboutModal);
  const aboutModal = document.getElementById('aboutModal');
  if (aboutModal) {
    aboutModal.addEventListener('click', (e) => { if (e.target === aboutModal) closeAboutModal(); });
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && aboutModal && !aboutModal.classList.contains('hidden')) closeAboutModal();
  });

  // ===== 语言切换（汉/EN） =====
  const btnLang = document.getElementById('btnLang');
  if (btnLang) btnLang.addEventListener('click', () => I18N.toggle());

  // ===== 能力自动回退开关（识别/LLM/朗读 三卡内） =====
  [['capAutoTts', 'capAutoTts'], ['capAutoAsr', 'capAutoAsr'], ['capAutoLlm', 'capAutoLlm']].forEach(([id, key]) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', () => chrome.storage.local.set({ [key]: !!el.checked }).catch(() => {}));
  });
  // 能力来源维度标签页（识别/LLM/朗读）
  document.querySelectorAll('.cap-tab').forEach(btn => {
    btn.addEventListener('click', () => switchCapTab(btn.getAttribute('data-captab')));
  });

  // ===== 初始数据加载（语言切换后由 I18N 触发 refreshAll 重渲染） =====
  I18N.onApply(refreshAll);
  I18N.init().then(() => console.log('i18n ready'));
});

// 语言切换 / 首次加载时：重新渲染全部动态列表，保证文案随语言更新
function refreshAll() {
  populateVoices();
  syncCardSampleLang();
  Promise.all([
    loadStats().catch(e => console.error(e)),
    renderInjectHistory().catch(e => console.error(e)),
    loadBridgeTokenSetting().catch(e => console.error(e)),
    loadInjectSwitchState().catch(e => console.error(e)),
    loadVersionSettings().catch(e => console.error(e)),
    loadAiConfig().catch(e => console.error(e)),
    loadVoiceConfig().catch(e => console.error(e)),
    loadCapabilityAutos().catch(e => console.error(e)),
    loadAutoSaveSettings().catch(e => console.error(e)),
    initCardFonts().catch(e => console.error(e))
  ]).then(() => { console.log('所有数据加载完成'); });
}