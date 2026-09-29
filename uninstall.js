// ========== TabU AI 卸载调查页（uninstall.js） ==========
// 与欢迎页共享 i18n.js：语言跟随 uiLang 偏好（未设置跟随系统），右上角按钮可切换。
// 本页同时是「扩展页」与「独立托管页」两种场景：
//   · 扩展页  → 有 chrome.*，可读 uiLang 偏好；
//   · 托管页  → 无 chrome.storage，i18n.js 自动回退 localStorage（部署时 uninstall.html / i18n.js / uninstall.js 三件同目录）。
(function () {
  'use strict';

  // ===== 读取归因参数（setUninstallURL 传入） =====
  const params = new URLSearchParams(location.search);
  const deviceId = params.get('device_id') || '';
  const extensionId = params.get('extension_id') || '';
  const extensionName = params.get('extension_name') || 'tabu';

  // ===== 商店地址（发布后替换为真实 URL；按浏览器判断） =====
  function getStoreUrl() {
    const isEdge = /Edg\//.test(navigator.userAgent);
    // TODO: 发布后替换为 TabU AI 的真实商店地址
    const EDGE_URL = 'https://microsoftedge.microsoft.com/addons/detail/<你的-Edge-商店-ID>';
    const CHROME_URL = 'https://chromewebstore.google.com/detail/<你的-Chrome-商店-ID>';
    return isEdge ? EDGE_URL : CHROME_URL;
  }

  // ===== 上报端点（二选一） =====
  // 有后端：填 POST 接口，接收 { device_id, extension_id, reason, text, ts }
  // 无后端：留空，提交时自动降级为邮件兜底（打开 mailto，数据不丢失）
  const REPORT_ENDPOINT = ''; // 例: 'https://api.example.com/tabu/uninstall'
  const MAILTO_FALLBACK = 'mailto:your-email@example.com';

  // ===== 页面级 i18n 收尾：标题 + 单选原因 value 随语言刷新（提交/report 用当前语言的原因值） =====
  function applyPageLang() {
    document.title = I18N.t('uninstallTitle');
    document.querySelectorAll('input[data-reason-key]').forEach((input) => {
      input.value = I18N.t(input.dataset.reasonKey);
    });
  }

  // 先注册页面级 apply 钩子，再 init（init 内部会立即 apply 一次）
  I18N.onApply(applyPageLang);
  I18N.init();

  // 语言切换按钮：文案由 I18N.apply() 自动更新
  const btnLang = document.getElementById('btnLang');
  if (btnLang) btnLang.addEventListener('click', () => I18N.toggle());

  // ===== 挽留区交互 =====
  const submitResult = document.getElementById('submitResult');
  function showResult(text, ok) {
    submitResult.textContent = text;
    submitResult.className = ok ? 'ok' : '';
    submitResult.style.display = 'block';
  }

  document.getElementById('btnReinstall').addEventListener('click', () => {
    window.open(getStoreUrl(), '_blank');
    showResult(I18N.t('uninstallReinstallDone'), true);
  });
  // 「继续卸载」→ 弱化处理：确认后关闭页面（卸载本身由浏览器完成）
  document.getElementById('btnProceed').addEventListener('click', () => {
    if (confirm(I18N.t('uninstallConfirmProceed'))) window.close();
  });

  // ===== 单选高亮 =====
  const radios = document.querySelectorAll('input[name="reason"]');
  radios.forEach(r => {
    r.addEventListener('change', () => {
      document.querySelectorAll('.reason').forEach(el => el.classList.remove('selected'));
      r.closest('.reason').classList.add('selected');
    });
  });
  // 点击整行也可选中
  document.querySelectorAll('.reason').forEach(row => {
    row.addEventListener('click', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'LABEL') return;
      const input = row.querySelector('input');
      if (input) { input.checked = true; input.dispatchEvent(new Event('change')); }
    });
  });

  // ===== 提交 =====
  document.getElementById('btnSubmit').addEventListener('click', async () => {
    const reasonEl = document.querySelector('input[name="reason"]:checked');
    const reason = reasonEl ? reasonEl.value : '';
    const text = document.getElementById('feedbackText').value.trim();
    const btn = document.getElementById('btnSubmit');
    btn.disabled = true;
    const payload = { device_id: deviceId, extension_id: extensionId, reason, text, ts: new Date().toISOString() };
    try {
      if (REPORT_ENDPOINT) {
        const resp = await fetch(REPORT_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        showResult(I18N.t('uninstallSubmitOk'), true);
      } else {
        // 无后端降级：以邮件携带反馈数据
        const subject = encodeURIComponent(I18N.t('uninstallMailSubject'));
        const body = encodeURIComponent(
          I18N.t('uninstallMailReason') + (reason || I18N.t('uninstallMailNoReason')) + '\n\n' +
          I18N.t('uninstallMailFeedback') + (text || I18N.t('uninstallMailNoFeedback')) + '\n\n' +
          'device_id: ' + deviceId + '\nextension_id: ' + extensionId
        );
        window.open(MAILTO_FALLBACK + '?subject=' + subject + '&body=' + body, '_blank');
        showResult(I18N.t('uninstallSubmitMailOk'), true);
      }
    } catch (e) {
      showResult(I18N.t('uninstallSubmitFail', e.message), false);
    }
    setTimeout(() => { btn.disabled = false; }, 2000);
  });
})();
