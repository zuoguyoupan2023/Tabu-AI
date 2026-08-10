// ========== TabU 安装欢迎引导页（welcome.js） ==========
// 与侧边栏共享 i18n.js：语言跟随 uiLang 偏好（未设置跟随系统），右上角按钮可切换。
// 注意：MV3 扩展页 CSP（script-src 'self'）禁止内联 <script>，本页全部逻辑都在此外部文件中。
(function () {
  'use strict';

  // ===== 步骤状态（4 屏：安装成功 / 固定工具栏 / 认识红蓝层 / 完成） =====
  let currentStep = 1;
  const TOTAL = 4;
  const dots = {
    1: document.querySelector('[data-dot="1"]'),
    2: document.querySelector('[data-dot="2"]'),
    3: document.querySelector('[data-dot="3"]'),
    4: document.querySelector('[data-dot="4"]')
  };
  const bars = {
    1: document.querySelector('[data-bar="1"]'),
    2: document.querySelector('[data-bar="2"]'),
    3: document.querySelector('[data-bar="3"]')
  };

  function goTo(step) {
    currentStep = Math.min(Math.max(1, step), TOTAL);
    document.querySelectorAll('.step-page').forEach(s => s.classList.toggle('show', Number(s.dataset.step) === currentStep));
    for (let i = 1; i <= TOTAL; i++) {
      const dot = dots[i];
      dot.classList.toggle('active', i === currentStep);
      dot.classList.toggle('done', i < currentStep);
      if (bars[i]) bars[i].classList.toggle('done', i < currentStep);
    }
    document.body.scrollTop = document.documentElement.scrollTop = 0;
  }

  // ===== 页面级 i18n 收尾：标题 + 步骤环提示文字（.ring::after 由 CSS 变量注入，随语言切换） =====
  function applyPageLang() {
    document.title = I18N.t('welcomeTitle');
    document.documentElement.style.setProperty('--ring-text', I18N.t('welcomePinHere'));
  }

  // 先注册页面级 apply 钩子，再 init（init 内部会立即 apply 一次）
  I18N.onApply(applyPageLang);
  I18N.init();

  // 语言切换按钮：按钮文案由 I18N.apply() 自动更新（中文模式显示 EN，英文模式显示 汉）
  const btnLang = document.getElementById('btnLang');
  if (btnLang) btnLang.addEventListener('click', () => I18N.toggle());

  // ===== 读取归因参数（extension_id / device_id / version） =====
  const params = new URLSearchParams(location.search);
  if (params.get('version')) document.getElementById('versionBadge').textContent = 'v' + params.get('version');

  // ===== 按钮 =====
  document.getElementById('btnStart').addEventListener('click', () => goTo(2));
  document.getElementById('btnBack2').addEventListener('click', () => goTo(1));
  document.getElementById('btnNext2').addEventListener('click', () => goTo(3));
  document.getElementById('btnBack3').addEventListener('click', () => goTo(2));
  document.getElementById('btnNext3').addEventListener('click', () => goTo(4));

  // 打开侧边栏（background 需有 openSidepanel 处理器）
  const openSidepanelBtn = document.getElementById('openSidepanel');
  if (openSidepanelBtn) openSidepanelBtn.addEventListener('click', () => {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({ action: 'openSidepanel' }, () => window.close());
    }
  });
  // 文档 / 反馈（占位链接，可替换为真实地址）
  const docsBtn = document.getElementById('btnDocs');
  if (docsBtn) docsBtn.addEventListener('click', () => {
    window.open('https://github.com/your-repo/tabu', '_blank');
  });
  const feedbackBtn = document.getElementById('btnFeedback');
  if (feedbackBtn) feedbackBtn.addEventListener('click', () => {
    window.open('mailto:your-email@example.com?subject=TabU反馈', '_blank');
  });

  // 完成引导后记录已见标记（供 background 判断，避免重复打开）；非扩展页环境静默跳过
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.set({ tabu_welcome_seen: 1 });
  }
})();
