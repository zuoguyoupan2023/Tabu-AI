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
        case 'injectAsk': result = await injectAskWithSave(request.site, request.prompt, { images: request.images || [], requestId: request.streamId || '' }); break;
        // 站点能力运行时探测（005 P2）：探测已打开的 AI 页面是否有 file input / 接受图片
        case 'probeSiteCapabilities': result = await probeSiteCapabilities(request.site); break;
        // 站点适配器健康（docs/013 §9）：request.refresh=true 时含 DOM 探测（较慢），否则用缓存
        case 'siteHealth': result = await siteHealthSnapshot(request.refresh === true); break;
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
        // 划词即显（docs/009）：词典/翻译查询 + 发音
        case 'instantDictLookup': result = await instantDictLookup(request); break;
        case 'instantDictSpeak': instantDictSpeak(request.text, request.lang, request.voice); result = { ok: true }; break;
        case 'instantDictAI': result = await instantDictAI(request); break;
        case 'instantDictAudio': result = await instantDictAudio(request); break;
        // 跨帧去重（docs/013 §2.2）：某帧出卡 → 转发同标签页全部帧，同文本旧卡让位（顶帧/最近帧优先）
        case 'instantDictCardShown': {
          try {
            const tabId = sender.tab && sender.tab.id;
            if (tabId != null) {
              chrome.tabs.sendMessage(tabId, { type: 'instantDictCardShown', text: request.text, ts: request.ts, nonce: request.nonce, fromFrame: sender.frameId || 0 }).catch(() => {});
            }
          } catch (e) {}
          result = { ok: true };
          break;
        }
        case 'sidebarClosed': result = await onSidebarClosed(); break;
        case 'reopenAiWindow': result = await reopenAiWindow(request.site); break;
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

// ========== 划词即显（docs/009）：离线词典 + 跨语言词汇对照 + 句子翻译 ==========
// 数据分层：ECDICT 内置子集（data/ecdict-top50k.json.gz，中↔英全卡）→ gtx 词典通道（dt=t/bd/rm，
// 任意语言对基础卡）→ MyMemory 句子兜底。缓存 LRU 200 / TTL 24h，限流 5 次/10s。
const ID_CACHE_MAX = 200, ID_CACHE_TTL = 86400000, ID_RATE_MAX = 5, ID_RATE_WIN = 10000;
const _idCache = new Map(), _idInflight = new Map();
let _idRate = [];

async function idCacheGet(key) {
  let e = _idCache.get(key);
  if (!e) {
    try { e = ((await chrome.storage.session.get('idCache')).idCache || {})[key]; } catch (err) { e = null; }
    if (e) _idCache.set(key, e);
  }
  if (!e || Date.now() - e.at > ID_CACHE_TTL) return null;
  return e.resp;
}
async function idCacheSet(key, resp) {
  const e = { at: Date.now(), resp };
  _idCache.set(key, e);
  while (_idCache.size > ID_CACHE_MAX) _idCache.delete(_idCache.keys().next().value);
  try {
    const o = {};
    for (const [k, v] of _idCache) o[k] = v;
    await chrome.storage.session.set({ idCache: o });
  } catch (err) {}
}

function idRateLimited() {
  const now = Date.now();
  _idRate = _idRate.filter((t) => now - t < ID_RATE_WIN);
  if (_idRate.length >= ID_RATE_MAX) return true;
  _idRate.push(now);
  return false;
}

// ECDICT 懒加载：fetch gzip 资源 → DecompressionStream 解压 → Map
let _ecdictMap = null, _ecdictLoading = null;
function loadEcdict() {
  if (_ecdictMap) return Promise.resolve(_ecdictMap);
  if (_ecdictLoading) return _ecdictLoading;
  _ecdictLoading = (async () => {
    const url = chrome.runtime.getURL('data/ecdict-top50k.json.gz');
    const buf = await (await fetch(url)).arrayBuffer();
    const text = await new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
    _ecdictMap = new Map(Object.entries(JSON.parse(text)));
    return _ecdictMap;
  })();
  _ecdictLoading.catch(() => { _ecdictLoading = null; _ecdictMap = null; });
  return _ecdictLoading;
}
// 中文反向索引（data/ecdict-zh-rev.json.gz）：中文释义词 → 英文词头，zh→en 离线对照用
let _ecdictRev = null, _ecdictRevLoading = null;
function loadEcdictRev() {
  if (_ecdictRev) return Promise.resolve(_ecdictRev);
  if (_ecdictRevLoading) return _ecdictRevLoading;
  _ecdictRevLoading = (async () => {
    const url = chrome.runtime.getURL('data/ecdict-zh-rev.json.gz');
    const buf = await (await fetch(url)).arrayBuffer();
    const text = await new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
    _ecdictRev = new Map(Object.entries(JSON.parse(text)));
    return _ecdictRev;
  })();
  _ecdictRevLoading.catch(() => { _ecdictRevLoading = null; _ecdictRev = null; });
  return _ecdictRevLoading;
}
// 拼音索引（data/ecdict-zh-pinyin.json.gz）：中文词 → 拼音（含声调）。
// gtx `dt=rm` 不可达时离线补 sourceRoman（原词读音），使断网也保留拼音行（docs/009 §11.3）
let _ecdictPy = null, _ecdictPyLoading = null;
function loadEcdictPinyin() {
  if (_ecdictPy) return Promise.resolve(_ecdictPy);
  if (_ecdictPyLoading) return _ecdictPyLoading;
  _ecdictPyLoading = (async () => {
    const url = chrome.runtime.getURL('data/ecdict-zh-pinyin.json.gz');
    const buf = await (await fetch(url)).arrayBuffer();
    const text = await new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
    _ecdictPy = new Map(Object.entries(JSON.parse(text)));
    return _ecdictPy;
  })();
  _ecdictPyLoading.catch(() => { _ecdictPyLoading = null; _ecdictPy = null; });
  return _ecdictPyLoading;
}
// 中文词 → 拼音：与反向索引同形（原词 / 原词+「的」 / 去「的了地」）
async function ecdictPinyinLookup(text) {
  try {
    const py = await loadEcdictPinyin();
    const t = String(text || '').trim();
    for (const key of [t, t + '的', t.replace(/[的了地]$/, '')]) {
      if (key && py.has(key)) return py.get(key);
    }
  } catch (e) {}
  return '';
}

// 中文词 → 英文词头候选：尝试 原词 / 原词+「的」 / 去「的了地」三种形态
async function ecdictRevLookup(text) {
  const rev = await loadEcdictRev();
  const t = text.trim();
  for (const key of [t, t + '的', t.replace(/[的了地]$/, '')]) {
    if (!key) continue;
    const arr = rev.get(key);
    if (arr && arr.length) return arr;
  }
  return [];
}

// 反向索引候选排序（docs/013 §2.4）：名词/动词优先（查词典条目行首词性标记），频率序为稳定次序
async function rankRevCandidates(cands) {
  let map = null;
  try { map = await loadEcdict(); } catch (e) {}
  const scored = cands.map((w, i) => {
    const e = (map && map.get(w)) || ['', '', '', '', ''];
    const zh = String(e[2] || ''), en = String(e[1] || '');
    let score = 0;
    if (/(^|\n)\s*n\./.test(zh) || /(^|\n)\s*n\./.test(en)) score += 2;
    if (/(^|\n)\s*v(i|t)?\./.test(zh) || /(^|\n)\s*v(i|t)?\./.test(en)) score += 1;
    return { word: w, e, score, i };
  });
  scored.sort((a, b) => b.score - a.score || a.i - b.i);
  return scored;
}

// ========== 全量词典 CDN（docs/013 §2.3）：top50k miss → jsDelivr 按首字母拉桶 → IndexedDB 缓存 ==========
// 产物 data/ecdict-full/{a..z,#}.json.gz + manifest.json（tools/build-ecdict-subset.js --full 生成），
// 随开源仓分发、jsDelivr 服务；桶内条目格式与 top50k 一致（词头 → [音标,英释,中释,'',徽标]）。
const ECDICT_CDN_BASE = 'https://cdn.jsdelivr.net/gh/zuoguyoupan2023/Tabu-AI@main/data/ecdict-full/';
const ECDICT_FULL_TIMEOUT = 6000; // 桶下载限时：首次 miss 最坏多等 6s，失败熔断后不再拖慢
let _ecdictFullMeta = null, _ecdictFullFails = 0, _ecdictFullSkipUntil = 0;
const _ecdictFullInflight = new Map();

function idbOpen() {
  return new Promise((resolve, reject) => {
    try {
      const req = indexedDB.open('tabu-ecdict-full', 1);
      req.onupgradeneeded = () => { try { req.result.createObjectStore('buckets'); } catch (e) {} };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('idb open failed'));
    } catch (e) { reject(e); }
  });
}
async function idbGet(key) {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const rq = db.transaction('buckets', 'readonly').objectStore('buckets').get(key);
    rq.onsuccess = () => resolve(rq.result);
    rq.onerror = () => reject(rq.error);
    txCleanup(db);
  });
}
async function idbSet(key, val) {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('buckets', 'readwrite');
    tx.objectStore('buckets').put(val, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    txCleanup(db);
  });
}
async function idbClear() {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('buckets', 'readwrite');
    tx.objectStore('buckets').clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    txCleanup(db);
  });
}
function txCleanup(db) { // 事务完成后关连接（MV3 SW 不宜堆积 IDB 连接）
  setTimeout(() => { try { db.close(); } catch (e) {} }, 0);
}

// CDN manifest（含版本号）；版本变化 → 清空 IndexedDB 旧桶（docs/013 §2.3 版本失效）
async function ecdictFullMeta() {
  if (_ecdictFullMeta) return _ecdictFullMeta;
  const r = await fetch(ECDICT_CDN_BASE + 'manifest.json', { signal: AbortSignal.timeout(ECDICT_FULL_TIMEOUT) });
  if (!r.ok) throw new Error('ecdict-full manifest ' + r.status);
  const meta = await r.json();
  if (!meta || !meta.version) throw new Error('ecdict-full manifest bad');
  let stored = null;
  try { stored = await idbGet('meta'); } catch (e) {}
  if (stored && stored.version && stored.version !== meta.version) { try { await idbClear(); } catch (e) {} }
  if (!stored || stored.version !== meta.version) { try { await idbSet('meta', { version: meta.version }); } catch (e) {} }
  _ecdictFullMeta = meta;
  return meta;
}

function ecdictFullBucketKey(word) {
  const c = String(word || '').toLowerCase().trim()[0] || '#';
  return /[a-z]/.test(c) ? c : '#';
}

// 单桶：IDB 命中即用；未命中限时下载 → 解压 → 入库；并发去重；连败 2 次熔断 10 分钟
async function ecdictFullBucket(letter) {
  if (Date.now() < _ecdictFullSkipUntil) return null;
  const meta = await ecdictFullMeta().catch(() => null);
  if (!meta) return null;
  const key = 'bucket:' + meta.version + ':' + letter;
  const cached = await idbGet(key).catch(() => null);
  if (cached && cached.dict) return cached.dict;
  let p = _ecdictFullInflight.get(key);
  if (!p) {
    p = (async () => {
      const url = ECDICT_CDN_BASE + letter + '.json.gz';
      const resp = await fetch(url, { signal: AbortSignal.timeout(ECDICT_FULL_TIMEOUT) });
      if (!resp.ok) throw new Error('ecdict-full ' + letter + ' ' + resp.status);
      const buf = await resp.arrayBuffer();
      const text = await new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
      const dict = JSON.parse(text);
      try { await idbSet(key, { dict }); } catch (e) {} // 入库失败（隐私模式等）不致命，本次会话内存可用
      _ecdictFullFails = 0;
      return dict;
    })().catch((e) => {
      if (++_ecdictFullFails >= 2) { _ecdictFullSkipUntil = Date.now() + 600000; console.warn('[instantDict] 全量词典 CDN 连败熔断 10 分钟:', e && e.message); }
      return null;
    });
    _ecdictFullInflight.set(key, p);
    setTimeout(() => _ecdictFullInflight.delete(key), 30000);
  }
  return p;
}

// 全量词典查询（与 ecdictLookup 同返回形状）；含词形还原（英文屈折不跨首字母桶）
async function ecdictFullLookup(word) {
  try {
    const w = String(word || '').toLowerCase().trim();
    if (!w || Date.now() < _ecdictFullSkipUntil) return null; // 熔断窗口内跳过
    const dict = await ecdictFullBucket(ecdictFullBucketKey(w));
    if (!dict) return null;
    if (dict[w]) return { word: w, e: dict[w] };
    for (const c of lemmaCandidates(w)) {
      if (ecdictFullBucketKey(c) !== ecdictFullBucketKey(w)) continue;
      if (dict[c]) return { word: c, e: dict[c] };
    }
    return null;
  } catch (e) { return null; }
}

// 词形还原候选（-s/-es/-ed/-ing/-er/-est/-ly/'s + 双写辅音）
function lemmaCandidates(word) {
  const w = word.toLowerCase(), out = [];
  const push = (x) => { if (x && x.length > 1 && !out.includes(x)) out.push(x); };
  const dedouble = (x) => (x.length > 3 && x[x.length - 1] === x[x.length - 2]) ? x.slice(0, -1) : '';
  if (w.endsWith("'s")) push(w.slice(0, -2));
  if (w.endsWith('ies') && w.length > 4) push(w.slice(0, -3) + 'y');
  if (w.endsWith('ing')) { push(w.slice(0, -3)); push(w.slice(0, -3) + 'e'); push(dedouble(w.slice(0, -3)) ); }
  if (w.endsWith('ed')) { push(w.slice(0, -1)); push(w.slice(0, -2)); push(dedouble(w.slice(0, -2))); }
  if (w.endsWith('est')) { push(w.slice(0, -3)); push(w.slice(0, -2)); }
  if (w.endsWith('er')) { push(w.slice(0, -2)); push(w.slice(0, -1)); }
  if (w.endsWith('ly')) push(w.slice(0, -2));
  if (w.endsWith('es') && w.length > 3) push(w.slice(0, -2));
  if (w.endsWith('s') && !w.endsWith('ss') && w.length > 2) push(w.slice(0, -1));
  return out;
}

async function ecdictLookup(word) {
  const map = await loadEcdict();
  const w = word.toLowerCase().trim();
  if (map.has(w)) return { word: w, e: map.get(w) };
  for (const c of lemmaCandidates(w)) {
    if (map.has(c)) return { word: c, e: map.get(c) };
  }
  // 全量词典 CDN（docs/013 §2.3）：top50k miss → 按首字母拉桶（IndexedDB 缓存/熔断）；失败静默回落在线兜底
  return await ecdictFullLookup(w);
}

// 预热：SW 启动即后台解压三份离线资产（词典/反向索引/拼音），首次查询免解压延迟（docs/009 §11.3）
// 防御式：任何同步异常/拒绝都吞掉，绝不影响 SW 注册与其余功能
function idPrewarm() {
  for (const fn of [loadEcdict, loadEcdictRev, loadEcdictPinyin]) {
    try { Promise.resolve(fn()).catch(() => {}); } catch (e) {}
  }
}

// 源语言粗判（决定走 ECDICT 还是 gtx 通道）
function idDetectLang(text) {
  if (/[\u3040-\u30ff]/.test(text)) return 'ja';
  if (/[\uac00-\ud7af]/.test(text)) return 'ko';
  if (/[\u0400-\u04ff]/.test(text)) return 'ru';
  if (/[\u4e00-\u9fff]/.test(text)) return 'zh';
  if (/^[a-zA-Z''\-]+$/.test(text)) return 'en';
  return 'en'; // 其他拉丁文默认按英文尝试（ECDICT miss 后仍有 gtx auto 兜底）
}

// Google gtx 通道：dt=t 翻译 / dt=bd 词典义 / dt=rm 罗马音（dj=1 返回 JSON 对象）
// 熔断器：gtx 连续失败 2 次（如国内网络不可达）→ 5 分钟内直接跳过，避免每次白等超时
let _gtxFails = 0, _gtxDownUntil = 0;
function gtxAvailable() { return Date.now() >= _gtxDownUntil; }
async function gtxFetch(text, sl, tl, dt, timeoutMs) {
  if (!gtxAvailable()) throw new Error('gtx circuit-open');
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(sl || 'auto')}&tl=${encodeURIComponent(tl)}&dt=${dt}&dj=1&q=${encodeURIComponent(text)}`;
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), timeoutMs || 5000);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    if (!r.ok) throw new Error('gtx ' + r.status);
    const j = await r.json();
    _gtxFails = 0;
    return j;
  } catch (e) {
    if (++_gtxFails >= 2) _gtxDownUntil = Date.now() + 300000;
    throw e;
  } finally { clearTimeout(to); }
}
async function gtxTranslate(text, sl, tl) {
  const j = await gtxFetch(text, sl, tl, 't');
  return (j.sentences || []).map((s) => s.trans || '').join('');
}
async function gtxCard(text, sl, tl) {
  try {
    const j = await gtxFetch(text, sl || 'auto', tl, 't&dt=bd&dt=rm', 3000); // docs/012 ③：词查收紧 3s
    const trans = (j.sentences || []).map((s) => s.trans || '').join('');
    if (!trans) throw new Error('empty');
    const dict = Array.isArray(j.dict)
      ? j.dict.slice(0, 2).map((d) => `${d.pos || ''} ${(d.terms || []).slice(0, 4).join('；')}`.trim()).filter(Boolean).join('\n')
      : '';
    const roman = (j.sentences || []).map((s) => s.src_translit || '').filter(Boolean).join(' ');
    return { ok: true, kind: 'entry', tier: 'gtx', source: text, sourceRoman: roman, headword: trans, phonetic: '', gloss: dict, native: '', extra: '' };
  } catch (e) {
    return { ok: false, reason: 'network' };
  }
}

// MyMemory 兜底（gtx 不可达时；长文本按句切块，避开单请求长度限制）
async function mymemoryFetch(text, sl, tl, timeoutMs) {
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${encodeURIComponent(sl + '|' + tl)}`;
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), timeoutMs || 10000);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    const j = await r.json();
    const out = j && j.responseData && j.responseData.translatedText;
    if (!out || /MYMEMORY WARNING|QUERY LENGTH LIMIT|INVALID/i.test(out)) throw new Error('mymemory');
    return out;
  } finally { clearTimeout(to); }
}
async function mymemoryTranslate(text, sl, tl, timeoutMs) {
  const pieces = [];
  let rest = String(text || '').trim();
  if (!rest) return '';
  // 先按句子边界切，超长块再硬切到 450 字符
  const sentences = rest.split(/(?<=[.!?。！？])\s*/);
  let buf = '';
  const flush = () => { if (buf.trim()) pieces.push(buf.trim()); buf = ''; };
  for (const sRaw of sentences) {
    let s = sRaw;
    while (s.length > 450) { flush(); pieces.push(s.slice(0, 450)); s = s.slice(450); }
    if ((buf + ' ' + s).trim().length > 450) flush();
    buf = (buf ? buf + ' ' : '') + s;
  }
  flush();
  const outs = [];
  for (const p of pieces) outs.push(await mymemoryFetch(p, sl, tl, timeoutMs));
  return outs.join(' ');
}

// 用户蓝区所选翻译服务源（translateProvider：auto/mymemory/google，默认 auto）；弹层遵循同一设置
async function idProvider() {
  try {
    const r = await chrome.storage.local.get('translateProvider');
    return r.translateProvider || 'auto';
  } catch (e) { return 'auto'; }
}

async function idWord(text, targetLang, prov, aiAuto) {
  const tl = targetLang === 'zh' ? 'zh-CN' : (targetLang || 'zh-CN');
  const src = idDetectLang(text);
  const toZh = tl.startsWith('zh'), toEn = tl === 'en';
  // 英文词：目标中文 → ECDICT 全卡（离线）；目标英文 → ECDICT 英英卡；miss → gtx/MyMemory 基础卡
  if (src === 'en' && (toZh || toEn)) {
    let hit = null, dictErr = '';
    try { hit = await ecdictLookup(text); } catch (e) { dictErr = e && e.message; } // 词典加载失败不致命 → 走在线兜底
    if (hit) {
      const [phonetic, defEn, defZh, , badge] = hit.e;
      return { ok: true, kind: 'entry', tier: 'ecdict', source: toZh ? text : '', headword: hit.word, phonetic, gloss: defEn, native: toZh ? defZh : '', extra: badge };
    }
    // docs/012 ④：AI 自动详解开启时，词典 miss 立即交由 AI 接管（不再阻塞等 gtx/MyMemory 的慢超时；
    // AI 答案有词级缓存；AI 关闭时维持原链供手动兜底）
    if (aiAuto) return { ok: false, reason: 'miss', detail: dictErr, aiTakeover: true };
    const card = await gtxCard(text, 'en', tl);
    if (card.ok) return card;
    // gtx 不可达 → MyMemory 兜底为译文卡（词典 miss + gtx 挂的最坏情况，无论服务源选择——via 标注如实显示）
    try {
      const trans = await mymemoryTranslate(text, src, tl, 5000); // docs/012 ③：词查收紧 5s
      if (trans) return { ok: true, kind: 'translation', text: trans, via: 'mymemory', source: text, detail: dictErr, aiEligible: true };
    } catch (e) {}
    return { ...card, detail: card.detail || dictErr };
  }
  // 中文词 → 英文：headword 顺序（prov=mymemory 时跳过 gtx）反向索引兜底离线精准命中
  if (src === 'zh' && toEn) {
    let head = '', roman = '', via = 'gtx', alts = [];
    if (prov !== 'mymemory') {
      try {
        const j = await gtxFetch(text, 'zh-CN', 'en', 't&dt=rm', 3000);
        head = (j.sentences || []).map((s) => s.trans || '').join('').trim();
        roman = (j.sentences || []).map((s) => s.src_translit || '').filter(Boolean).join(' ');
      } catch (e) {}
    }
    if (!head) {
      const cands = await ecdictRevLookup(text).catch(() => []);
      if (cands.length) {
        const ranked = await rankRevCandidates(cands); // docs/013 §2.4：名词/动词优先排序
        head = ranked[0].word; via = 'ecdict';
        alts = ranked
          .map((r) => { const [phonetic, defEn, defZh, , badge] = r.e; return { word: r.word, phonetic, defEn, defZh, badge }; })
          .filter((a) => a.word !== head && (a.defZh || a.defEn));
      }
    }
    if (!head) { try { head = (await mymemoryTranslate(text, 'zh-CN', 'en', 5000)).trim(); via = 'mymemory'; } catch (e) {} }
    if (!head) return { ok: false, reason: 'network' };
    // gtx dt=rm 未给出罗马音（不可达/熔断）→ 离线拼音索引补 sourceRoman
    if (!roman) roman = await ecdictPinyinLookup(text);
    let hit = null;
    try { hit = await ecdictLookup(head.split(/\s+/)[0].replace(/[^A-Za-z''-]/g, '') || head); } catch (e) { hit = null; }
    if (hit) {
      const [phonetic, defEn, defZh, , badge] = hit.e;
      return { ok: true, kind: 'entry', tier: 'ecdict', source: text, sourceRoman: roman, headword: hit.word, phonetic, gloss: defEn, native: defZh, extra: badge, alts: alts.length > 1 ? alts : undefined };
    }
    return { ok: true, kind: 'entry', tier: via, source: text, sourceRoman: roman, headword: head, phonetic: '', gloss: '', native: '', extra: '', aiEligible: true, alts: alts.length > 1 ? alts : undefined };
  }
  // 中文词 → 中文目标（同语言）：改查英文对照（学习兜底）；其余语言对 → gtx 基础卡
  if (src === 'zh' && toZh) return await idWord(text, 'en', prov);
  return await gtxCard(text, 'auto', tl);
}

async function idSentence(text, targetLang, prov) {
  const tl = targetLang === 'zh' ? 'zh-CN' : (targetLang || 'zh-CN');
  const sl = idDetectLang(text) === 'zh' ? 'zh-CN' : idDetectLang(text);
  // 1) gtx（主源，熔断保护；用户显式选 mymemory 时跳过，不白等）
  if (prov !== 'mymemory') {
    try {
      const j = await gtxFetch(text, 'auto', tl, 't');
      const trans = (j.sentences || []).map((s) => s.trans || '').join('');
      if (trans) return { ok: true, kind: 'translation', text: trans, via: 'google', source: text };
    } catch (e) {}
  }
  // 2) MyMemory（用户显式选择时为主源；否则为 gtx 不可达兜底）
  try {
    const trans = await mymemoryTranslate(text, sl, tl);
    if (trans) return { ok: true, kind: 'translation', text: trans, via: 'mymemory', source: text };
  } catch (e) {}
  return { ok: false, reason: 'network' };
}

async function instantDictLookup(req) {
  if (idRateLimited()) return { ok: false, reason: 'rate-limited' };
  const key = `${req.mode}:${req.targetLang || ''}:${String(req.text || '').toLowerCase()}`;
  const cached = await idCacheGet(key);
  if (cached) return cached;
  if (_idInflight.has(key)) return _idInflight.get(key);
  const p = (async () => {
    try {
      const prov = await idProvider();
      const resp = req.mode === 'word'
        ? await idWord(String(req.text || ''), req.targetLang, prov, req.aiAuto === true)
        : await idSentence(String(req.text || ''), req.targetLang, prov);
      if (resp && resp.ok) await idCacheSet(key, resp);
      else console.warn('[instantDict] 查询失败:', JSON.stringify(resp), req.mode, JSON.stringify(req.text || '').slice(0, 60));
      return resp || { ok: false, reason: 'network' };
    } catch (e) {
      // 任何意外异常都返回结构化错误（否则会变成通用 {success:false}，前端误报"网络不可用"）
      console.warn('[instantDict] 查询异常:', e && e.message);
      return { ok: false, reason: 'network', detail: (e && e.message) || '' };
    }
  })();
  _idInflight.set(key, p);
  try { return await p; } finally { _idInflight.delete(key); }
}

function instantDictSpeak(text, lang, voice) {
  try {
    chrome.tts.stop();
    const opts = { lang: lang || 'en-US', rate: 0.95 };
    if (voice) opts.voiceName = voice;
    chrome.tts.speak(String(text || '').slice(0, 120), opts);
  } catch (e) {}
}

// ========== 划词 AI 详解（docs/009 P3-1）：词典 miss / 基础卡 → 当前 LLM 渠道解释（API 优先，否则页面注入） ==========
function idLangName(tl) {
  return ({ 'zh-CN': '简体中文', zh: '简体中文', en: 'English', ja: '日本語', ko: '한국어', fr: 'Français', de: 'Deutsch', es: 'Español', ru: 'Русский' })[tl] || '简体中文';
}

async function instantDictAI(req) {
  const word = String(req.word || '').trim().slice(0, 80);
  if (!word) return { ok: false, reason: 'ai-empty' };
  const targetLang = req.targetLang || 'zh-CN';
  const key = `ai:${targetLang}:${word.toLowerCase()}`;
  const cached = await idCacheGet(key);
  if (cached) return cached;
  if (_idInflight.has(key)) return _idInflight.get(key);
  const p = (async () => {
    try {
      const cfg = await getAiConfig();
      const tlName = idLangName(targetLang);
      const prompt = [
        `你是词典助手。请解释词汇「${word}」，面向${tlName}使用者。`,
        `要求：1) 用${tlName}简明解释含义（不超过 80 字）；2) 标注常见词性；3) 给 1 个含翻译的例句。`,
        '只输出解释正文，不要标题和客套话。若不是已知词汇，按最可能的含义解释并注明。',
      ].join('\n');
      let resp;
      if (cfg.aiBaseUrl) {
        resp = await askViaApi(prompt, cfg, []); // 无历史：词典解释不受对话上下文污染
      } else {
        const site = await new Promise((res) => chrome.storage.local.get('injectSite', (r) => res(r.injectSite || 'chatgpt')));
        resp = await injectAskWithSave(site, prompt, { save: false }); // 页面注入（免费）；词典查询不进 AI 会话历史
      }
      const text = resp && resp.answer;
      if (text) {
        const out = { ok: true, kind: 'ai', tier: 'llm', text: String(text).trim(), headword: word };
        await idCacheSet(key, out);
        return out;
      }
      return { ok: false, reason: 'ai-fail', detail: (resp && resp.error) || '' };
    } catch (e) {
      return { ok: false, reason: 'ai-fail', detail: (e && e.message) || '' };
    }
  })();
  _idInflight.set(key, p);
  try { return await p; } finally { _idInflight.delete(key); }
}

// ========== 划词真人发音（docs/009 P3-2）：多源兜底链 ==========
// 优先级：① dictionaryapi.dev 真人录音（英文，质量最好，3s 超时）→ ② 有道 dictvoice（国内可达，type=2 美音，中/英/多语都支持）
// 都失败 → 弹层回退 TTS（chrome.tts / Web Speech）。音频统一在 SW 内转 data URL（规避页面 CSP 差异），LRU 缓存。
const _idAudioCache = new Map(); // word → { ok, phonetic, audioDataUrl, example }
let _idDictapiFails = 0, _idDictapiSkipUntil = 0; // dictionaryapi 熔断：连败 2 次 → 5 分钟跳过（源宕机不拖慢每个新词）

async function idAudioFetchDataUrl(url, timeoutMs) {
  const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) return null;
  const ct = res.headers.get('content-type') || '';
  if (ct && !/audio|octet/i.test(ct)) return null; // 防把错误页当音频
  const buf = new Uint8Array(await res.arrayBuffer());
  if (!buf.length || buf.length > 400000) return null;
  let bin = '';
  for (let i = 0; i < buf.length; i += 8192) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 8192));
  return 'data:audio/mpeg;base64,' + btoa(bin);
}

// ① dictionaryapi.dev：真人录音 + 音标 + 例句（仅英文；3s API / 5s 音频超时）
async function idAudioFromDictionaryapi(word) {
  try {
    const res = await fetch('https://api.dictionaryapi.dev/api/v2/entries/en/' + encodeURIComponent(word), { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return { ok: false };
    const entries = await res.json();
    const e0 = Array.isArray(entries) && entries[0];
    if (!e0) return { ok: false };
    let phonetic = String(e0.phonetic || (e0.phonetics || []).find((x) => x.text)?.text || '');
    let audioUrl = '';
    for (const ph of e0.phonetics || []) { if (ph.audio) { audioUrl = ph.audio; if (ph.text && !phonetic) phonetic = ph.text; break; } }
    let example = '';
    for (const m of e0.meanings || []) {
      for (const d of m.definitions || []) { if (!example && d.example) example = d.example; }
    }
    let audioDataUrl = audioUrl ? (await idAudioFetchDataUrl(audioUrl.startsWith('//') ? 'https:' + audioUrl : audioUrl, 5000)) || '' : '';
    return (audioDataUrl || phonetic || example) ? { ok: true, phonetic, audioDataUrl, example } : { ok: false };
  } catch (e) {
    return { ok: false };
  }
}

// ② 有道 dictvoice：国内可达，英文 type=2 美音，中文/其他语言直接 audio=词
async function idAudioFromYoudao(word) {
  try {
    const audioDataUrl = await idAudioFetchDataUrl('https://dict.youdao.com/dictvoice?type=2&audio=' + encodeURIComponent(word), 3000);
    return audioDataUrl ? { ok: true, phonetic: '', audioDataUrl, example: '' } : { ok: false };
  } catch (e) {
    return { ok: false };
  }
}

async function instantDictAudio(req) {
  const word = String(req.word || '').trim();
  const isEn = /^[a-zA-Z][a-zA-Z'’\- ]{0,40}$/.test(word);
  const isZh = /^[\u4e00-\u9fff]{1,8}$/.test(word);
  if (!isEn && !isZh) return { ok: false };
  const key = word.toLowerCase();
  const hit = _idAudioCache.get(key);
  if (hit) return hit;
  let out = { ok: false };
  if (isEn) {
    // ① dictionaryapi 真人录音（可达时优先）；连败 2 次熔断 5 分钟——沿用 gtx 熔断模式
    if (Date.now() >= _idDictapiSkipUntil) {
      out = await idAudioFromDictionaryapi(word.toLowerCase());
      if (out.ok) _idDictapiFails = 0;
      else if (++_idDictapiFails >= 2) { _idDictapiSkipUntil = Date.now() + 300000; console.warn('[instantDict] dictionaryapi 连败熔断 5 分钟'); }
    }
    if (!out.ok) out = await idAudioFromYoudao(word);          // ② 有道 dictvoice（国内稳定兜底）
  } else {
    out = await idAudioFromYoudao(word);                       // 中文词：dictionaryapi 仅英文 → 直接有道
  }
  if (out.ok) {
    if (_idAudioCache.size > 200) _idAudioCache.clear();
    _idAudioCache.set(key, out);
  }
  return out;
}

// SW 启动即预热离线词典（首查免解压等待）；错误静默，不影响未启用该功能的用户
idPrewarm();

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
        const result = await handleBridgeAsk(msg.question, { requestId: msg.requestId, stream: !!msg.stream, site: msg.site, images: msg.images });
        console.log('[TabU AI Bridge] ask 结果:', JSON.stringify(result).slice(0, 200));
        if (bridgeSocket && bridgeSocket.readyState === 1) {
          try { bridgeSocket.send(JSON.stringify({ type: 'ask_result', requestId: msg.requestId, result })); } catch (e) {}
        }
      } else if (msg.type === 'diag') {
        // docs/013 §3：桥接诊断通道（站点能力探测 / 预开站点标签页），结果经 diag_result 回传
        (async () => {
          let result;
          try {
            if (msg.action === 'open') {
              // 测试语义：确保该站点有一个可用标签页即可（不依赖 AI 小窗创建；小窗路径在部分环境会挂起）
              const site = AI_SITES[msg.site];
              if (!site) { result = { ok: false, error: '未知站点: ' + msg.site }; }
              else {
                const steps = { created: false };
                let tabs = await chrome.tabs.query({ url: site.urlPatterns });
                let tab = tabs.find((t) => t.url && !t.discarded) || tabs[0];
                if (!tab) {
                  tab = await chrome.tabs.create({ url: site.newChatUrl, active: false });
                  steps.created = true;
                }
                steps.tabId = tab.id;
                for (let i = 0; i < 12; i++) { // 等页面加载完成（上限 12s）
                  try { const t = await chrome.tabs.get(tab.id); if (t.status === 'complete') break; } catch (e) { break; }
                  await new Promise((r) => setTimeout(r, 1000));
                }
                result = { ok: true, steps };
              }
            } else if (msg.action === 'scan') {
              // docs/013 §3：扫描页面采集精确选择器（发送按钮/附件完成态/文件名元素），供回填 AI_SITES 配置
              const site = AI_SITES[msg.site];
              if (!site) { result = { ok: false, error: '未知站点: ' + msg.site }; }
              else {
                const tabs = await chrome.tabs.query({ url: site.urlPatterns });
                const tab = tabs.find((t) => t.url && !t.discarded) || tabs[0];
                if (!tab || tab.id == null) result = { ok: false, error: '无标签页' };
                else {
                  const r = await withTimeout(chrome.scripting.executeScript({ target: { tabId: tab.id }, func: scanPageForSelectors }), 8000, '扫描超时');
                  result = { ok: true, ...((r && r[0] && r[0].result) || {}) };
                }
              }
            } else if (msg.action === 'health') {
              // docs/013 §9：站点适配器健康快照（refresh=true 含 DOM 探测）
              result = await siteHealthSnapshot(msg.refresh === true);
            } else {
              result = await probeSiteCapabilities(msg.site);
            }
          } catch (e) { result = { ok: false, error: e.message }; }
          try { if (bridgeSocket && bridgeSocket.readyState === 1) bridgeSocket.send(JSON.stringify({ type: 'diag_result', requestId: msg.requestId, result })); } catch (e) {}
        })();
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

// 页面内 askInSite 在流式回复过程中上报的文本快照 → 转发给桥接服务（由服务端换算增量推 SSE），
// 并同步转发给侧边栏，供「注入渠道」边出边显示（008 §2）。
function relayBridgeDelta(msg) {
  const text = String(msg.text || '');
  if (bridgeSocket && bridgeSocket.readyState === 1) {
    try { bridgeSocket.send(JSON.stringify({ type: 'ask_delta', requestId: msg.requestId, text })); } catch (e) {}
  }
  if (msg.requestId) {
    try {
      chrome.runtime.sendMessage({ type: 'injectDeltaPanel', requestId: msg.requestId, text }, () => void chrome.runtime.lastError);
    } catch (e) {}
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
    // 2026-10 起官网迁移至 www.kimi.com（旧 kimi.moonshot.cn 仅跳转，docs/013 §3 实测）
    urlPatterns: ['https://www.kimi.com/*', 'https://kimi.com/*', 'https://kimi.moonshot.cn/*'],
    newChatUrl: 'https://www.kimi.com/',
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
    // docs/013 §3 实测（2026-10-06）：上传 input[type=file] 命中即成功；发送按钮选择器未命中时 Enter 兜底可发
    uploads: ['input[type=file]'],
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
  try {
    // 重开对话 = 零状态：先彻底关掉 AI 小窗（会话随窗口消失），再关闭其它匹配标签，最后重建全新小窗。
    // ＊不做可达性硬拦截（探测对部分站点会误报，实测 DeepSeek）——站点真不可达时新页面自然加载失败，无害。
    if (aiWindowId != null) {
      try { await chrome.windows.remove(aiWindowId); } catch (e) {}
      aiWindowId = null;
    }
    const tabs = await chrome.tabs.query({ url: site.urlPatterns });
    const ids = tabs.filter(t => t.id != null).map(t => t.id);
    if (ids.length) {
      try { await chrome.tabs.remove(ids); } catch (e) {}
    }
    // 独立小窗打开新对话页（复用/重建），不抢当前页面焦点
    const win = await ensureAiWindow(site.newChatUrl);
    const tab = (win && win.tabId != null) ? await chrome.tabs.get(win.tabId) : await chrome.tabs.create({ url: site.newChatUrl, active: false });
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
    return { success: true, message: '已在独立小窗打开新的 ' + site.label + ' 对话页（当前页面未被切换）' };
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
      if (r.answer && opts.save !== false) await saveConversation({ site: 'api', session, prompt, answer: r.answer });
      return r;
    }
    const r = await injectAsk(site, prompt, { allowCreate: true, images: opts.images || [], requestId: opts.requestId || '' });
    if (r.answer && opts.save !== false) {
      await saveConversation({ site, prompt, answer: r.answer });
    }
    return r;
  } finally {
    injectLock = false;
  }
}

// docs/012 ⑤：AI 网页窗口随侧栏生命周期（aiWindowAutoClose，默认关）
// ＊MV3 SW 空闲 ~30s 会被回收，aiWindowId 内存记忆随之丢失——一切判定必须以标签页实况为准（按站点 URL 模式反查）
async function findAiWindows(siteKey) {
  const patterns = siteKey && AI_SITES[siteKey]
    ? (AI_SITES[siteKey].urlPatterns || [])
    : Object.values(AI_SITES).flatMap((s) => s.urlPatterns || []);
  if (!patterns.length) return [];
  const tabs = await chrome.tabs.query({ url: patterns }).catch(() => []);
  const winIds = [];
  for (const t of tabs) {
    if (t.windowId == null || winIds.includes(t.windowId)) continue;
    try {
      const w = await chrome.windows.get(t.windowId);
      if (w.type === 'popup') winIds.push(t.windowId); // 只关 AI 专用小窗，绝不碰正常浏览器标签
    } catch (e) {}
  }
  return winIds;
}

// 侧栏关闭 → 开关开时收 AI 窗；注入进行中跳过（不掐断，窗保留至注入完成）
async function onSidebarClosed() {
  try {
    const r = await chrome.storage.local.get('aiWindowAutoClose');
    if (!r.aiWindowAutoClose) return { ok: true };
    if (injectLock) return { ok: true, deferred: true };
    const winIds = await findAiWindows(); // 全部 AI 站点的 popup 专用窗
    for (const id of winIds) { try { await chrome.windows.remove(id); } catch (e) {} }
    aiWindowId = null;
  } catch (e) {}
  return { ok: true };
}

// 侧栏打开 → 开关开时按站点恢复 AI 窗（ensureAiWindow 幂等：已有窗则复用）
async function reopenAiWindow(siteKey) {
  try {
    const r = await chrome.storage.local.get('aiWindowAutoClose');
    if (!r.aiWindowAutoClose) return { ok: true, skipped: true };
    const site = AI_SITES[siteKey];
    if (!site) return { ok: false, message: '未知站点' };
    await ensureAiWindow(site.newChatUrl);
    return { ok: true };
  } catch (e) {
    return { ok: false, message: (e && e.message) || '' };
  }
}

// 在 AI 页面提问并返回 { answer } 或 { error }
// 通用实现：按 site 找标签页（找不到则新开），注入 askInSite 等待回复
async function injectAsk(siteKey, prompt, opts = {}) {  const site = AI_SITES[siteKey];
  if (!site) return { error: '未知站点: ' + siteKey };
  if (!site.ready) return { error: site.label + ' 适配器尚未实现，暂仅支持 ChatGPT' };
  try {
    let tabs = await chrome.tabs.query({ url: site.urlPatterns });
    let tab = tabs.find(t => t.url && !t.discarded) || tabs[0];
    let justCreated = false;
    if (!tab) {
      if (opts.allowCreate === false) return { error: '未找到打开的 ' + site.label + ' 页面，请先打开并登录' };
      if (injectCancelFlag) return { error: '已停止注入' };
      // 可达性探测仅作参考（favicon/网络策略差异会误报，DeepSeek 实测踩过）：
      // 探测失败只提示不拦截；真不可达时由限时注入链路（110s/次、总 120s）给出明确失败。
      if (!(await probeSiteReachable(site.newChatUrl))) {
        try {
          chrome.runtime.sendMessage({ type: 'injectNote', text: '⚠️ 探测显示 ' + site.label + ' 可能不可达（存在误报），仍将尝试打开执行…' });
        } catch (e) {}
      }
      // 智能策略：无现成 AI 标签 → 自动开独立小窗（可见操作，不占当前页面）；小窗失败退回后台标签
      // 小窗创建在部分环境会长时间挂起（docs/013 §3 实测）→ 8s 超时后复查标签页，再退回后台标签
      let usedAiWindow = false;
      try {
        const win = await withTimeout(ensureAiWindow(site.newChatUrl), 8000, 'AI 小窗创建超时');
        if (win && win.tabId != null) {
          tab = await chrome.tabs.get(win.tabId);
          usedAiWindow = true;
        }
      } catch (e) {}
      if (!tab) {
        const again = await chrome.tabs.query({ url: site.urlPatterns }).catch(() => []);
        tab = again.find((t) => t.url && !t.discarded) || again[0] || null; // 超时后小窗可能迟到创建
      }
      if (!tab) {
        tab = await chrome.tabs.create({ url: site.newChatUrl, active: false });
      }
      justCreated = true;
      try {
        chrome.runtime.sendMessage({ type: 'injectNote', text: usedAiWindow
          ? '已打开 ' + site.label + ' 独立小窗执行（不占当前页面），回答将显示在侧边栏'
          : '已在后台打开 ' + site.label + ' 页面执行，回答将显示在侧边栏' });
      } catch (e) {}
      // 等页面加载完成（上限 10s）：load 事件被墙内资源卡住时不死等，由 injectImmediately + 重试兜底
      for (let i = 0; i < 10; i++) {
        try {
          const t = await chrome.tabs.get(tab.id);
          if (t.status === 'complete') break;
        } catch (e) { break; }
        await new Promise(r => setTimeout(r, 1000));
      }
    }
    const maxAttempts = justCreated ? 8 : 2; // 只有新开的标签才多次重试等待加载
    const deadline = Date.now() + 90000;     // 整体超时 90s（用户反馈 2 分钟不现实）；典型坏页失败 30-40s
    let lastError = '';
    let promoted = false; // 后台打开的标签：首次尝试失败后是否已切换到前台（方案 A 兜底）
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (injectCancelFlag) return { error: '已停止注入' };
      if (Date.now() > deadline) return { error: '注入总超时：' + site.label + ' 页面长时间未就绪，请确认该站点可正常访问。' };
      try {
        // injectImmediately：默认注入会等 document_idle——页面有被墙子资源时 load 永不触发 → 无限等待
        //（实测 ChatGPT "注入执行超时（页面未就绪）"即此因）。改为文档一存在就注入，
        // 输入框未就绪由 askInSite 快速报错 + 外层重试兜底。
        const results = await withTimeout(chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: askInSite,
          args: [prompt, site, opts.requestId || '', opts.images || []],
          injectImmediately: true
        }), 75000, '注入执行超时（页面加载异常）');
        const out = results && results[0] ? results[0].result : null;
        if (out && out.answer) return { answer: out.answer, thinking: out.thinking || '', diag: out.diag || null };
        if (out && out.error) lastError = out.error;
      } catch (e) {
        lastError = '注入失败: ' + e.message;
      }
      // 兜底：后台新建的标签连续失败（≥2 次）或执行超时 → 切到前台重试一次
      //（injectImmediately 后页面水合期会有快速失败，首次失败就切前台会不必要地抢焦点）
      if (justCreated && !promoted && lastError && tab && tab.id != null &&
          (attempt >= 2 || lastError.includes('注入执行超时'))) {
        promoted = true;
        try {
          await chrome.tabs.update(tab.id, { active: true });
          try { chrome.runtime.sendMessage({ type: 'injectNote', text: '后台执行失败，已切换到 ' + site.label + ' 标签页前台重试' }); } catch (e) {}
        } catch (e) {}
      }
      if (!justCreated) break; // 已有标签页：直接返回真实错误，避免空转
      await new Promise(r => setTimeout(r, 2500));
    }
    const tail = (justCreated && lastError) ? (promoted
      ? '（已自动切换到 ' + site.label + ' 前台标签页，请确认站点状态后重试；若站点可手动打开但仍失败，多为页面加载被网络阻断）'
      : '（已在后台打开 ' + site.label + ' 标签页，可手动切换过去确认站点状态后重试；若站点可手动打开但仍失败，多为页面加载被网络阻断）') : '';
    return { error: (lastError || '无法在 ' + site.label + ' 页面执行') + tail };
  } catch (e) {
    return { error: '扩展侧执行失败: ' + e.message };
  }
}

// 站点能力探测（005 P2）：若有该站点的已打开标签，注入探测函数读取是否有 file input / 接受图片。
// 页面不存在则返回 { present: false }，由侧边栏回退到适配器静态声明。
async function probeSiteCapabilities(siteKey) {
  const site = AI_SITES[siteKey];
  const browser = (() => { try { return /Edg\//.test(navigator.userAgent) ? 'Edge' : /Chrome\//.test(navigator.userAgent) ? 'Chrome' : navigator.userAgent.slice(0, 40); } catch (e) { return ''; } })();
  if (!site || !site.ready) return { present: false, browser };
  try {
    const tabs = await chrome.tabs.query({ url: site.urlPatterns });
    const tabInfo = tabs.slice(0, 4).map((t) => ({ url: String(t.url || '').slice(0, 80), status: t.status, discarded: !!t.discarded }));
    const tab = tabs.find(t => t.url && !t.discarded) || tabs[0];
    if (!tab || tab.id == null) return { present: false, browser, tabs: tabInfo };
    const results = await withTimeout(chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: probeCapsInPage
    }), 8000, '能力探测超时');
    const out = results && results[0] ? results[0].result : null;
    return out ? { present: true, browser, tabs: tabInfo, ...out } : { present: false, browser, tabs: tabInfo };
  } catch (e) {
    return { present: false, browser, error: e.message };
  }
}

// 页面内执行（自包含，勿引用外部变量）：探测文件/图片上传能力
// docs/013 §3：额外回报每个 file input 的选择器特征与可见附件按钮，供逐站回填 AI_SITES[site].uploads
function probeCapsInPage() {
  const elSel = (el) => {
    if (!el) return '';
    const tag = el.tagName.toLowerCase();
    if (el.id) return tag + '#' + el.id;
    const testid = el.getAttribute('data-testid');
    if (testid) return tag + '[data-testid="' + testid + '"]';
    const accept = el.getAttribute('accept');
    const cls = String(el.className || '').trim().split(/\s+/).filter(Boolean).slice(0, 3);
    let s = tag;
    if (accept) s += '[accept="' + accept + '"]';
    if (cls.length) s += '.' + cls.map((c) => c.replace(/"/g, '')).join('.');
    return s;
  };
  try {
    const fileInputs = Array.from(document.querySelectorAll('input[type=file]'));
    // accept 为空 = 接受任意文件（含图片）；含 image/ 或 .png/.jpg 等也算
    const acceptsImage = fileInputs.some(i => {
      const a = String(i.getAttribute('accept') || '').toLowerCase().trim();
      return !a || a.includes('image') || /\.(png|jpe?g|gif|webp|bmp|heic|avif)/.test(a);
    });
    const attachBtns = Array.from(document.querySelectorAll(
      'button[aria-label*="attach" i], button[title*="attach" i], button[aria-label*="上传" i], button[aria-label*="附件" i], button[aria-label*="Add file" i], [data-testid*="attach" i], button[aria-label*="Add photos" i]'
    )).slice(0, 6).map((b) => ({ sel: elSel(b), label: b.getAttribute('aria-label') || b.getAttribute('title') || '' }));
    return {
      fileInput: fileInputs.length > 0,
      acceptsImage,
      contentEditable: !!document.querySelector('[contenteditable="true"]'),
      inputs: fileInputs.slice(0, 6).map((i) => ({
        sel: elSel(i),
        accept: String(i.getAttribute('accept') || ''),
        multiple: !!i.multiple,
        visible: (() => { try { const r = i.getBoundingClientRect(); return r.width > 0 && r.height > 0; } catch (e) { return false; } })()
      })),
      attachBtns
    };
  } catch (e) {
    return { fileInput: false, acceptsImage: false, contentEditable: false, inputs: [], attachBtns: [] };
  }
}

// 页面内执行（自包含，勿引用外部变量）：docs/013 §3 扫描采集精确选择器
// 输出：发送按钮候选 / 附件完成态候选（含文件名元素的类名链）/ file input 明细
function scanPageForSelectors() {
  const elSel = (el) => {
    if (!el || !el.tagName) return '';
    const tag = el.tagName.toLowerCase();
    if (el.id) return tag + '#' + el.id;
    const tid = el.getAttribute('data-testid');
    if (tid) return tag + '[data-testid="' + tid + '"]';
    const aria = el.getAttribute('aria-label');
    if (aria) return tag + '[aria-label="' + aria.slice(0, 40) + '"]';
    const cls = String((el.className && el.className.baseVal !== undefined ? el.className.baseVal : el.className) || '').trim().split(/\s+/).filter(Boolean).slice(0, 3);
    return tag + (cls.length ? '.' + cls.join('.') : '');
  };
  const clsChain = (el, depth) => {
    const out = [];
    let cur = el, d = 0;
    while (cur && cur.tagName && d < (depth || 3)) {
      out.push(elSel(cur));
      cur = cur.parentElement; d++;
    }
    return out.join(' < ');
  };
  try {
    const out = { fileInputs: [], sendCandidates: [], attachCandidates: [], fileTextEls: [] };
    document.querySelectorAll('input[type=file]').forEach((i) => {
      if (out.fileInputs.length >= 8) return;
      const r = (() => { try { const b = i.getBoundingClientRect(); return b.width > 0 && b.height > 0; } catch (e) { return false; } })();
      out.fileInputs.push({ sel: elSel(i), accept: String(i.getAttribute('accept') || '').slice(0, 60), multiple: !!i.multiple, visible: r });
    });
    document.querySelectorAll('button, div[role="button"], a[role="button"], [class*="send" i], [aria-label*="send" i], [aria-label*="发送"]').forEach((el) => {
      if (out.sendCandidates.length >= 10) return;
      const r = (() => { try { const b = el.getBoundingClientRect(); return b.width > 0 && b.height > 0; } catch (e) { return false; } })();
      if (!r) return;
      const txt = String(el.innerText || '').replace(/\s+/g, ' ').slice(0, 16);
      out.sendCandidates.push({ sel: elSel(el), disabled: !!el.disabled, text: txt });
    });
    // 附件完成态：文件名文本元素（含 .pdf 或常见附件名）+ 类名链
    const walker = document.createTreeWalker(document.body || document.documentElement, NodeFilter.SHOW_TEXT);
    const seen = new Set();
    let node;
    while ((node = walker.nextNode()) && out.fileTextEls.length < 8) {
      const t = String(node.nodeValue || '').trim();
      if (!/\.(pdf|docx?|pptx?|xlsx?|txt|md|csv|png|jpe?g|webp)\b/i.test(t) || t.length > 80) continue;
      const el = node.parentElement;
      if (!el) continue;
      const chain = clsChain(el, 4);
      if (seen.has(chain)) continue;
      seen.add(chain);
      const r = (() => { try { const b = el.getBoundingClientRect(); return b.width > 0 && b.height > 0; } catch (e) { return false; } })();
      out.fileTextEls.push({ text: t.slice(0, 60), visible: r, chain });
    }
    // 附件/预览类名候选（全局扫描，限 12 条）
    const rx = /attach|file|upload|preview|thumb|chip|document/i;
    const seen2 = new Set();
    document.querySelectorAll('div,span,img').forEach((el) => {
      if (out.attachCandidates.length >= 12) return;
      const cls = String((el.className && el.className.baseVal !== undefined ? el.className.baseVal : el.className) || '');
      const tid = el.getAttribute('data-testid') || '';
      const aria = el.getAttribute('aria-label') || '';
      if (!(rx.test(cls) || rx.test(tid) || rx.test(aria))) return;
      const key = elSel(el);
      if (seen2.has(key)) return;
      seen2.add(key);
      out.attachCandidates.push({ sel: key, tid: tid.slice(0, 40), aria: aria.slice(0, 40) });
    });
    return out;
  } catch (e) {
    return { error: e.message };
  }
}

// Promise 限时包装：超时抛错（原 Promise 继续在后台跑，结果被忽略）
function withTimeout(promise, ms, tag) {  let timer;
  return Promise.race([
    promise,
    new Promise((_, rej) => { timer = setTimeout(() => rej(new Error(tag || 'timeout')), ms); })
  ]).finally(() => clearTimeout(timer));
}

// 站点可达性探测（参考性）：先 HEAD 页面 URL，失败再 GET 重试一次（部分站点/WAF 对 HEAD 挂起，DeepSeek 实测踩过）。
// ＊探测失败不作为硬拦截：实测存在"探测失败但站点可正常打开"的情况，真不可达由限时注入链路给出明确失败。
async function probeSiteReachable(url, timeoutMs = 8000) {
  try {
    await fetch(url, { method: 'HEAD', mode: 'no-cors', cache: 'no-store', signal: AbortSignal.timeout(timeoutMs) });
    return true;
  } catch (e) {}
  try {
    await fetch(url, { method: 'GET', mode: 'no-cors', cache: 'no-store', signal: AbortSignal.timeout(Math.min(timeoutMs, 5000)) });
    return true;
  } catch (e) { return false; }
}

function safeOrigin(url) {
  try { return new URL(url).origin; } catch (e) { return url; }
}

// ========== 站点适配器健康（docs/013 §9）：网络心跳(定时) + DOM 适配(按需) + 桥接故障转移 ==========
// 状态分级：ok=已开页且适配(input 可见) / page=已开页(未做 DOM 探测或 DOM 异常) / idle=可达未开页 / down=不可达。
// 可达性缓存 10 分钟（内存 + storage.session 跨 SW 重启）；DOM 探测仅在侧栏「刷新」时做（避免无谓注入）。
const SITE_HEALTH_ALARM = 'siteHealthCheck';
const SITE_HEALTH_ORDER = ['deepseek', 'kimi', 'claude', 'chatgpt']; // 桥接故障转移顺序：国内可达优先（013 §3 实测）
const SITE_HEALTH_TTL = 600000;
let _siteHealth = {}; // {site: {reach, reachAt, tab, adapted, adaptedAt, lastError}}

async function siteHealthSave() {
  try { await chrome.storage.session.set({ siteHealth: _siteHealth }); } catch (e) {}
}
async function siteHealthLoad() {
  if (Object.keys(_siteHealth).length) return _siteHealth;
  try { _siteHealth = (await chrome.storage.session.get('siteHealth')).siteHealth || {}; } catch (e) { _siteHealth = {}; }
  return _siteHealth;
}

// 可达性刷新（reachOnly=true 时跳过 DOM 探测）；带并发去重
let _siteHealthInflight = null;
async function siteHealthRefresh(refreshDom) {
  if (_siteHealthInflight) return _siteHealthInflight;
  _siteHealthInflight = (async () => {
    const h = await siteHealthLoad();
    const now = Date.now();
    for (const site of Object.values(AI_SITES)) {
      if (!site.ready) continue;
      const key = Object.keys(AI_SITES).find((k) => AI_SITES[k] === site);
      const cur = h[key] || {};
      const stale = !cur.reachAt || now - cur.reachAt > SITE_HEALTH_TTL;
      let reach = cur.reach;
      if (stale || refreshDom) {
        reach = await probeSiteReachable(site.newChatUrl, 6000);
        cur.reach = reach; cur.reachAt = now; cur.lastError = reach ? '' : '网络不可达';
      }
      // 标签页实况（实时查询，不缓存）——信任层级：标签页实况 > DOM 探测 > 网络探测
      //（SW 的 no-cors fetch 在部分环境全挂——实测四站全 false 而页面实际可用，013 §9）
      try {
        const tabs = await chrome.tabs.query({ url: site.urlPatterns });
        const tab = tabs.find((t) => t.url && !t.discarded) || tabs[0] || null;
        cur.tab = !!tab;
        cur.adapted = null;
        if (tab && refreshDom) {
          try {
            const r = await withTimeout(chrome.scripting.executeScript({ target: { tabId: tab.id }, func: probeCapsInPage }), 8000, 'DOM 探测超时');
            const out = r && r[0] && r[0].result;
            // 适配判据：页面里存在输入体系（file input / contenteditable / 任一 file 候选）即认为可注入
            //（DeepSeek 的 file input 不可见但注入全链可用，013 §3 实测——不能用 visible 判）
            cur.adapted = !!(out && (out.fileInput || out.contentEditable || (out.inputs || []).length > 0));
            cur.lastError = cur.adapted ? '' : '页面已开但未找到可用输入框（可能未登录/改版）';
          } catch (e) { cur.adapted = false; cur.lastError = 'DOM 探测失败: ' + e.message; }
        } else if (tab) {
          cur.adapted = (cur.adaptedAt && now - cur.adaptedAt < SITE_HEALTH_TTL) ? cur.adapted : null;
        } else if (cur.reach) {
          cur.lastError = '';
        } else if (stale || refreshDom) {
          cur.lastError = '网络探测不可达（页面未开，可能误报——以实际打开为准）';
        }
        if (cur.adapted !== null && cur.adapted === true) cur.adaptedAt = now;
      } catch (e) { cur.tab = false; }
      h[key] = cur;
    }
    _siteHealth = h;
    await siteHealthSave();
    return h;
  })();
  try { return await _siteHealthInflight; } finally { _siteHealthInflight = null; }
}

// 面向 UI/桥接的健康快照：state ∈ ok | page | idle | down | unknown
// 信任层级：开着的页面 > 网络探测——页面可用时绝不因 fetch 失败标 down（实测 SW fetch 会全挂误报）
async function siteHealthSnapshot(refreshDom) {
  const h = await siteHealthRefresh(!!refreshDom);
  const out = {};
  for (const [key, cur] of Object.entries(h)) {
    let state = 'unknown';
    if (cur.tab) state = cur.adapted === true ? 'ok' : 'page';
    else if (cur.reach === true) state = 'idle';
    else if (cur.reach === false) state = 'down';
    out[key] = {
      state,
      label: AI_SITES[key] ? AI_SITES[key].label : key,
      lastError: cur.lastError || '',
      reachAt: cur.reachAt || 0,
      adaptedAt: cur.adaptedAt || 0
    };
  }
  return out;
}

// 桥接故障转移（docs/013 §9）：请求站点失败 → 按国内可达优先顺序换站重试（总预算 100s，桥接超时 120s 内收口）。
// 健康数据前置过滤：不可达（state=down）的站点直接跳过——否则挂起站点会吃光预算（chatgpt 挂 90s 的教训）。
async function handleBridgeAsk(question, opts = {}) {
  const images = Array.isArray(opts.images)
    ? opts.images.filter((it) => it && typeof it.dataUrl === 'string' && it.dataUrl.startsWith('data:')).slice(0, 6)
    : [];
  const requested = opts.site || 'chatgpt';
  let order = [requested, ...SITE_HEALTH_ORDER.filter((s) => s !== requested)]
    .filter((s, i, a) => AI_SITES[s] && AI_SITES[s].ready && a.indexOf(s) === i);
  const health = await siteHealthSnapshot(false).catch(() => ({}));
  const isDown = (s) => health[s] && health[s].state === 'down';
  const skipped = order.filter((s) => s !== requested && isDown(s));
  order = order.filter((s) => !isDown(s));
  if (!order.includes(requested)) order.push(requested); // 请求站不可达：排到最后兜底（拿真实错误）
  const budget = Date.now() + 100000;
  const errors = skipped.map((s) => (AI_SITES[s] ? AI_SITES[s].label : s) + ': 跳过（健康心跳显示不可达）');
  for (const site of order) {
    if (Date.now() > budget) { errors.push(site + ': 总预算耗尽，剩余站点未尝试'); break; }
    const r = await injectAsk(site, question, { allowCreate: true, requestId: opts.requestId || '', images });
    if (r && r.answer) return { ...r, viaSite: site };
    const err = (r && r.error) || '未知错误';
    errors.push((AI_SITES[site] ? AI_SITES[site].label : site) + ': ' + err);
    // 锁定/用户取消不换站：语义上是"现在不能发"，换站违背用户意图
    if (err.includes('上一条注入还在处理中') || err.includes('已停止注入')) break;
  }
  return { error: '全部站点失败（尝试顺序 ' + order.map((s) => AI_SITES[s] ? AI_SITES[s].label : s).join(' → ') + '）:\n' + errors.join('\n') };
}

// ===== AI 独立小窗（可见操作模式） =====
// 智能策略：已有 AI 标签页 → 直接后台复用（injectAsk 的 query 命中即走这条）；
// 没有现成标签 → 自动开一个独立 popup 小窗（默认定位当前窗口右半屏），用户可亲眼看到 AI 被操作，
// 且可见窗口不受后台定时器节流影响。窗口留着复用，被用户关闭后下次自动重建。
let aiWindowId = null;
const AI_WIN_WIDTH = 560;

async function ensureAiWindow(url) {
  // 懒校验：上次记的窗口还在不在
  if (aiWindowId != null) {
    try {
      await chrome.windows.get(aiWindowId);
    } catch (e) {
      aiWindowId = null; // 已被用户关闭
    }
  }
  // SW 重启会丢 aiWindowId 内存记忆 → 按 URL 模式反查已有 AI 小窗并重新接管（避免重复开窗）
  if (aiWindowId == null) {
    const found = await findAiWindows().catch(() => []);
    if (found.length) aiWindowId = found[0];
  }
  // 窗口还在：复用其中的标签页，按需导航
  if (aiWindowId != null) {
    try {
      const win = await chrome.windows.get(aiWindowId, { populate: true });
      const t = (win.tabs || []).find(t => t && t.id != null);
      if (t) {
        const current = String(t.url || '').split('#')[0];
        const target = String(url).split('#')[0];
        if (current !== target) {
          await chrome.tabs.update(t.id, { url: target, active: true });
          await new Promise(r => setTimeout(r, 800));
        }
        return { windowId: aiWindowId, tabId: t.id };
      }
    } catch (e) {}
    aiWindowId = null; // 窗口异常（无标签等），走重建
  }
  // 创建新小窗：定位到当前（最后聚焦）窗口的右半屏，不抢焦点
  let left, top, height;
  try {
    const cur = await chrome.windows.getLastFocused();
    left = Math.round((cur.left || 0) + Math.max((cur.width || 1200) * 0.55, 320));
    top = (cur.top || 40) + 20;
    height = Math.max((cur.height || 720) - 60, 400);
  } catch (e) {}
  const win = await chrome.windows.create({
    url,
    type: 'popup',
    focused: false,
    width: AI_WIN_WIDTH,
    height,
    left,
    top
  });
  aiWindowId = win.id;
  const tabId = win.tabs && win.tabs[0] ? win.tabs[0].id : null;
  return { windowId: win.id, tabId };
}

// 桥接专用：ChatGPT 提问。带 requestId 时页面内会在流式回复过程中上报增量（真流式给终端/应用）
// 在页面上下文执行：输入问题 → 发送 → 等待流式回复稳定 → 返回完整回答
// adapter 为站点适配器（见 AI_SITES），提供 inputs / sends / replies 选择器
// requestId 非空时（桥接流式请求）：回复增长过程中节流上报文本快照，由后台转发给桥接服务
function askInSite(question, adapter, requestId, images) {
  return new Promise((resolve) => {
    const RESOLVE_TIMEOUT = 60000;
    let finished = false;
    let observer = null;
    const finish = (result) => { if (finished) return; finished = true; if (observer) observer.disconnect(); try { result.diag = { ...diag }; } catch (e) {} resolve(result); };

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

    const diag = { inputFound: null, sendFound: null, uploadFound: null, attachBtn: null, attachSettled: 0, attachTotal: 0 };
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
    // 选择器池多含嵌套匹配（如 wrapper 与其内部 markdown 同时命中）：
    // 只保留"最外层"元素，避免把内层小片段当答案（DeepSeek 曾因此只截到正文最后一段）。
    const topLevel = (els) => els.filter(el => !els.some(o => o !== el && o.contains(el)));
    const topMsgs = () => topLevel(msgs());
    // DOM → Markdown：把 <a href> 保留为 [文本](url)，让引用数字/参考资料成为可点击超链接；
    // 跳过思考块、隐藏节点与脚本；块级元素换行、li 加前缀。
    const domToMarkdown = (root) => {
      let out = '';
      const isThink = (n) => /think|reason|thought/i.test(String(n.className || ''));
      const isHidden = (n) => {
        if (n.hasAttribute && (n.hasAttribute('hidden') || n.getAttribute('aria-hidden') === 'true')) return true;
        const cls = String(n.className || '');
        return /(^|\s)(tooltip|popover|invisible)(\s|$)/i.test(cls);
      };
      const walk = (node) => {
        const linkLabel = (n) => {
          let s = (n.innerText || n.textContent || '').replace(/\s+/g, ' ').trim();
          if (/^[-\s\d]+$/.test(s)) s = s.replace(/[^\d]/g, '');
          return s;
        };
        if (node.nodeType === 3) { out += node.nodeValue || ''; return; }
        if (node.nodeType !== 1) return;
        const tag = node.tagName.toLowerCase();
        if (tag === 'script' || tag === 'style' || tag === 'svg' || tag === 'button' || tag === 'noscript') return;
        if (isThink(node) || isHidden(node)) return;
        if (tag === 'a') {
          const href = node.getAttribute('href') || '';
          const label = linkLabel(node);
          if (/^https?:/i.test(href) && label) { out += '[' + label + '](' + href + ')'; return; }
          for (const c of node.childNodes) walk(c);
          return;
        }
        if (tag === 'sup' || /cite|reference|footnote/i.test(String(node.className || ''))) {
          const url = node.getAttribute('data-url') || node.getAttribute('data-href') || node.getAttribute('data-link') || node.getAttribute('href') || '';
          const label = linkLabel(node);
          if (/^https?:/i.test(url) && label) { out += '[' + label + '](' + url + ')'; return; }
        }
        if (tag === 'br') { out += '\n'; return; }
        if (tag === 'code') { const t = (node.innerText || '').trim(); if (t) out += '`' + t + '`'; return; }
        if (tag === 'strong' || tag === 'b') { out += '**'; for (const c of node.childNodes) walk(c); out += '**'; return; }
        const isBlock = /^(p|div|li|ul|ol|h[1-6]|tr|table|blockquote|pre|section|article|figure)$/.test(tag);
        if (isBlock) out += '\n';
        if (tag === 'li') out += '- ';
        for (const c of node.childNodes) walk(c);
        if (isBlock) out += '\n';
      };
      walk(root);
      return out.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    };
    let before = topMsgs();
    let beforeSet = new Set(before); // 身份基线：避免 index 漂移导致新元素被切掉
    // 基线 markdown：元素被复用时，用"当前 md 去掉基线 md 前缀"得到本轮新增正文，避免把整段历史当答案
    let beforeMd = new Map(before.map(el => [el, domToMarkdown(el)]));
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

    // 2.5) 附件注入（005 P1/P2）：图片走"粘贴"（ChatGPT/Claude/Kimi 支持粘贴图片）；
    //      其它文件（PDF/文档）直接设站点 input[type=file]；每项等待上传（缩略图/进度）后再发送。
    diag.images = 0;
    const dataUrlToFile = (du, name) => {
      try {
        const m = /^data:([^;]+);base64,(.*)$/.exec(du);
        if (!m) return null;
        const bin = atob(m[2]);
        const arr = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        return new File([arr], name || 'file', { type: m[1] || 'application/octet-stream' });
      } catch (e) { return null; }
    };
    // 站点文件 input 选择器池（005 P2 完善：适配器可扩展 uploads；通用候选 + 附件按钮唤醒 + 动态插入兜底）
    const uploadSelectors = (cfg.uploads && cfg.uploads.length) ? cfg.uploads
      : ['input[type=file]', 'input[type="file"]', '[class*="upload" i] input[type=file]',
         'input[accept*="pdf" i]', 'input[accept*="image" i]',
         '[data-testid*="file" i] input[type=file]', '[data-testid*="upload" i] input[type=file]',
         'div[role="dialog"] input[type=file]'];
    // 附件按钮（部分站点点了才往 DOM 插 file input）
    const attachBtnSelectors = ['button[aria-label*="attach" i]', 'button[title*="attach" i]', 'button[aria-label*="上传" i]',
      'button[aria-label*="附件" i]', 'button[aria-label*="Add file" i]', 'button[title*="上传" i]', '[data-testid*="attach" i]'];
    const tryRevealFileInput = async () => {
      for (const sel of attachBtnSelectors) {
        let btn = null;
        try { btn = document.querySelector(sel); } catch (e) {}
        if (btn) {
          try { btn.click(); } catch (e) {}
          diag.attachBtn = sel; // docs/013 §3：记录实际唤醒的附件按钮（真机适配用）
          await new Promise(r => setTimeout(r, 350));
          return true;
        }
      }
      return false;
    };
    const findFileInput = async () => {
      const scan = () => {
        for (const sel of uploadSelectors) {
          try { const el = document.querySelector(sel); if (el) { diag.uploadFound = sel; return el; } } catch (e) {}
        }
        return null;
      };
      let el = scan();
      if (el) return el;
      await tryRevealFileInput(); // 点附件按钮唤醒隐藏 input
      el = scan();
      if (!el) {
        try { el = [...document.querySelectorAll('input[type=file]')].pop() || null; if (el) diag.uploadFound = 'input[type=file]:last'; } catch (e) {} // 动态插入兜底：取最后一个
      }
      return el;
    };
    // 上传完成判定（005 P2）：轮询附件缩略图出现且无进行中进度；未命中信号 → 调用方退回固定等待
    // 站点适配器可覆盖（cfg.attachHints/cfg.uploading，docs/013 §3 实测补充）
    const attachHintSelectors = (cfg.attachHints && cfg.attachHints.length) ? cfg.attachHints : ['[data-testid*="attachment" i]', '[class*="attachment" i]', '[class*="attached" i]',
      '[class*="thumbnail" i]', '[class*="file-preview" i]', 'img[alt*="upload" i]'];
    const uploadingSelectors = (cfg.uploading && cfg.uploading.length) ? cfg.uploading : ['[class*="uploading" i]', '[role="progressbar"]'];
    const waitForUploadSettled = async (isImage) => {
      const cap = isImage ? 4000 : 8000, t0 = Date.now();
      let sawUploading = false;
      const has = (sels) => sels.some((s) => { try { return document.querySelector(s); } catch (e) { return false; } });
      while (Date.now() - t0 < cap) {
        await new Promise(r => setTimeout(r, 200));
        const uploading = has(uploadingSelectors);
        if (uploading) sawUploading = true;
        const hasChip = has(attachHintSelectors);
        if (hasChip && !uploading) return true;                                                  // 缩略图在、进度结束
        if (hasChip && !sawUploading && Date.now() - t0 > (isImage ? 1200 : 2000)) return true;  // 有缩略图且从未见进度
      }
      return false;
    };
    const injectAttachments = async () => {
      for (const item of (images || []).slice(0, 6)) {
        const f = dataUrlToFile(item.dataUrl, item.name);
        if (!f) continue;
        diag.attachTotal++;
        const isImage = /^image\//i.test(f.type);
        let delivered = false;
        // 图片优先粘贴；非图片直接设 file input（粘贴通常不处理文档）
        if (isImage) {
          try {
            const dt = new DataTransfer();
            dt.items.add(f);
            input.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: dt }));
            delivered = true;
          } catch (e) {}
        }
        if (!delivered) {
          try {
            const fi = await findFileInput();
            if (fi) {
              const dt2 = new DataTransfer();
              dt2.items.add(f);
              fi.files = dt2.files;
              fi.dispatchEvent(new Event('change', { bubbles: true }));
              delivered = true;
            }
          } catch (e) {}
        }
        if (!delivered && !isImage) {
          try {
            const dt = new DataTransfer();
            dt.items.add(f);
            input.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: dt }));
            delivered = true;
          } catch (e) {}
        }
        if (delivered) diag.images++;
        // 等待上传生效（005 P2）：先轮询完成信号（缩略图/进度），未命中再退回固定等待（图片 1.5s；文件 2.5s）
        const settled = await waitForUploadSettled(isImage).catch(() => false);
        if (settled) diag.attachSettled++;
        if (!settled) await new Promise(r => setTimeout(r, isImage ? 1500 : 2500));
      }
    };

    // 3) 发送：等发送按钮可用后再点（轮询；随机化间隔防机械特征 —— 002 方案 D）
    const sendSelectors = (cfg.sends && cfg.sends.length) ? cfg.sends : [
      'button[data-testid="send-button"]', 'button[aria-label*="发送"]', 'button[aria-label*="Send"]',
      'form button[type="submit"]', 'button[type="submit"]'
    ];
    // 鼠标轨迹模拟（002 方案 B / P3）：输入框 → 发送按钮，贝塞尔曲线移动 + 完整鼠标事件序列。
    // isTrusted 无法伪造，但事件序列更接近真人操作；任何异常都回退普通 click，不影响功能。
    const simulateMouseMoveAndClick = async (fromEl, toEl) => {
      const to = toEl.getBoundingClientRect();
      // 按钮不可见/在视口外：轨迹无意义，直接点
      if (!to || to.width <= 0 || to.height <= 0 || to.bottom < 0 || to.top > window.innerHeight) {
        toEl.click();
        return;
      }
      const targetX = to.left + to.width * (0.3 + Math.random() * 0.4);
      const targetY = to.top + to.height * (0.3 + Math.random() * 0.4);
      const from = fromEl ? fromEl.getBoundingClientRect() : null;
      // 起点：输入框内随机位置；输入框不可见时从按钮附近开始
      let x, y;
      if (from && from.width > 0 && from.height > 0) {
        x = from.left + from.width * (0.3 + Math.random() * 0.4);
        y = from.top + from.height * (0.3 + Math.random() * 0.4);
      } else {
        x = targetX - 80 + Math.random() * 40;
        y = targetY + 20 + Math.random() * 30;
      }
      // 二阶贝塞尔控制点：随机偏移，模拟人类非直线移动
      const ctrlX = (x + targetX) / 2 + (Math.random() - 0.5) * 60;
      const ctrlY = (y + targetY) / 2 + (Math.random() - 0.5) * 40;
      const steps = 12 + Math.floor(Math.random() * 8);
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const cx = (1 - t) * (1 - t) * x + 2 * (1 - t) * t * ctrlX + t * t * targetX;
        const cy = (1 - t) * (1 - t) * y + 2 * (1 - t) * t * ctrlY + t * t * targetY;
        const target = document.elementFromPoint(cx, cy);
        if (target) {
          target.dispatchEvent(new MouseEvent('mousemove', { clientX: cx, clientY: cy, bubbles: true, cancelable: true }));
        }
        await new Promise(r => setTimeout(r, 10 + Math.random() * 20));
      }
      // 到达后：完整事件序列 + 最终点击
      toEl.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
      toEl.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
      toEl.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
      toEl.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
      toEl.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    };
    const doSend = async () => {
      let sent = false;
      for (const sel of sendSelectors) {
        const el = document.querySelector(sel);
        if (el && !el.disabled) {
          diag.sendFound = sel;
          try {
            await simulateMouseMoveAndClick(input, el);
          } catch (e) {
            try { el.click(); } catch (e2) {}
          }
          sent = true;
          break;
        }
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
        const nowMsgs = topMsgs();
        if (nowMsgs.length) {
          before = nowMsgs;
          beforeSet = new Set(before);
          beforeMd = new Map(before.map(el => [el, domToMarkdown(el)]));
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
    let lastThinking = '';
    let stableSince = 0;
    const stopSelectors = [
      'button[data-testid="stop-button"]', 'button[aria-label*="停止"]',
      'button[aria-label*="Stop"]', 'button.stop-button'
    ];
    const generating = () => stopSelectors.some(sel => document.querySelector(sel));
    const check = () => {
      const list = topMsgs();
      diag.replyCount = list.length;
      // 兜底：发送 8s 后适配器选择器一个元素都没匹配到（站点改版）→ 并入通用候选选择器
      if (!genericFallbackOn && sentAt && Date.now() - sentAt > 8000 && list.length === 0) {
        genericFallbackOn = true;
        selectorPool = selectorPool.concat(GENERIC_REPLY_SELECTORS.filter(s => !selectorPool.includes(s)));
      }
      // 身份基线：新元素 = 不在发送前基线集合里的顶层元素（比 index 切片稳健）
      const newElements = list.filter(el => !beforeSet.has(el));
      // 思维链分离（确定性）：思考块无论"答案元素的后代"还是"独立兄弟元素"都被单独识别，
      // 返回 { text, thinking } 分离结构 —— 解决奇偶轮思考块 DOM 形态不同导致的漏剥
      const pickParts = (el) => {
        // 元素自身就是思考块（类名含 think/reason/thought）→ 全部计入 thinking
        if (/think|reason|thought/i.test(String(el.className || ''))) {
          return { text: '', thinking: (el.innerText || '').trim() };
        }
        // 祖先链上有思考容器（DeepSeek 把思考内容也渲染成 ds-markdown，think 类标记在祖先容器上，
        // 此时思考内容块会被回复选择器直接匹配到）→ 归为 thinking
        let anc = el.parentElement;
        let depth = 0;
        while (anc && depth < 6) {
          if (/think|reason|thought/i.test(String(anc.className || ''))) {
            return { text: '', thinking: (el.innerText || '').trim() };
          }
          anc = anc.parentElement;
          depth++;
        }
        const full = (el.innerText || '').trim();
        if (!full) return { text: '', thinking: '' };
        let thinking = '';
        try {
          const thinkEl = el.querySelector('[class*="think" i], [class*="reason" i], [class*="thought" i], details');
          if (thinkEl) thinking = (thinkEl.innerText || '').trim();
        } catch (e) {}
        // 优先 DOM→Markdown（保留链接）；空则回退纯文本（剥离思考块）
        const md = domToMarkdown(el);
        if (md) return { text: md, thinking };
        const stripped = (thinking && full.includes(thinking)) ? full.replace(thinking, '\n').replace(/\n{3,}/g, '\n\n').trim() : full;
        return { text: stripped || full, thinking };
      };
      let text = '';
      let thinking = '';
      if (newElements.length > 0) {
        // 情况 b：有新增元素，逐个分离思考/正文；过滤与问题原文相同的元素（通用兜底可能连用户气泡一起匹配）
        for (const el of newElements) {
          const p = pickParts(el);
          if (p.text && p.text !== question) text = text ? text + '\n' + p.text : p.text;
          if (p.thinking) thinking = thinking ? thinking + '\n' + p.thinking : p.thinking;
        }
      }
      // 情况 a / 兜底：无新增元素，或新增元素全是思考块 → 扫描所有顶层元素，取"相对基线新增正文"最长者
      //（元素被复用/内容累积的站点：只取本轮新增，避免把整段历史或旧回答当答案）
      if (!text && list.length > 0) {
        let bestT = '', bestThinking = '';
        for (const el of list) {
          const p = pickParts(el);
          let t = p.text;
          const base = beforeMd.get(el);
          if (base) {
            if (t.startsWith(base)) t = t.slice(base.length).trim();
            else { const idx = t.indexOf(base); if (idx >= 0) t = t.slice(idx + base.length).trim(); }
          }
          if (t && t.length > bestT.length) { bestT = t; bestThinking = p.thinking; }
        }
        if (bestT) text = bestT;
        if (!thinking && bestThinking) thinking = bestThinking;
      }
      if (thinking) lastThinking = thinking;
      if (!text) return;
      const isNew = list.length > before.length || (text && text !== baselineLast);
      if (!isNew) return;
      if (text !== lastText) { lastText = text; lastThinking = thinking; stableSince = Date.now(); reportDelta(text); return; }
      if (!generating() && Date.now() - stableSince > 1500) finish({ answer: text, thinking: lastThinking });
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
        if (lastText) finish({ answer: lastText, thinking: lastThinking });
        else if (lastThinking) finish({ answer: lastThinking, thinking: '' }); // 分类失误兜底：内容可见性优先
        else finish({ error: '等待 ' + (cfg.label || 'AI') + ' 回复超时。输入框: ' + diag.inputFound + '；发送: ' + (diag.sendFound || '未触发') + '；图片: ' + (diag.images || 0) + '；回复元素: ' + (diag.replyCount || 0) + ' 个（若为 0 说明站点改版、选择器失效）' });
      }, RESOLVE_TIMEOUT);
    };
    // 有附件图片：先粘贴上传完成，再进入发送/等待流程
    Promise.resolve((images && images.length) ? injectAttachments() : null).then(beginWait, beginWait);
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
  if (alarm.name === SITE_HEALTH_ALARM) siteHealthRefresh(false).catch(() => {}); // 站点可达性心跳（docs/013 §9）
});

// 站点健康心跳：启动即建 15 分钟周期（只刷可达性；DOM 探测由侧栏「刷新」按需触发）
chrome.alarms.create(SITE_HEALTH_ALARM, { periodInMinutes: 15, delayInMinutes: 1 });
siteHealthRefresh(false).catch(() => {});

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