// ========== TabU 注入输入工具（模块 A） ==========
// 在聚焦到类聊天输入框（多行 textarea / contenteditable）时，右下角显示"发送"浮动按钮。
// 默认关闭，需在「管理设置」里开启。支持 React 受控输入框（原生 value setter）。
// 安全考量：仅作用于多行文本/可编辑区，避免单行搜索框误触；手动发送，不做自动发送。
(function () {
  'use strict';
  if (window.top !== window) return; // 只在顶层页面执行

  const ENABLE_KEY = 'inputInjectEnabled';
  let enabled = false;
  let btn = null;
  let currentInput = null;

  chrome.storage.local.get(ENABLE_KEY, (r) => {
    enabled = !!r[ENABLE_KEY];
    if (enabled) init();
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes[ENABLE_KEY]) return;
    enabled = !!changes[ENABLE_KEY].newValue;
    if (enabled) init(); else hideButton();
  });

  function isChatLike(el) {
    if (!el || !el.isConnected) return false;
    if (el.tagName === 'TEXTAREA') {
      const h = el.clientHeight || 0;
      const rows = el.rows || 0;
      return rows >= 2 || h > 44; // 只对多行输入生效
    }
    if (el.tagName === 'DIV' && el.isContentEditable) return true;
    return false;
  }

  // React 受控输入：用原生 setter 赋值，避免被 React 内部状态覆盖
  function setInputValue(el, text) {
    if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
      setter.call(el, text);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
      el.focus();
      if (document.execCommand) {
        document.execCommand('insertText', false, text);
      } else {
        el.textContent = text;
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
  }

  function doSend() {
    if (!currentInput) return;
    const text = (currentInput.value != null ? currentInput.value : currentInput.textContent || '').trim();
    if (!text) return;
    // 优先点击页面里的发送按钮（ChatGPT 等），否则模拟 Enter
    const sendBtns = document.querySelectorAll('button[data-testid="send-button"], button[aria-label*="发送"], button[aria-label*="Send"], button[type="submit"]');
    let clicked = false;
    for (const b of sendBtns) {
      if (!b.disabled && isVisible(b)) { b.click(); clicked = true; break; }
    }
    if (!clicked) {
      currentInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true }));
    }
    hideButton();
  }

  function isVisible(el) {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }

  function createButton() {
    if (btn) return btn;
    btn = document.createElement('div');
    btn.textContent = '📤 发送';
    btn.setAttribute('data-tabu-send', '');
    Object.assign(btn.style, {
      position: 'fixed', right: '16px', bottom: '16px', zIndex: '2147483647',
      background: '#1a2332', color: '#fff', fontSize: '13px', fontWeight: '500',
      padding: '8px 16px', borderRadius: '20px', cursor: 'pointer',
      boxShadow: '0 4px 14px rgba(0,0,0,.25)', userSelect: 'none', display: 'none',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    });
    btn.addEventListener('mousedown', (e) => e.preventDefault()); // 防止抢焦点清选区
    btn.addEventListener('click', (e) => { e.stopPropagation(); doSend(); });
    document.documentElement.appendChild(btn);
    return btn;
  }

  function showButton() {
    const b = createButton();
    b.style.display = 'block';
  }
  function hideButton() {
    if (btn) btn.style.display = 'none';
  }

  function init() {
    document.addEventListener('focusin', (e) => {
      if (!enabled) return;
      const el = e.target;
      if (isChatLike(el)) { currentInput = el; showButton(); }
      else if (!el.closest('[data-tabu-send]')) { currentInput = null; hideButton(); }
    });
    document.addEventListener('focusout', () => setTimeout(() => {
      if (document.activeElement === document.body) { currentInput = null; hideButton(); }
    }, 200));
    // Ctrl / Cmd + Enter 快速发送
    document.addEventListener('keydown', (e) => {
      if (!enabled) return;
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        const el = document.activeElement;
        if (isChatLike(el)) { currentInput = el; e.preventDefault(); doSend(); }
      }
    });
  }
})();
