// ========== 共享 AI 工具（ai-api.js：域名白名单 / URL 拼接 / SSE 解析） ==========
importScripts('ai-api.js');

// ========== IndexedDB 数据管理 ==========
const DB_NAME = 'TabArchiveDB';
const DB_VERSION = 2;

class TabArchiveDB {
  constructor() {
    this.db = null;
  }

  async open() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('snapshots')) {
          const store = db.createObjectStore('snapshots', { keyPath: 'id' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
        if (!db.objectStoreNames.contains('bookmarkVersions')) {
          const store = db.createObjectStore('bookmarkVersions', { keyPath: 'id' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
        if (!db.objectStoreNames.contains('historyVersions')) {
          const store = db.createObjectStore('historyVersions', { keyPath: 'id' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
        if (!db.objectStoreNames.contains('conversations')) {
          const store = db.createObjectStore('conversations', { keyPath: 'id' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
      request.onsuccess = (event) => {
        this.db = event.target.result;
        resolve(this.db);
      };
      request.onerror = (event) => {
        reject(event.target.error);
      };
    });
  }

  async ensureOpen() {
    if (!this.db) await this.open();
    return this.db;
  }

  async put(storeName, data) {
    const db = await this.ensureOpen();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.put(data);
      request.onsuccess = () => resolve();
      request.onerror = (e) => reject(e.target.error);
    });
  }

  async getAll(storeName) {
    const db = await this.ensureOpen();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = (e) => reject(e.target.error);
    });
  }

  async delete(storeName, id) {
    const db = await this.ensureOpen();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = (e) => reject(e.target.error);
    });
  }

  async clear(storeName) {
    const db = await this.ensureOpen();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = (e) => reject(e.target.error);
    });
  }

  async deleteOldest(storeName, count, keepCount) {
    const db = await this.ensureOpen();
    const all = await this.getAll(storeName);
    if (all.length <= keepCount) return;
    const sorted = all.sort((a, b) => a.timestamp - b.timestamp);
    const toDelete = sorted.slice(0, all.length - keepCount);
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    for (const item of toDelete) {
      store.delete(item.id);
    }
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = (e) => reject(e.target.error);
    });
  }
}

const db = new TabArchiveDB();

// ========== 工具函数 ==========
function generateId(prefix = '') {
  return prefix + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 6);
}

function formatDateNode(timestamp) {
  const d = new Date(timestamp);
  const pad = n => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ========== 核心：捕获快照数据（不关闭标签页） ==========
async function captureSnapshotData() {
  const windows = await chrome.windows.getAll({ populate: true });
  const allTabs = [];
  for (const win of windows) {
    for (const tab of win.tabs) {
      allTabs.push({
        url: tab.url,
        title: tab.title,
        favIconUrl: tab.favIconUrl || '',
        pinned: tab.pinned || false,
        windowId: win.id
      });
    }
  }
  if (allTabs.length === 0) return null;
  const snapshot = {
    id: generateId('snap_'),
    timestamp: Date.now(),
    dateNode: formatDateNode(Date.now()),
    totalTabs: allTabs.length,
    tabs: allTabs.map(t => ({
      url: t.url,
      title: t.title,
      favIconUrl: t.favIconUrl,
      pinned: t.pinned
    }))
  };
  await db.put('snapshots', snapshot);
  return snapshot;
}

// ========== 手动快照（存档 + 关闭标签页） ==========
async function createSnapshot() {
  try {
    const snapshot = await captureSnapshotData();
    if (!snapshot) {
      return { success: false, message: '没有标签页可存档' };
    }
    const windows = await chrome.windows.getAll({ populate: true });
    const tabIdsToClose = [];
    for (const win of windows) {
      for (const tab of win.tabs) {
        tabIdsToClose.push(tab.id);
      }
    }
    await chrome.tabs.create({ url: 'about:blank', active: true });
    for (const tabId of tabIdsToClose) {
      try { await chrome.tabs.remove(tabId); } catch (e) {}
    }
    return { success: true, snapshotId: snapshot.id, totalTabs: snapshot.totalTabs, message: `已存档 ${snapshot.totalTabs} 个标签页` };
  } catch (error) {
    return { success: false, message: '创建快照失败: ' + error.message };
  }
}

// ========== 自动存档（仅保存，不关标签） ==========
let lastAutoRunAt = 0; // 内存防重：避免 alarm 补发与启动补存几乎同时触发而重复存档
async function autoCreateSnapshot() {
  const now = Date.now();
  if (now - lastAutoRunAt < 60000) return; // 1 分钟内跳过重复触发
  lastAutoRunAt = now;
  try {
    const snapshot = await captureSnapshotData();
    if (snapshot) {
      await setSetting('lastAutoSnapshotAt', now); // 记录自动保存时间，供补存判断 / 蓝区展示
      console.log(`[TabU AI] 自动存档完成: ${snapshot.totalTabs} 个标签页`);
    }
  } catch (e) {
    console.warn('[TabU AI] 自动存档失败:', e);
  }
}

// ========== 快照操作 ==========
async function getSnapshots() {
  return await db.getAll('snapshots');
}

async function restoreSnapshot(snapshotId) {
  const snapshots = await db.getAll('snapshots');
  const snapshot = snapshots.find(s => s.id === snapshotId);
  if (!snapshot) return { success: false, message: '快照不存在' };
  const urls = snapshot.tabs.map(t => t.url);
  await chrome.windows.create({ url: urls, focused: true });
  return { success: true, message: `已恢复 ${urls.length} 个标签页` };
}

async function restoreSingleTab(snapshotId, tabUrl) {
  const snapshots = await db.getAll('snapshots');
  const snapshot = snapshots.find(s => s.id === snapshotId);
  if (!snapshot) return { success: false, message: '快照不存在' };
  const tab = snapshot.tabs.find(t => t.url === tabUrl);
  if (!tab) return { success: false, message: '标签页不存在' };
  await chrome.tabs.create({ url: tab.url, active: false });
  return { success: true, message: '已恢复该标签页' };
}

async function deleteSnapshot(snapshotId) {
  await db.delete('snapshots', snapshotId);
  return { success: true };
}

async function clearAllSnapshots() {
  await db.clear('snapshots');
  return { success: true };
}

// ========== 书签/历史版本管理 ==========
function getAllBookmarks(node) {
  let items = [];
  if (node.url) {
    items.push({ title: node.title, url: node.url, dateAdded: node.dateAdded });
  }
  if (node.children) {
    for (const child of node.children) {
      items = items.concat(getAllBookmarks(child));
    }
  }
  return items;
}

async function archiveBookmarks() {
  const tree = await chrome.bookmarks.getTree();
  const bookmarks = getAllBookmarks(tree[0]);
  const version = {
    id: generateId('bmv_'),
    timestamp: Date.now(),
    dateNode: formatDateNode(Date.now()),
    bookmarks: bookmarks
  };
  await db.put('bookmarkVersions', version);
  const keepCount = await getSetting('bookmarkMaxVersions', 20);
  await db.deleteOldest('bookmarkVersions', 0, keepCount);
  return version;
}

async function archiveHistory() {
  const days = await getSetting('historyRetentionDays', 30);
  const startTime = Date.now() - days * 24 * 60 * 60 * 1000;
  const items = await chrome.history.search({
    text: '',
    maxResults: 10000,
    startTime: startTime
  });
  const history = items.map(item => ({
    title: item.title || item.url,
    url: item.url,
    lastVisitTime: item.lastVisitTime
  }));
  const version = {
    id: generateId('hsv_'),
    timestamp: Date.now(),
    dateNode: formatDateNode(Date.now()),
    history: history
  };
  await db.put('historyVersions', version);
  const keepCount = await getSetting('historyMaxVersions', 20);
  await db.deleteOldest('historyVersions', 0, keepCount);
  return version;
}

async function getBookmarkVersions() {
  return await db.getAll('bookmarkVersions');
}

async function getHistoryVersions() {
  return await db.getAll('historyVersions');
}

async function getBookmarkVersion(id) {
  const all = await db.getAll('bookmarkVersions');
  return all.find(v => v.id === id) || null;
}

async function getHistoryVersion(id) {
  const all = await db.getAll('historyVersions');
  return all.find(v => v.id === id) || null;
}

async function deleteBookmarkVersion(id) {
  await db.delete('bookmarkVersions', id);
  return { success: true };
}
async function deleteHistoryVersion(id) {
  await db.delete('historyVersions', id);
  return { success: true };
}
async function clearAllBookmarkVersions() {
  await db.clear('bookmarkVersions');
  return { success: true };
}
async function clearAllHistoryVersions() {
  await db.clear('historyVersions');
  return { success: true };
}

// ========== 设置管理 ==========
async function getSetting(key, defaultValue) {
  const result = await chrome.storage.local.get(key);
  return result[key] !== undefined ? result[key] : defaultValue;
}
async function setSetting(key, value) {
  await chrome.storage.local.set({ [key]: value });
}

// ========== 导出数据 ==========
async function exportAllData() {
  await archiveBookmarks();
  await archiveHistory();

  const snapshots = await db.getAll('snapshots');
  const bookmarkVersions = await db.getAll('bookmarkVersions');
  const historyVersions = await db.getAll('historyVersions');

  const exportData = {
    version: '3.0.0',
    exportDate: new Date().toISOString(),
    snapshots: snapshots,
    bookmarkVersions: bookmarkVersions,
    historyVersions: historyVersions
  };

  const json = JSON.stringify(exportData, null, 2);
  const base64 = btoa(unescape(encodeURIComponent(json)));
  const dataUrl = `data:application/json;base64,${base64}`;
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  await chrome.downloads.download({
    url: dataUrl,
    filename: `tabarchive-full-backup-${timestamp}.json`,
    saveAs: true
  });
  return { success: true };
}

async function getExportDataOnly() {
  await archiveBookmarks();
  await archiveHistory();

  const snapshots = await db.getAll('snapshots');
  const bookmarkVersions = await db.getAll('bookmarkVersions');
  const historyVersions = await db.getAll('historyVersions');

  return {
    version: '3.0.0',
    exportDate: new Date().toISOString(),
    snapshots: snapshots,
    bookmarkVersions: bookmarkVersions,
    historyVersions: historyVersions
  };
}

async function importData(jsonData) {
  try {
    const data = JSON.parse(jsonData);
    if (!data.snapshots || !Array.isArray(data.snapshots)) {
      return { success: false, message: '无效的数据格式：缺少 snapshots' };
    }
    const existingSnapshots = await db.getAll('snapshots');
    const snapMap = new Map(existingSnapshots.map(s => [s.id, s]));
    for (const snap of data.snapshots) {
      if (!snapMap.has(snap.id)) {
        await db.put('snapshots', snap);
        snapMap.set(snap.id, snap);
      }
    }
    if (data.bookmarkVersions && Array.isArray(data.bookmarkVersions)) {
      const existing = await db.getAll('bookmarkVersions');
      const map = new Map(existing.map(v => [v.id, v]));
      for (const v of data.bookmarkVersions) {
        if (!map.has(v.id)) {
          await db.put('bookmarkVersions', v);
          map.set(v.id, v);
        }
      }
    }
    if (data.historyVersions && Array.isArray(data.historyVersions)) {
      const existing = await db.getAll('historyVersions');
      const map = new Map(existing.map(v => [v.id, v]));
      for (const v of data.historyVersions) {
        if (!map.has(v.id)) {
          await db.put('historyVersions', v);
          map.set(v.id, v);
        }
      }
    }
    return { success: true, count: data.snapshots.length };
  } catch (e) {
    return { success: false, message: '导入失败: ' + e.message };
  }
}

// ========== 获取当前书签/历史（用于展示） ==========
async function getRecentBookmarks(limit = 10) {
  const tree = await chrome.bookmarks.getTree();
  const bookmarks = getAllBookmarks(tree[0]);
  bookmarks.sort((a, b) => (b.dateAdded || 0) - (a.dateAdded || 0));
  return bookmarks.slice(0, limit);
}

async function getRecentHistory(limit = 10) {
  const items = await chrome.history.search({
    text: '',
    maxResults: limit,
    startTime: Date.now() - 7 * 24 * 60 * 60 * 1000
  });
  return items.map(item => ({ title: item.title || item.url, url: item.url, lastVisitTime: item.lastVisitTime }));
}

// 全局搜索用：全量书签（live，来自 chrome.bookmarks）
async function getAllLiveBookmarks() {
  const tree = await chrome.bookmarks.getTree();
  return getAllBookmarks(tree[0]);
}

// 全局搜索用：近 30 天历史（live，来自 chrome.history）
async function getSearchHistory(limit = 3000) {
  const items = await chrome.history.search({
    text: '',
    maxResults: limit,
    startTime: Date.now() - 30 * 24 * 60 * 60 * 1000
  });
  return items.map(item => ({ title: item.title || item.url, url: item.url, lastVisitTime: item.lastVisitTime }));
}

// ========== 统计接口 ==========
async function getStats() {
  const snapshots = await db.getAll('snapshots');
  const bmVersions = await db.getAll('bookmarkVersions');
  const histVersions = await db.getAll('historyVersions');
  return {
    snapshots: snapshots.length,
    bookmarkVersions: bmVersions.length,
    historyVersions: histVersions.length
  };
}

// ========== 图标点击 ==========
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ windowId: tab.windowId })
    .catch(err => console.error('打开侧边栏失败:', err));
});

// ========== 定时自动存档（周期可配置 / 固定时刻 + 关机错过补存） ==========
const AUTO_SNAPSHOT_ALARM = 'autoSnapshot';

// 读取自动保存调度 → { mode: 'off' | 'interval' | 'daily', hours?, at? }
async function autoSnapshotSchedule() {
  const dailyAt = await getSetting('autoSnapshotDailyAt', '');
  if (typeof dailyAt === 'string' && /^\d{2}:\d{2}$/.test(dailyAt)) {
    return { mode: 'daily', at: dailyAt };
  }
  const v = await getSetting('autoSnapshotIntervalHours', 12);
  const n = parseInt(v);
  const hours = Number.isFinite(n) && n >= 0 ? n : 12;
  return hours > 0 ? { mode: 'interval', hours } : { mode: 'off' };
}

// 下一个每天固定时刻（本地时间）的触发毫秒数
function nextDailyFireTime(at) {
  const [h, m] = at.split(':').map(Number);
  const next = new Date();
  next.setHours(h, m, 0, 0);
  if (next.getTime() <= Date.now()) next.setDate(next.getDate() + 1); // 今天已过 → 明天
  return next.getTime();
}

// 按当前调度重建 alarm（改设置 / 浏览器启动时调用）
async function setupAutoSnapshotAlarm() {
  await chrome.alarms.clear(AUTO_SNAPSHOT_ALARM);
  const sched = await autoSnapshotSchedule();
  if (sched.mode === 'daily') {
    chrome.alarms.create(AUTO_SNAPSHOT_ALARM, { when: nextDailyFireTime(sched.at), periodInMinutes: 24 * 60 });
  } else if (sched.mode === 'interval') {
    const periodMin = sched.hours * 60;
    chrome.alarms.create(AUTO_SNAPSHOT_ALARM, { periodInMinutes: periodMin, delayInMinutes: periodMin });
  }
  console.log(`[TabU AI] 自动存档已设置：${sched.mode === 'daily' ? '每天 ' + sched.at : sched.mode === 'interval' ? '每 ' + sched.hours + ' 小时' : '关闭'}`);
  return { success: true, ...sched };
}

// 错过补存：打开浏览器时若该保存而没存上，立即补一份（解决定时关机每次都错过保存时间）
async function catchUpAutoSnapshot() {
  try {
    const sched = await autoSnapshotSchedule();
    if (sched.mode === 'off') return;
    const last = await getSetting('lastAutoSnapshotAt', 0);
    if (!last) return; // 尚无自动存档记录，交给首个周期/时刻触发
    let need = false;
    if (sched.mode === 'interval') {
      need = (Date.now() - last) / 3600000 >= sched.hours;
    } else if (sched.mode === 'daily') {
      const [h, m] = sched.at.split(':').map(Number);
      const todaySlot = new Date();
      todaySlot.setHours(h, m, 0, 0);
      const dayStart = new Date();
      dayStart.setHours(0, 0, 0, 0);
      const savedToday = last >= dayStart.getTime();
      const pastSlot = Date.now() > todaySlot.getTime();
      need = !savedToday && pastSlot; // 今天还没保存且已过当天时刻 → 补存
    }
    if (need) {
      await autoCreateSnapshot();
      console.log('[TabU AI] 打开浏览器时检测到错过自动保存，已补存');
    }
  } catch (e) {
    console.warn('[TabU AI] 补存检查失败:', e);
  }
}

chrome.runtime.onInstalled.addListener(async (details) => {
  // ① 生成/复用 device_id（幂等，避免重复安装覆盖），用于 引导→使用→卸载 归因
  let { deviceId } = await chrome.storage.local.get('tabu_device_id');
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    await chrome.storage.local.set({ tabu_device_id: deviceId });
  }
  // ② 设置卸载页（浏览器卸载时自动打开，携带归因参数）
  // 注意：开发态 chrome.runtime.id 是临时 ID；发布到商店后固定。
  //       卸载 URL 必须为 http(s)://，部署 uninstall.html 后把 <your-host> 换成真实地址。
  //       try/catch 兜底：占位地址非法时不阻断安装流程。
  try {
    chrome.runtime.setUninstallURL(
      'https://<your-host>/tabu/uninstall' +
      `?extension_name=tabu&extension_id=${chrome.runtime.id}&device_id=${deviceId}`
    );
  } catch (e) {
    console.warn('[TabU AI] 卸载页 URL 尚未配置，跳过 setUninstallURL:', e.message);
  }
  // ③ 首次安装时打开欢迎页（带归因 + 版本参数）
  if (details.reason === 'install') {
    chrome.tabs.create({
      url: `welcome.html?extension_id=${chrome.runtime.id}&device_id=${deviceId}&version=${chrome.runtime.getManifest().version}`
    });
  }
  setupAutoSnapshotAlarm();
});

// 浏览器启动：确保 alarm 按当前周期存在 + 关机错过时补存
chrome.runtime.onStartup.addListener(() => {
  setupAutoSnapshotAlarm();
  catchUpAutoSnapshot();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === AUTO_SNAPSHOT_ALARM) {
    autoCreateSnapshot();
  }
});

// ========== 选择状态感知：转发给侧边栏（仅转发活动标签页，避免后台标签的选区干扰） ==========
async function relaySelectionState(hasSelection, sender) {
  try {
    const tab = sender && sender.tab;
    if (!tab || tab.id == null) return;
    const active = await chrome.tabs.query({ windowId: tab.windowId, active: true });
    if (!active[0] || active[0].id !== tab.id) return; // 非活动标签页不转发
    try { chrome.runtime.sendMessage({ type: 'selectionState', hasSelection: !!hasSelection, windowId: tab.windowId }); } catch (e) {}
  } catch (e) {}
}

// ========== 截图：捕获当前窗口活动标签页的可见视窗 ==========
async function captureViewport() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return { success: false, message: '未找到当前标签页' };
    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
    return { success: true, dataUrl, title: tab.title || '' };
  } catch (e) {
    return { success: false, message: '当前页面不可截图（chrome:// 内部页、应用商店、PDF 查看器等不支持）' };
  }
}

// ========== 消息监听 ==========
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // 选择状态感知：同步处理，不进入异步 switch（无需 async 响应）
  if (request && request.type === 'selectionState') {
    relaySelectionState(request.hasSelection, sender);
    sendResponse({ ok: true });
    return;
  }
  // 桥接流式增量（来自 askInSite 注入脚本）：转发给桥接服务，无响应
  if (request && request.type === 'bridge_delta' && request.requestId) {
    relayBridgeDelta(request);
    return;
  }
  (async () => {
    try {
      let result;
      switch (request.action) {
        // 快照
        case 'createSnapshot': result = await createSnapshot(); break;
        case 'getSnapshots': result = await getSnapshots(); break;
        case 'restoreSnapshot': result = await restoreSnapshot(request.snapshotId); break;
        case 'restoreSingleTab': result = await restoreSingleTab(request.snapshotId, request.tabUrl); break;
        case 'deleteSnapshot': result = await deleteSnapshot(request.snapshotId); break;
        case 'clearAllSnapshots': result = await clearAllSnapshots(); break;
        // 书签版本
        case 'getBookmarkVersions': result = await getBookmarkVersions(); break;
        case 'getBookmarkVersion': result = await getBookmarkVersion(request.id); break;
        case 'deleteBookmarkVersion': result = await deleteBookmarkVersion(request.id); break;
        case 'clearAllBookmarkVersions': result = await clearAllBookmarkVersions(); break;
        // 历史版本
        case 'getHistoryVersions': result = await getHistoryVersions(); break;
        case 'getHistoryVersion': result = await getHistoryVersion(request.id); break;
        case 'deleteHistoryVersion': result = await deleteHistoryVersion(request.id); break;
        case 'clearAllHistoryVersions': result = await clearAllHistoryVersions(); break;
        // 导出导入
        case 'exportData': result = await exportAllData(); break;
        case 'getExportData': result = await getExportDataOnly(); break;
        case 'importData': result = await importData(request.jsonData); break;
        // 当前书签和历史
        case 'getBookmarks': result = await getRecentBookmarks(request.limit || 10); break;
        case 'getHistory': result = await getRecentHistory(request.limit || 10); break;
        // 全局搜索用：全量书签 + 近 30 天历史
        case 'getAllBookmarks': result = await getAllLiveBookmarks(); break;
        case 'getSearchHistory': result = await getSearchHistory(); break;
        // 设置
        case 'getSetting': result = await getSetting(request.key, request.defaultValue); break;
        case 'setSetting': result = await setSetting(request.key, request.value); break;
        // 用户请求停止当前注入（注入面板「⏹ 停止」/ 圆球问答进行中再点一次）
        case 'cancelInject': injectCancelFlag = true; result = { ok: true }; break;
        case 'rescheduleAutoSnapshot': result = await setupAutoSnapshotAlarm(); break;
        // 统计
        case 'getStats': result = await getStats(); break;
        // 截图（视窗截图）
        case 'captureViewport': result = await captureViewport(); break;
        // 打开侧边栏（欢迎页 / 引导页按钮调用）
        case 'openSidepanel':
          try {
            const win = await chrome.windows.getLastFocused();
            await chrome.sidePanel.open({ windowId: win.id });
            result = { success: true };
          } catch (e) {
            result = { success: false, message: '打开侧边栏失败: ' + e.message };
          }
          break;
        // 注入功能（AI 页面问答）
        case 'injectAsk': result = await injectAskWithSave(request.site, request.prompt, { images: request.images || [] }); break;
        // 自定义 API：测试连接 / 单次调用（openai 兼容或 anthropic 原生）
        case 'askViaApi': result = await askViaApi(request.prompt, request.config, request.history); break;
        // 自定义 API：多轮会话上下文（session + 历史消息）
        case 'aiContext': result = await getAiSessionContext(); break;
        // 自定义 API：重置会话（新对话）
        case 'resetAiSession': result = await resetAiSession(); break;
        // 自定义 API：保存会话历史（sidepanel 流式完成后调用）
        case 'saveAiConversation': result = await saveConversation({ site: 'api', session: request.session, prompt: request.prompt, answer: request.answer }); break;
        case 'newConversation': result = await newConversation(request.site); break;
        case 'getConversations': result = await getConversations(request.limit || 100); break;
        case 'deleteConversation': result = await deleteConversation(request.id); break;
        case 'clearConversations': result = await clearConversations(); break;
        // 麦克风授权（MV3 侧边栏无法弹授权弹窗，须在新标签页可见扩展页触发一次）
        case 'openMicPermission':
          try {
            await chrome.tabs.create({ url: chrome.runtime.getURL('mic-permission.html'), active: true });
            result = { ok: true };
          } catch (e) { result = { success: false, message: '打开授权页失败: ' + e.message }; }
          break;
        default: result = { success: false, message: '未知操作' };
      }
      sendResponse(result);
    } catch (error) {
      sendResponse({ success: false, message: '后台处理错误: ' + error.message });
    }
  })();
  return true;
});

console.log('🧩 TabU AI v' + chrome.runtime.getManifest().version + ' 已启动');

// ========== 终端桥接客户端（TabU AI Bridge） ==========
// 连接本地 bridge/server.js（ws://127.0.0.1:9527）。
// 桥接服务未启动或未配置 Token 时静默重连，不影响其他功能。
const TABU_BRIDGE_WS_URL = 'ws://127.0.0.1:9527';
let bridgeSocket = null;
let bridgeReconnectTimer = null;
let bridgeToken = '';

async function loadBridgeToken() {
  const r = await chrome.storage.local.get('bridgeToken');
  bridgeToken = (r.bridgeToken || '').trim();
}

function connectBridge() {
  if (bridgeSocket) return;
  if (!bridgeToken) return; // 未配置 Token，不连接（保存 Token 后通过 storage 监听触发）
  try {
    bridgeSocket = new WebSocket(TABU_BRIDGE_WS_URL);
    bridgeSocket.onopen = () => {
      try { bridgeSocket.send(JSON.stringify({ type: 'auth', token: bridgeToken })); } catch (e) {}
    };
    bridgeSocket.onmessage = async (ev) => {
      let msg;
      try { msg = JSON.parse(String(ev.data)); } catch (e) { return; }
      if (msg.type === 'auth_ok') {
        console.log('[TabU AI Bridge] 已连接本地桥接服务');
        sendBridgeOrigins(); // 同步设置页里用户添加的网页来源白名单
      } else if (msg.type === 'bridge_info') {
        // 服务端告知实际 HTTP 端口（默认 11434 被占用时会自动顺延），供设置页显示正确地址
        if (msg.httpPort) chrome.storage.local.set({ bridgeHttpPort: msg.httpPort });
      } else if (msg.type === 'auth_error') {
        console.warn('[TabU AI Bridge] Token 认证失败，请检查选项页中的桥接 Token');
        try { bridgeSocket.close(); } catch (e) {}
      } else if (msg.type === 'ask') {
        console.log('[TabU AI Bridge] 收到 ask，问题:', msg.question);
        const result = await handleBridgeAsk(msg.question, { requestId: msg.requestId, stream: !!msg.stream });
        console.log('[TabU AI Bridge] ask 结果:', JSON.stringify(result).slice(0, 200));
        if (bridgeSocket && bridgeSocket.readyState === 1) {
          try { bridgeSocket.send(JSON.stringify({ type: 'ask_result', requestId: msg.requestId, result })); } catch (e) {}
        }
      }
    };
    bridgeSocket.onclose = () => { bridgeSocket = null; scheduleBridgeConnect(5000); };
    bridgeSocket.onerror = () => { try { bridgeSocket.close(); } catch (e) {} };
  } catch (e) {
    scheduleBridgeConnect(10000);
  }
}

function scheduleBridgeConnect(delay) {
  if (bridgeReconnectTimer) return;
  bridgeReconnectTimer = setTimeout(() => {
    bridgeReconnectTimer = null;
    connectBridge();
  }, delay);
}

// 把设置页里用户添加的"网页来源白名单"同步给桥接服务（服务端会持久化到 ~/.tabu-bridge/config.json）
async function sendBridgeOrigins() {
  try {
    const r = await chrome.storage.local.get('bridgeExtraOrigins');
    const origins = String(r.bridgeExtraOrigins || '').split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
    if (origins.length && bridgeSocket && bridgeSocket.readyState === 1) {
      bridgeSocket.send(JSON.stringify({ type: 'set_origins', origins }));
    }
  } catch (e) {}
}

// 页面内 askInSite 在流式回复过程中上报的文本快照 → 转发给桥接服务（由服务端换算增量推 SSE）
function relayBridgeDelta(msg) {
  if (bridgeSocket && bridgeSocket.readyState === 1) {
    try { bridgeSocket.send(JSON.stringify({ type: 'ask_delta', requestId: msg.requestId, text: String(msg.text || '') })); } catch (e) {}
  }
}

// ========== 注入功能：站点适配器 ==========
// ready=false 表示适配器尚未在真实站点核验，注入时直接报"待适配"
const AI_SITES = {
  chatgpt: {
    label: 'ChatGPT',
    ready: true,
    urlPatterns: ['https://chatgpt.com/*', 'https://chat.openai.com/*'],
    newChatUrl: 'https://chatgpt.com/',
    newChatSelectors: [
      'a[href="/"][aria-label*="新对话"]', 'a[href="/"][aria-label*="New chat"]',
      'a[data-testid="new-chat-button"]', 'button[aria-label*="新对话"]', 'button[aria-label*="New chat"]'
    ],
    inputs: ['#prompt-textarea', '[data-testid="prompt-textarea"]', '#prompt-input', 'textarea[data-id="root"]', 'textarea[data-id]', 'form textarea', 'textarea[placeholder*="发送"]', 'textarea[placeholder*="输入"]', 'textarea[placeholder*="essage"]', 'div[contenteditable="true"][role="textbox"]', 'div[contenteditable="true"][data-placeholder]', 'div[contenteditable="true"]', 'textarea:not([disabled])'],
    sends: ['button[data-testid="send-button"]', 'button[aria-label*="发送"]', 'button[aria-label*="Send"]', 'form button[type="submit"]', 'button[type="submit"]'],
    replies: { assistant: '[data-message-author-role="assistant"]' }
  },
  claude: {
    label: 'Claude',
    ready: true,
    urlPatterns: ['https://claude.ai/*'],
    newChatUrl: 'https://claude.ai/new',
    newChatSelectors: [
      'a[href="/new"]', 'button[aria-label*="New chat"]', 'button[aria-label*="新对话"]',
      'button[data-testid="new-chat-button"]', '[role="button"][aria-label*="New chat"]'
    ],
    // 输入为 Lexical / ProseMirror 双版本 contenteditable；回复容器取 data-testid 与 .font-claude-message 双候选
    inputs: [
      'div[contenteditable="true"][role="textbox"]', 'div[contenteditable="true"][data-lexical-editor="true"]',
      'div[data-testid="chat-input"] [contenteditable="true"]', '.ProseMirror[contenteditable="true"]',
      'div[contenteditable="true"]', 'textarea'
    ],
    sends: ['button[aria-label*="Send"]', 'button[aria-label*="发送"]', 'button[data-testid="send-button"]', 'button[type="submit"]'],
    replies: { assistant: '[data-testid="assistant-message"], .font-claude-message, [class*="assistant-message"]' }
  },
  kimi: {
    label: 'Kimi',
    ready: true,
    urlPatterns: ['https://kimi.moonshot.cn/*'],
    newChatUrl: 'https://kimi.moonshot.cn/chat/',
    newChatSelectors: [
      'button[aria-label*="新对话"]', 'button[aria-label*="New chat"]', 'a[href*="/chat/"]',
      '[role="button"][aria-label*="新对话"]'
    ],
    // 输入 textarea/contenteditable 双候选；回复取 assistant 容器 / .markdown 双候选
    inputs: [
      'textarea[placeholder*="输入"]', 'textarea[placeholder*="发送"]', 'div[contenteditable="true"][data-placeholder]',
      'textarea', 'div[contenteditable="true"]'
    ],
    sends: [
      'button[aria-label*="发送"]', 'button[aria-label*="Send"]', 'button[type="submit"]',
      'div[role="button"][aria-label*="发送"]', 'form button[type="submit"]'
    ],
    replies: { assistant: '[class*="assistant"], .markdown, [data-message-role="assistant"]' }
  },
  deepseek: {
    label: 'DeepSeek',
    ready: true,
    urlPatterns: ['https://chat.deepseek.com/*'],
    newChatUrl: 'https://chat.deepseek.com/',
    newChatSelectors: [
      'a[href="/"]', 'button[aria-label*="新对话"]', 'button[aria-label*="New chat"]', '[role="button"][aria-label*="新对话"]'
    ],
    // 输入 textarea；发送常为 div[role=button]；回复 .ds-markdown
    inputs: [
      'textarea[placeholder*="消息"]', 'textarea[placeholder*="输入"]', 'textarea[placeholder*="Message"]',
      'div[contenteditable="true"]', 'textarea'
    ],
    sends: [
      'div[role="button"][aria-label*="发送"]', 'button[aria-label*="发送"]', 'button[aria-label*="Send"]',
      'button[type="submit"]', 'form button[type="submit"]'
    ],
    replies: { assistant: '[class*="ds-markdown"], [class*="markdown"], [data-message-role="assistant"], [class*="assistant"]' }
  }
};

// ========== 注入会话历史（IndexedDB conversations 表） ==========
const CONVERSATIONS_LIMIT = 200;

async function getConversations(limit = 100) {
  const all = await db.getAll('conversations');
  all.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  return all.slice(0, limit);
}

async function saveConversation({ site, prompt, answer, session }) {
  const rec = {
    id: generateId('conv_'),
    timestamp: Date.now(),
    site: site || 'chatgpt',
    prompt: String(prompt || ''),
    answer: String(answer || ''),
    // API 模式多轮会话标记；页面注入的历史无此字段
    session: session || undefined
  };
  await db.put('conversations', rec);
  await db.deleteOldest('conversations', 0, CONVERSATIONS_LIMIT);
  return rec;
}

async function deleteConversation(id) {
  await db.delete('conversations', id);
  return { success: true };
}

async function clearConversations() {
  await db.clear('conversations');
  return { success: true };
}

// ========== 自定义 API 接入（P0-B + P2） ==========
// 读取 AI 服务配置（chrome.storage.local）。未配置 aiBaseUrl = 关闭 API 模式，保持页面注入。

async function getAiConfig() {
  const r = await chrome.storage.local.get(['aiProvider', 'aiBaseUrl', 'aiApiKey', 'aiModel', 'aiAllowAnyHost']);
  return {
    aiProvider: r.aiProvider || 'openai',
    aiBaseUrl: String(r.aiBaseUrl || '').trim(),
    aiApiKey: String(r.aiApiKey || '').trim(),
    aiModel: String(r.aiModel || '').trim(),
    aiAllowAnyHost: !!r.aiAllowAnyHost
  };
}

// 会话 id（多轮跟随）：存 storage，跨 sidepanel 重开存活；未配置则首次调用时生成
async function getOrCreateAiSession() {
  const r = await chrome.storage.local.get('aiSession');
  if (r.aiSession) return r.aiSession;
  const s = 'ses_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  await chrome.storage.local.set({ aiSession: s });
  return s;
}

async function resetAiSession() {
  const s = 'ses_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  await chrome.storage.local.set({ aiSession: s });
  return { success: true, session: s };
}

// 从 conversations 重建某会话的对话历史（user/assistant 交替，供多轮上下文）
async function buildAiHistory(session, maxMessages = 16) {
  try {
    const all = await db.getAll('conversations');
    const inSession = all
      .filter((c) => c.session === session)
      .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    const msgs = [];
    for (const c of inSession.slice(-maxMessages)) {
      if (c.prompt) msgs.push({ role: 'user', content: c.prompt });
      if (c.answer) msgs.push({ role: 'assistant', content: c.answer });
    }
    return msgs;
  } catch (e) {
    return [];
  }
}

async function getAiSessionContext() {
  const session = await getOrCreateAiSession();
  const history = await buildAiHistory(session);
  return { session, history };
}

// 单次（非流式）调用自定义 AI API，返回 { answer } 或 { error }，结构对齐 injectAsk。
// OpenAI 兼容：POST {base}/chat/completions（Bearer）；Anthropic 原生：POST {base}/messages。
async function askViaApi(prompt, config, history) {
  const cfg = normalizeAiConfig(config);
  if (!cfg.baseUrl) return { error: '未配置 Base URL，请在蓝区「💬 LLM 对话」卡填写' };
  if (!cfg.allowAnyHost && !isAllowedAiHost(cfg.baseUrl)) {
    return { error: 'Base URL 不在默认允许列表，如需连接该域名请在蓝区「💬 LLM 对话」卡开启「允许任意域名」' };
  }
  const messages = (history || []).concat([{ role: 'user', content: String(prompt || '') }]);
  // 部分国内提供商默认输出上限偏低，思考型模型会吃满导致答案被截断 → 显式给足
  const needsMaxTokens = ['deepseek', 'kimi', 'chatglm', 'qwen'].includes(cfg.rawProvider);
  const MAX_TOKENS = 8192;
  try {
    let res;
    if (cfg.provider === 'anthropic') {
      res = await fetch(joinApiUrl(cfg.baseUrl, '/messages'), {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': cfg.apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: cfg.model, max_tokens: MAX_TOKENS, messages }),
        signal: AbortSignal.timeout(90000)
      });
    } else {
      const headers = { 'content-type': 'application/json' };
      if (cfg.apiKey) headers['authorization'] = 'Bearer ' + cfg.apiKey;
      const body = { model: cfg.model, messages, stream: false };
      if (needsMaxTokens) body.max_tokens = MAX_TOKENS;
      res = await fetch(joinApiUrl(cfg.baseUrl, '/chat/completions'), {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(90000)
      });
    }
    if (!res.ok) return { error: await readApiErrorText(res) };
    const data = await res.json();
    const answer = cfg.provider === 'anthropic'
      ? (Array.isArray(data.content) ? data.content.map((b) => b.text || '').join('') : (data.content && data.content.text) || '')
      : (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '';
    if (!answer) return { error: 'API 返回为空' + (data.error ? ': ' + data.error.message : '') };
    return { answer: String(answer).trim() };
  } catch (e) {
    return { error: 'API 请求失败: ' + e.message };
  }
}

// 新对话：关闭旧的站点标签页，打开全新页面，并尽力点一次"新对话"（ChatGPT 重开可能恢复上次会话）
async function newConversation(siteKey) {
  const site = AI_SITES[siteKey];
  if (!site) return { success: false, message: '未知站点' };
  // 先探测可达性：不可达时不动现有标签（避免关掉能用的旧页、开一个加载不出来的新页）
  if (!(await probeSiteReachable(site.newChatUrl))) {
    return { success: false, message: '无法访问 ' + site.label + '，请检查网络或代理后再新建对话。' };
  }
  try {
    const tabs = await chrome.tabs.query({ url: site.urlPatterns });
    const ids = tabs.filter(t => t.id != null).map(t => t.id);
    if (ids.length) {
      try { await chrome.tabs.remove(ids); } catch (e) {}
    }
    const tab = await chrome.tabs.create({ url: site.newChatUrl, active: true });
    await new Promise(r => setTimeout(r, 5000)); // 等页面加载
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (selectors) => {
          for (const sel of selectors) {
            const el = document.querySelector(sel);
            if (el) { el.click(); return true; }
          }
          return false;
        },
        args: [site.newChatSelectors]
      });
    } catch (e) {}
    return { success: true, message: '已关闭旧 ' + site.label + ' 页面并打开新对话' };
  } catch (e) {
    return { success: false, message: '新建对话失败: ' + e.message };
  }
}

// 注入并保存历史（带并发锁：同一时间只允许一个注入任务，避免两个请求在同一 AI 页面打架）
// API 模式分流：已配置 aiBaseUrl → 走 askViaApi（忽略 site）；否则页面注入。
let injectLock = false;
let injectLockSince = 0;   // 锁获取时间：超 3 分钟视为异常残留，强制释放
let injectCancelFlag = false; // 用户请求停止当前注入（injectStop / 圆球再点一次）
async function injectAskWithSave(site, prompt, opts = {}) {
  if (injectLock && Date.now() - injectLockSince > 180000) {
    console.warn('[Tab AI] 注入锁超过 3 分钟未释放（异常残留），强制解锁');
    injectLock = false;
  }
  if (injectLock) return { error: '上一条注入还在处理中，请稍候，或点「⏹ 停止」取消它' };
  injectLock = true;
  injectLockSince = Date.now();
  injectCancelFlag = false; // 新任务清除上一次的取消标记
  try {
    const cfg = await getAiConfig();
    if (cfg.aiBaseUrl) {
      const session = await getOrCreateAiSession();
      const history = await buildAiHistory(session);
      const r = await askViaApi(prompt, cfg, history);
      if (r.answer) await saveConversation({ site: 'api', session, prompt, answer: r.answer });
      return r;
    }
    const r = await injectAsk(site, prompt, { allowCreate: true, images: opts.images || [] });
    if (r.answer) {
      await saveConversation({ site, prompt, answer: r.answer });
    }
    return r;
  } finally {
    injectLock = false;
  }
}

// 在 AI 页面提问并返回 { answer } 或 { error }
// 通用实现：按 site 找标签页（找不到则新开），注入 askInSite 等待回复
async function injectAsk(siteKey, prompt, opts = {}) {
  const site = AI_SITES[siteKey];
  if (!site) return { error: '未知站点: ' + siteKey };
  if (!site.ready) return { error: site.label + ' 适配器尚未实现，暂仅支持 ChatGPT' };
  try {
    let tabs = await chrome.tabs.query({ url: site.urlPatterns });
    let tab = tabs.find(t => t.url && !t.discarded) || tabs[0];
    let justCreated = false;
    if (!tab) {
      if (opts.allowCreate === false) return { error: '未找到打开的 ' + site.label + ' 页面，请先打开并登录' };
      if (injectCancelFlag) return { error: '已停止注入' };
      // 新开标签前先探测站点可达性：不可达（如国内直连 ChatGPT）直接失败，
      // 不留下一个永远加载不完的标签页把注入锁卡死
      if (!(await probeSiteReachable(site.newChatUrl))) {
        return { error: '无法访问 ' + site.label + '（' + safeOrigin(site.newChatUrl) + '）。请检查网络或代理后重试，也可在侧边栏「🌐 浏览器版」里切换其它 AI 站点。' };
      }
      tab = await chrome.tabs.create({ url: site.newChatUrl, active: true });
      justCreated = true;
      await new Promise(r => setTimeout(r, 4000)); // 等新标签加载
    }
    const maxAttempts = justCreated ? 8 : 2; // 只有新开的标签才多次重试等待加载
    const deadline = Date.now() + 120000;    // 整体超时：所有重试累计不超过 2 分钟（锁不会无限被占）
    let lastError = '';
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (injectCancelFlag) return { error: '已停止注入' };
      if (Date.now() > deadline) return { error: '注入总超时：' + site.label + ' 页面长时间未就绪，请确认该站点可正常访问。' };
      try {
        // executeScript 兜底限时：页面彻底挂死时不能无限等待（askInSite 内部最长 90s，放宽到 110s）
        const results = await withTimeout(chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: askInSite,
          args: [prompt, site, opts.requestId || '', opts.images || []]
        }), 110000, '注入执行超时（页面未就绪）');
        const out = results && results[0] ? results[0].result : null;
        if (out && out.answer) return { answer: out.answer };
        if (out && out.error) lastError = out.error;
      } catch (e) {
        lastError = '注入失败: ' + e.message;
      }
      if (!justCreated) break; // 已有标签页：直接返回真实错误，避免空转
      await new Promise(r => setTimeout(r, 2500));
    }
    return { error: lastError || '无法在 ' + site.label + ' 页面执行' };
  } catch (e) {
    return { error: '扩展侧执行失败: ' + e.message };
  }
}

// Promise 限时包装：超时抛错（原 Promise 继续在后台跑，结果被忽略）
function withTimeout(promise, ms, tag) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, rej) => { timer = setTimeout(() => rej(new Error(tag || 'timeout')), ms); })
  ]).finally(() => clearTimeout(timer));
}

// 站点可达性探测：no-cors 请求 favicon，网络层任何 HTTP 响应（含 403/404）都算可达；
// 超时/断网（GFW 丢包等）→ false。用于新开 AI 标签前快速失败。
async function probeSiteReachable(url, timeoutMs = 6000) {
  try {
    const origin = new URL(url).origin;
    await fetch(origin + '/favicon.ico', { method: 'GET', mode: 'no-cors', cache: 'no-store', signal: AbortSignal.timeout(timeoutMs) });
    return true;
  } catch (e) { return false; }
}

function safeOrigin(url) {
  try { return new URL(url).origin; } catch (e) { return url; }
}

// 桥接专用：ChatGPT 提问。带 requestId 时页面内会在流式回复过程中上报增量（真流式给终端/应用）
async function handleBridgeAsk(question, opts = {}) {
  return injectAsk('chatgpt', question, { allowCreate: true, requestId: opts.requestId || '' });
}

// 在页面上下文执行：输入问题 → 发送 → 等待流式回复稳定 → 返回完整回答
// adapter 为站点适配器（见 AI_SITES），提供 inputs / sends / replies 选择器
// requestId 非空时（桥接流式请求）：回复增长过程中节流上报文本快照，由后台转发给桥接服务
function askInSite(question, adapter, requestId, images) {
  return new Promise((resolve) => {
    const RESOLVE_TIMEOUT = 90000;
    let finished = false;
    let observer = null;
    const finish = (result) => { if (finished) return; finished = true; if (observer) observer.disconnect(); resolve(result); };

    // 桥接真流式：把"当前已生成的完整文本"节流上报（服务端换算增量）；final answer 走 ask_result 兜底
    let lastSent = '';
    let lastSentAt = 0;
    const reportDelta = (text) => {
      if (!requestId || !text || text === lastSent) return;
      const now = Date.now();
      if (text.length < lastSent.length) return; // 文本回缩异常，不上报
      if (now - lastSentAt < 300) return;        // 节流 300ms，避免消息风暴
      lastSent = text;
      lastSentAt = now;
      try {
        chrome.runtime.sendMessage({ type: 'bridge_delta', requestId, text }, () => void chrome.runtime.lastError);
      } catch (e) {}
    };

    const diag = { inputFound: null, sendFound: null };
    const cfg = adapter || {};

    // 1) 找输入框（多级回退，优先可见的；兼容 textarea 与 contenteditable 两种版本）
    const inputSelectors = (cfg.inputs && cfg.inputs.length) ? cfg.inputs : [
      '#prompt-textarea', '[data-testid="prompt-textarea"]', '#prompt-input',
      'textarea[data-id="root"]', 'textarea[data-id]', 'form textarea',
      'textarea[placeholder*="发送"]', 'textarea[placeholder*="输入"]', 'textarea[placeholder*="essage"]',
      'div[contenteditable="true"][role="textbox"]', 'div[contenteditable="true"][data-placeholder]',
      'div[contenteditable="true"]', 'textarea:not([disabled])'
    ];
    let input = null;
    for (const sel of inputSelectors) {
      const el = document.querySelector(sel);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      diag.inputFound = sel + (r.width > 0 && r.height > 0 ? '' : '(不可见)');
      if (r.width > 0 && r.height > 0) { input = el; break; }
    }
    if (!input) {
      return finish({ error: '未找到 ' + (cfg.label || 'AI') + ' 输入框。已检查: ' + inputSelectors.join(', ') });
    }

    // 记录发送前的基线，避免把旧回复误判成新回复
    const replySelector = (cfg.replies && cfg.replies.assistant) || (typeof cfg.replies === 'string' ? cfg.replies : '[data-message-author-role="assistant"]');
    // 选择器池：适配器选择器优先；若发送后 8s 仍一个元素都匹配不到（站点改版），并入通用候选
    const GENERIC_REPLY_SELECTORS = [
      '[data-message-author-role="assistant"]', '[data-message-role="assistant"]',
      '[class*="ds-markdown"]', '[class*="markdown"]', '[class*="assistant"]', '[class*="message-content"]'
    ];
    let selectorPool = [replySelector];
    const msgs = () => {
      for (const sel of selectorPool) {
        const els = Array.from(document.querySelectorAll(sel));
        if (els.length) return els;
      }
      return [];
    };
    let before = msgs();
    let baselineLast = before.length ? (before[before.length - 1].innerText || '').trim() : '';
    let sentAt = 0;
    let genericFallbackOn = false;

    // 2) 填入问题（React 受控输入需用原生 value setter / 输入事件）
    const insertText = () => {
      if (input.tagName === 'TEXTAREA' || input.tagName === 'INPUT') {
        const proto = input.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
        setter.call(input, question);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        // 部分版本对 value 不敏感，补一个 InputEvent
        input.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, inputType: 'insertText', data: question, isComposing: false }));
      } else {
        // contenteditable（ProseMirror 等）：需要聚焦后 insertText 触发 beforeinput/input
        input.focus();
        const has = () => (input.innerText || input.textContent || '').includes(question.slice(0, 10));
        let ok = false;
        try { ok = document.execCommand('insertText', false, question); } catch (e) {}
        if (!ok || !has()) {
          // 全选后再插入一次
          try {
            const range = document.createRange();
            range.selectNodeContents(input);
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
            ok = document.execCommand('insertText', false, question);
          } catch (e) {}
          if (!ok || !has()) {
            input.textContent = question;
            input.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, inputType: 'insertText', data: question, isComposing: false }));
          }
        }
      }
    };
    insertText();

    // 2.5) 附件图片（005 P1）：以"粘贴"方式注入（ChatGPT/Claude/Kimi 均支持粘贴图片），
    //      失败则回退站点自带的 input[type=file]；每张等待 1.5s 出上传缩略图
    diag.images = 0;
    const dataUrlToFile = (du) => {
      try {
        const m = /^data:([^;]+);base64,(.*)$/.exec(du);
        if (!m) return null;
        const bin = atob(m[2]);
        const arr = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        return new File([arr], 'image', { type: m[1] });
      } catch (e) { return null; }
    };
    const injectImages = async () => {
      for (const img of (images || []).slice(0, 4)) {
        const f = dataUrlToFile(img.dataUrl);
        if (!f) continue;
        let delivered = false;
        try {
          const dt = new DataTransfer();
          dt.items.add(f);
          input.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: dt }));
          delivered = true;
        } catch (e) {}
        if (!delivered) {
          try {
            const fi = document.querySelector('input[type=file]');
            if (fi) {
              const dt2 = new DataTransfer();
              dt2.items.add(f);
              fi.files = dt2.files;
              fi.dispatchEvent(new Event('change', { bubbles: true }));
              delivered = true;
            }
          } catch (e) {}
        }
        if (delivered) diag.images++;
        await new Promise(r => setTimeout(r, 1500));
      }
    };

    // 3) 发送：等发送按钮可用后再点（轮询；随机化间隔防机械特征 —— 002 方案 D）
    const sendSelectors = (cfg.sends && cfg.sends.length) ? cfg.sends : [
      'button[data-testid="send-button"]', 'button[aria-label*="发送"]', 'button[aria-label*="Send"]',
      'form button[type="submit"]', 'button[type="submit"]'
    ];
    const doSend = () => {
      let sent = false;
      for (const sel of sendSelectors) {
        const el = document.querySelector(sel);
        if (el && !el.disabled) { diag.sendFound = sel; el.click(); sent = true; break; }
        if (el) diag.sendFound = sel + '(禁用)';
      }
      if (!sent) {
        // 回退：Enter
        diag.sendFound = diag.sendFound || '未找到(已用Enter)';
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true }));
      }
      sentAt = Date.now();
      // 已有会话但适配器选择器全空（站点改版）时：发送瞬间重取基线（旧消息已在、新回复未出），
      // 否则通用兜底选择器匹配到的整个历史都会被当成"新回复"
      if (!before.length) {
        const nowMsgs = msgs();
        if (nowMsgs.length) {
          before = nowMsgs;
          baselineLast = (before[before.length - 1].innerText || '').trim();
        }
      }
    };
    let sendAttempts = 0;
    const trySendLoop = () => {
      sendAttempts++;
      const btn = document.querySelector(sendSelectors.join(','));
      if (btn && !btn.disabled) { doSend(); return; }
      if (sendAttempts <= 8) setTimeout(trySendLoop, 400 + Math.random() * 600); // 随机重试间隔（002 方案 D）
      else doSend(); // 按钮一直不可用就直接回车兜底
    };

    // 4) 等待新回复稳定（流式结束判定）——观察者与超时在附件图片注入完成后才启动，
    //    避免上传耗时挤占 90s 等待窗口
    // 兼容两种 DOM 行为：a) 复用同一元素更新 innerText；b) 新增多个元素
    // 结束判定：文本稳定 ≥1.5s 且「停止生成」按钮已消失（思考链与正式回答之间的停顿不会误判）
    let lastText = '';
    let stableSince = 0;
    const stopSelectors = [
      'button[data-testid="stop-button"]', 'button[aria-label*="停止"]',
      'button[aria-label*="Stop"]', 'button.stop-button'
    ];
    const generating = () => stopSelectors.some(sel => document.querySelector(sel));
    const check = () => {
      const list = msgs();
      diag.replyCount = list.length;
      // 兜底：发送 8s 后适配器选择器一个元素都没匹配到（站点改版）→ 并入通用候选选择器
      if (!genericFallbackOn && sentAt && Date.now() - sentAt > 8000 && list.length === 0) {
        genericFallbackOn = true;
        selectorPool = selectorPool.concat(GENERIC_REPLY_SELECTORS.filter(s => !selectorPool.includes(s)));
      }
      const newElements = list.slice(before.length);
      // 尽力扣除思维链子块：DeepSeek/Kimi 的折叠思考区、思考摘要等有独立容器时整段去掉，
      // 避免思考内容混进回答（侧边栏显示/朗读/终端桥接都受益）
      const pickText = (el) => {
        let t = (el.innerText || '').trim();
        if (!t) return '';
        try {
          const thinkEl = el.querySelector('[class*="think" i], [class*="reason" i], [class*="thought" i], details');
          if (thinkEl) {
            const tt = (thinkEl.innerText || '').trim();
            if (tt && tt.length < t.length) t = t.replace(tt, '').trim();
          }
        } catch (e) {}
        return t;
      };
      let text = '';
      if (newElements.length > 0) {
        // 情况 b：有新增元素，拼接所有新增元素的文本；过滤与问题原文相同的元素
        //（通用兜底选择器可能连用户气泡一起匹配到）
        text = newElements.map(pickText).filter(t => t && t !== question).join('\n');
      } else if (list.length > 0) {
        // 情况 a：元素被复用，读最后一个元素的 innerText
        text = pickText(list[list.length - 1]);
      }
      if (!text) return;
      const isNew = list.length > before.length || (text && text !== baselineLast);
      if (!isNew) return;
      if (text !== lastText) { lastText = text; stableSince = Date.now(); reportDelta(text); return; }
      if (!generating() && Date.now() - stableSince > 1500) finish({ answer: text });
    };
    const beginWait = () => {
      observer = new MutationObserver(check);
      observer.observe(document.body, { childList: true, subtree: true, characterData: true });
      // 轮询兜底：停止按钮消失、思考链长停顿等场景下 MutationObserver 可能不再触发
      const pollTimer = setInterval(check, 600);
      // 随机初始延迟后再开始发送轮询（002 方案 D：消除固定节奏特征）
      setTimeout(trySendLoop, 600 + Math.random() * 800);
      setTimeout(() => {
        clearInterval(pollTimer);
        if (lastText) finish({ answer: lastText });
        else finish({ error: '等待 ' + (cfg.label || 'AI') + ' 回复超时。输入框: ' + diag.inputFound + '；发送: ' + (diag.sendFound || '未触发') + '；图片: ' + (diag.images || 0) + '；回复元素: ' + (diag.replyCount || 0) + ' 个（若为 0 说明站点改版、选择器失效）' });
      }, RESOLVE_TIMEOUT);
    };
    // 有附件图片：先粘贴上传完成，再进入发送/等待流程
    Promise.resolve((images && images.length) ? injectImages() : null).then(beginWait, beginWait);
  });
}

// 保持 Service Worker 存活：桥接启用时每 30s 触发一次 alarm，
// 避免 SW 休眠导致 WebSocket 断开、claude 的请求发不到 ChatGPT 页面。
function ensureBridgeKeepAlive() {
  if (bridgeToken) {
    chrome.alarms.create('bridgeKeepAlive', { periodInMinutes: 0.5 });
  } else {
    chrome.alarms.clear('bridgeKeepAlive');
  }
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'bridgeKeepAlive') connectBridge(); // 若断开则自动重连
});

async function bridgeStartup() {
  await loadBridgeToken();
  ensureBridgeKeepAlive();
  if (bridgeToken) connectBridge();
}
bridgeStartup();

// 用户保存/清除 Token 时触发连接或停止保活；来源白名单变更时即时同步给桥接服务
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.bridgeToken) {
    bridgeToken = (changes.bridgeToken.newValue || '').trim();
    ensureBridgeKeepAlive();
    if (bridgeToken) connectBridge();
  }
  if (area === 'local' && changes.bridgeExtraOrigins) sendBridgeOrigins();
});

// ========== 自定义 AI API 后台代理 ==========
// sidepanel 页面受 manifest CSP connect-src 管辖，只能直连白名单域名；
// 用户自定义为其它域名（aiAllowAnyHost）时由 capabilities.askApiStream 改走此端口，
// 在后台 SW 发起请求（受 host_permissions 管辖），SSE 增量经 Port 实时回传。
// 协议：port.postMessage({url, headers, body}) → {delta|reasoning|done|error}；sidepanel 断开 = 中止。
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'tabuApiProxy') return;
  const controller = new AbortController();
  let settled = false;
  const finish = (payload) => {
    if (settled) return;
    settled = true;
    try { port.postMessage(payload); } catch (e) {}
    try { port.disconnect(); } catch (e) {}
  };
  port.onDisconnect.addListener(() => controller.abort());
  port.onMessage.addListener(async (msg) => {
    try {
      const res = await fetch(msg.url, {
        method: 'POST',
        headers: msg.headers || { 'content-type': 'application/json' },
        body: JSON.stringify(msg.body || {}),
        signal: controller.signal
      });
      if (!res.ok) return finish({ error: await readApiErrorText(res) });
      if (!res.body) return finish({ error: '浏览器不支持流式读取' });
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split(/\r?\n\r?\n/);
        buffer = events.pop();
        for (const ev of events) {
          const p = parseSseBlock(ev);
          if (!p) continue;
          if (p.error) return finish({ error: p.error });
          if (p.done) return finish({ done: true });
          if (p.text) { try { port.postMessage({ delta: p.text }); } catch (e) { return; } }
          else if (p.reasoning) { try { port.postMessage({ reasoning: p.reasoning }); } catch (e) { return; } }
        }
      }
      // 冲刷尾部事件与解码器残留
      if (buffer.trim()) {
        const p = parseSseBlock(buffer);
        if (p && p.error) return finish({ error: p.error });
        if (p && p.text) { try { port.postMessage({ delta: p.text }); } catch (e) { return; } }
      }
      const tail = decoder.decode();
      if (tail) { try { port.postMessage({ delta: tail }); } catch (e) { return; } }
      finish({ done: true });
    } catch (e) {
      finish({ error: 'API 请求失败: ' + e.message });
    }
  });
});