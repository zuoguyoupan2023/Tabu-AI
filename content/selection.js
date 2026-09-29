// ========== TabU AI 选择状态感知（模块 B） ==========
// 实时感知「当前页面是否有选中文本」，把状态推送给后台 → 侧边栏点亮卡片按钮。
// 防抖 + 仅在状态变化时 sendMessage，避免高频消息拖慢侧边栏。
// 安全考量：只读选区，不做任何写入操作。
(function () {
  'use strict';
  if (window.top !== window) return; // 只在顶层页面执行
  if (window.__tabuSelectionInjected) return;
  window.__tabuSelectionInjected = true;

  // 是否有选中文本：页面选区，或 input/textarea 内选区
  function readHasSelection() {
    try {
      const sel = window.getSelection();
      if (sel && sel.toString && sel.toString().trim()) return true;
      const ae = document.activeElement;
      if (ae && (ae.tagName === 'TEXTAREA' || ae.tagName === 'INPUT')) {
        const start = ae.selectionStart || 0;
        const end = ae.selectionEnd || 0;
        return start !== end && end > start;
      }
    } catch (e) {}
    return false;
  }

  let lastState = null;
  function push() {
    const has = readHasSelection();
    if (has !== lastState) {
      lastState = has;
      try { chrome.runtime.sendMessage({ type: 'selectionState', hasSelection: has }); } catch (e) {}
    }
  }

  let timer = null;
  function debounced() {
    clearTimeout(timer);
    timer = setTimeout(push, 150);
  }

  document.addEventListener('selectionchange', debounced);
  document.addEventListener('mouseup', debounced);
  document.addEventListener('keyup', debounced);

  // 初始推送一次，让侧边栏一打开就能点亮按钮
  push();
})();
