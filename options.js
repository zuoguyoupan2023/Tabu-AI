// ========== 发送消息 ==========
function sendMessage(action, data = {}) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action, ...data }, (response) => {
      resolve(response);
    });
  });
}

// ========== 导入数据 ==========
document.getElementById('btnImport').addEventListener('click', async () => {
  const fileInput = document.getElementById('importFile');
  const status = document.getElementById('importStatus');
  
  if (!fileInput.files || fileInput.files.length === 0) {
    status.textContent = '❌ 请先选择文件';
    return;
  }
  
  try {
    const file = fileInput.files[0];
    const text = await file.text();
    JSON.parse(text); // 验证
    
    const result = await sendMessage('importData', { jsonData: text });
    
    if (result.success) {
      status.textContent = `✅ 成功导入 ${result.count} 条快照及相关版本`;
      fileInput.value = '';
    } else {
      status.textContent = `❌ ${result.message}`;
    }
  } catch (e) {
    status.textContent = `❌ 文件解析失败: ${e.message}`;
  }
});

// ========== 加载设置 ==========
async function loadSettings() {
  const bookmarkMax = await sendMessage('getSetting', { key: 'bookmarkMaxVersions', defaultValue: 20 });
  const historyMax = await sendMessage('getSetting', { key: 'historyMaxVersions', defaultValue: 20 });
  document.getElementById('bookmarkMaxVersions').value = bookmarkMax;
  document.getElementById('historyMaxVersions').value = historyMax;
}
loadSettings();

// ========== 保存设置 ==========
document.getElementById('btnSaveBookmarkSetting').addEventListener('click', async () => {
  const val = parseInt(document.getElementById('bookmarkMaxVersions').value);
  if (isNaN(val) || val < 1) {
    document.getElementById('bookmarkSettingStatus').textContent = '❌ 请输入有效数字';
    return;
  }
  await sendMessage('setSetting', { key: 'bookmarkMaxVersions', value: val });
  document.getElementById('bookmarkSettingStatus').textContent = '✅ 已保存';
  setTimeout(() => document.getElementById('bookmarkSettingStatus').textContent = '', 3000);
});
document.getElementById('btnSaveHistorySetting').addEventListener('click', async () => {
  const val = parseInt(document.getElementById('historyMaxVersions').value);
  if (isNaN(val) || val < 1) {
    document.getElementById('historySettingStatus').textContent = '❌ 请输入有效数字';
    return;
  }
  await sendMessage('setSetting', { key: 'historyMaxVersions', value: val });
  document.getElementById('historySettingStatus').textContent = '✅ 已保存';
  setTimeout(() => document.getElementById('historySettingStatus').textContent = '', 3000);
});

// ========== 终端桥接设置 ==========
async function loadBridgeSettings() {
  const token = await sendMessage('getSetting', { key: 'bridgeToken', defaultValue: '' });
  const inject = await sendMessage('getSetting', { key: 'inputInjectEnabled', defaultValue: false });
  const tokenEl = document.getElementById('bridgeToken');
  const injectEl = document.getElementById('inputInjectEnabled');
  if (tokenEl) tokenEl.value = token || '';
  if (injectEl) injectEl.checked = !!inject;
}
loadBridgeSettings();

document.getElementById('btnSaveBridgeToken').addEventListener('click', async () => {
  const el = document.getElementById('bridgeToken');
  await sendMessage('setSetting', { key: 'bridgeToken', value: (el.value || '').trim() });
  const s = document.getElementById('bridgeTokenStatus');
  s.textContent = '✅ 已保存，扩展将自动连接桥接服务';
  setTimeout(() => s.textContent = '', 4000);
});
document.getElementById('btnSaveInputInject').addEventListener('click', async () => {
  const el = document.getElementById('inputInjectEnabled');
  await sendMessage('setSetting', { key: 'inputInjectEnabled', value: !!el.checked });
  const s = document.getElementById('inputInjectStatus');
  s.textContent = '✅ 已保存';
  setTimeout(() => s.textContent = '', 3000);
});

// ========== 清空操作 ==========
document.getElementById('btnClearSnapshots').addEventListener('click', async () => {
  if (!confirm('⚠️ 确定要删除所有快照吗？此操作不可撤销！')) return;
  const result = await sendMessage('clearAllSnapshots');
  document.getElementById('clearStatus').textContent = result.success ? '✅ 已清空快照' : '❌ 清空失败';
});
document.getElementById('btnClearBookmarkVersions').addEventListener('click', async () => {
  if (!confirm('⚠️ 确定要删除所有书签版本吗？此操作不可撤销！')) return;
  const result = await sendMessage('clearAllBookmarkVersions');
  document.getElementById('clearStatus').textContent = result.success ? '✅ 已清空书签版本' : '❌ 清空失败';
});
document.getElementById('btnClearHistoryVersions').addEventListener('click', async () => {
  if (!confirm('⚠️ 确定要删除所有历史版本吗？此操作不可撤销！')) return;
  const result = await sendMessage('clearAllHistoryVersions');
  document.getElementById('clearStatus').textContent = result.success ? '✅ 已清空历史版本' : '❌ 清空失败';
});