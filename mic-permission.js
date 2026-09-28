// ========== Tab AI 麦克风授权页 ==========
// MV3 侧边栏 / offscreen 等非前台扩展页无法可靠弹出麦克风授权弹窗（getUserMedia 直接返回
// NotAllowedError），必须先在一个「可见」扩展页里触发一次授权。本页即为此用途：
// 点击授权 → getUserMedia({audio:true}) → 浏览器弹窗 → 允许后自动关闭本页。
// 授权会按扩展 origin 持久化，之后侧边栏即可正常录音。
(function () {
  function init() {
    document.title = I18N.t('micPermTitle');
    const btn = document.getElementById('micGrant');
    const status = document.getElementById('micStatus');
    if (!btn) return;

    btn.addEventListener('click', async () => {
      btn.disabled = true;
      status.className = 'status';
      status.textContent = I18N.t('micPermWaiting');
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(t => t.stop()); // 授权成功后立即释放，不占用麦克风
        status.className = 'status ok';
        status.textContent = '✅ ' + I18N.t('micPermGranted');
        // 授权成功：关闭本标签页
        setTimeout(() => {
          try { window.close(); } catch (e) {}
          try { chrome.tabs.getCurrent().then((t) => { if (t) chrome.tabs.remove(t.id); }); } catch (e) {}
        }, 1200);
      } catch (e) {
        btn.disabled = false;
        status.className = 'status err';
        status.textContent = '❌ ' + I18N.t('micPermDenied') + '（' + (e.name || e.message) + '）';
      }
    });
  }

  I18N.onApply(init);
  I18N.init();
})();
