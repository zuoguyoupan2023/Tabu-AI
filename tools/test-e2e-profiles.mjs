#!/usr/bin/env node
/**
 * API 多渠道档案真机 E2E（docs/017）
 * 用法：npm run test:e2e   （或 node tools/test-e2e-profiles.mjs）
 *
 * 用 Chrome for Testing（CDP，无第三方依赖）+ 真实加载扩展，在 sidepanel.html 扩展页里跑完整档案流程：
 * 空配置迁移 → 旧平铺键迁移 → 保存/重命名 → 新建第二档案（独立 Key）→ 快速切换（密钥隔离）→
 * 删除（确认弹窗 + 镜像同步）→ 至少保留一个 → 档案名注入防护。
 *
 * Chrome 定位：环境变量 CHROME_PATH 优先；否则探测常见安装位置（Playwright 缓存 / Google Chrome / Edge）。
 * 找不到 Chrome 时打印跳过并以 0 退出（CI/无浏览器环境安全）。
 */
import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 9444;
const PROFILE = path.join(os.tmpdir(), 'tabu-e2e-profiles-profile');

// ---------- Chrome 定位（找不到 → 跳过） ----------
function findChrome() {
  if (process.env.CHROME_PATH) return fs.existsSync(process.env.CHROME_PATH) ? process.env.CHROME_PATH : '';
  const home = os.homedir();
  const candidates = [
    // Playwright 缓存（版本号目录逐个降级尝试）
    ...fs.readdirSync(path.join(home, 'Library/Caches/ms-playwright')).filter((d) => d.startsWith('chromium-'))
      .sort().reverse()
      .map((d) => path.join(home, 'Library/Caches/ms-playwright', d, 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing')),
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  ];
  return candidates.find((p) => { try { return fs.existsSync(p); } catch (e) { return false; } }) || '';
}
const CHROME = findChrome();
if (!CHROME) {
  console.log('⚠️  未找到 Chrome / Edge（可设 CHROME_PATH 指定）——跳过真机 E2E');
  process.exit(0);
}

const results = [];
const ok = (name) => { results.push(true); console.log('  ✅ ' + name); };
const bad = (name, msg) => { results.push(false); console.log('  ❌ ' + name + '\n     ' + String(msg).split('\n').join('\n     ')); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function httpJson(p) {
  return new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port: PORT, path: p }, (res) => {
      let d = '';
      res.on('data', (c) => { d += c; });
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { reject(e); } });
    }).on('error', reject);
  });
}
async function waitFor(fn, ms, step, what) {
  const t0 = Date.now();
  for (;;) {
    try { const v = await fn(); if (v) return v; } catch (e) { /* retry */ }
    if (Date.now() - t0 > ms) throw new Error('等待超时：' + what);
    await sleep(step);
  }
}

// ---------- 启动 Chrome（加载扩展） ----------
fs.rmSync(PROFILE, { recursive: true, force: true });
const chrome = spawn(CHROME, [
  `--user-data-dir=${PROFILE}`,
  `--load-extension=${ROOT}`,
  `--disable-extensions-except=${ROOT}`,
  `--remote-debugging-port=${PORT}`,
  '--headless=new',
  // Chrome 137+ 默认禁用 --load-extension 命令行开关，需显式恢复（旧版浏览器忽略该 feature 名，无害）
  '--disable-features=DisableLoadExtensionCommandLineSwitch',
  '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--mute-audio',
], { stdio: 'ignore' });
process.on('exit', () => { try { chrome.kill('SIGKILL'); } catch (e) { /* noop */ } });

const ver = await waitFor(() => httpJson('/json/version'), 20000, 300, 'Chrome DevTools 端口');
const bws = new WebSocket(ver.webSocketDebuggerUrl);
let msgId = 0;
const pending = new Map();
bws.on('message', (d) => {
  const m = JSON.parse(String(d));
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
});
const send = (method, params, sessionId) => new Promise((res) => {
  const id = ++msgId;
  pending.set(id, res);
  bws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
});
await new Promise((r) => bws.on('open', r));

// ---------- 找扩展 ID：只认我方扩展（扩展 SW target = /background.js；内置组件扩展为 thunk.js） ----------
const findId = async () => {
  const t = await send('Target.getTargets');
  for (const x of t.result.targetInfos) {
    const m = /^chrome-extension:\/\/([a-p]{32})\/background\.js/.exec(x.url || '');
    if (m) return m[1];
  }
  return '';
};
const extId = await waitFor(findId, 15000, 400, '扩展 SW target');
console.log('TabU AI 扩展 ID:', extId);

// ---------- 打开 sidepanel 扩展页 ----------
const created = await send('Target.createTarget', { url: `chrome-extension://${extId}/sidepanel.html` });
const targetId = created.result.targetId;
const att = await send('Target.attachToTarget', { targetId, flatten: true });
const S = att.result.sessionId;
await send('Page.enable', {}, S).catch(() => {});

async function evalIn(expression) {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, timeout: 20000 }, S);
  if (r.result && r.result.exceptionDetails) {
    throw new Error('页面异常: ' + JSON.stringify((r.result.exceptionDetails.exception || {}).description || r.result.exceptionDetails));
  }
  return r.result && r.result.result ? r.result.result.value : undefined;
}
const waitReady = () => waitFor(
  () => evalIn(`(() => { const s = document.getElementById('aiProfileSelect'); return document.readyState === 'complete' && typeof loadAiConfig === 'function' && !!s && s.options.length > 0; })()`),
  25000, 400, 'sidepanel 初始化（档案下拉渲染）');

console.log('─'.repeat(64));
await waitReady();

// ---------- A. 空配置迁移 ----------
try {
  const r = await evalIn(`(async () => {
    const st = await chrome.storage.local.get(['aiProfiles', 'aiActiveProfileId', 'aiBaseUrl']);
    return { n: aiProfilesCache.length, active: aiActiveProfileId, stProfiles: (st.aiProfiles || []).length, stActive: st.aiActiveProfileId, stBase: st.aiBaseUrl || '' };
  })()`);
  if (r.n === 1 && r.stProfiles === 1 && r.active && r.active === r.stActive && r.stBase === '') ok('A. 空配置 → 占位档案（1 个，已持久化）');
  else bad('A. 空配置 → 占位档案', JSON.stringify(r));
} catch (e) { bad('A. 空配置迁移', e.message); }

// ---------- B. 旧平铺键迁移（清档案 + 写旧键 + 重载） ----------
try {
  await evalIn(`(async () => {
    await chrome.storage.local.remove(['aiProfiles', 'aiActiveProfileId']);
    await chrome.storage.local.set({ aiProvider: 'deepseek', aiBaseUrl: 'https://api.deepseek.com/v1', aiApiKey: 'sk-e2e-legacy', aiModel: 'deepseek-v4-pro', aiAllowAnyHost: true });
    setTimeout(() => location.reload(), 60);
    return 1;
  })()`);
  await sleep(1200);
  await waitReady();
  const r = await evalIn(`(async () => {
    const p = aiProfilesCache[0];
    const st = await chrome.storage.local.get(['aiProfiles']);
    return { n: aiProfilesCache.length, provider: p.provider, baseUrl: p.baseUrl, apiKey: p.apiKey, model: p.model, anyHost: p.allowAnyHost, stN: (st.aiProfiles || []).length, formKey: aiField('aiApiKey').value, cfgBase: currentAiConfig.aiBaseUrl };
  })()`);
  const good = r.n === 1 && r.provider === 'deepseek' && r.baseUrl === 'https://api.deepseek.com/v1'
    && r.apiKey === 'sk-e2e-legacy' && r.model === 'deepseek-v4-pro' && r.anyHost === true
    && r.stN === 1 && r.formKey === 'sk-e2e-legacy' && r.cfgBase === 'https://api.deepseek.com/v1';
  if (good) ok('B. 旧平铺键 → 单档案迁移（字段/表单/运行时配置全保留）');
  else bad('B. 旧键迁移', JSON.stringify(r));
} catch (e) { bad('B. 旧键迁移', e.message); }

// ---------- C. 保存 + 重命名 ----------
try {
  const r = await evalIn(`(async () => {
    aiField('aiProfileName').value = '工作号';
    aiField('aiApiKey').value = 'sk-work';
    await saveAiConfig();
    const st = await chrome.storage.local.get(['aiProfiles', 'aiApiKey']);
    const selText = document.getElementById('aiProfileSelect').selectedOptions[0].textContent;
    return { name: st.aiProfiles[0].name, mirrorKey: st.aiApiKey, selText, cfgProfileName: currentAiConfig.profileName };
  })()`);
  const good = r.name === '工作号' && r.mirrorKey === 'sk-work' && r.selText === '工作号' && r.cfgProfileName === '工作号';
  if (good) ok('C. 保存 + 重命名（档案名同步下拉/状态条，平铺镜像写透）');
  else bad('C. 保存 + 重命名', JSON.stringify(r));
} catch (e) { bad('C. 保存 + 重命名', e.message); }

// ---------- D. 新建第二档案（Kimi，独立 Key） ----------
try {
  const r = await evalIn(`(async () => {
    await createAiProfile();
    aiField('aiProvider').value = 'kimi'; onAiProviderChange();
    aiField('aiApiKey').value = 'mk-personal';
    await saveAiConfig();
    const st = await chrome.storage.local.get(['aiProfiles', 'aiApiKey', 'aiBaseUrl', 'aiActiveProfileId']);
    return { n: st.aiProfiles.length, names: st.aiProfiles.map(p => p.name), keys: st.aiProfiles.map(p => p.apiKey), mirrorKey: st.aiApiKey, mirrorBase: st.aiBaseUrl, active: st.aiActiveProfileId };
  })()`);
  const good = r.n === 2 && r.names[0] === '工作号' && r.names[1] === 'Kimi'
    && r.keys[0] === 'sk-work' && r.keys[1] === 'mk-personal'
    && r.mirrorKey === 'mk-personal' && r.mirrorBase.includes('moonshot') && r.active;
  if (good) ok('D. 新建第二档案（Kimi 默认名 + 独立 Key，两档案 Key 互不覆盖）');
  else bad('D. 新建第二档案', JSON.stringify(r));
} catch (e) { bad('D. 新建第二档案', e.message); }

// ---------- E. 快速切换回「工作号」（密钥隔离 + 镜像更新） ----------
try {
  const r = await evalIn(`(async () => {
    const first = aiProfilesCache.find(p => p.name === '工作号').id;
    await onAiProfileSelectChange({ target: { value: first } });
    const st = await chrome.storage.local.get(AI_CFG_STORAGE_KEYS);
    const resolved = resolveAiConfig(st);
    return {
      cfgKey: currentAiConfig.aiApiKey, cfgBase: currentAiConfig.aiBaseUrl, cfgName: currentAiConfig.profileName,
      formKey: aiField('aiApiKey').value, formBase: aiField('aiBaseUrl').value,
      mirrorKey: st.aiApiKey, mirrorBase: st.aiBaseUrl,
      resolvedBase: resolved.baseUrl, resolvedName: resolved.profileName,
      leaksOtherKey: JSON.stringify(resolved).includes('mk-personal'),
    };
  })()`);
  const good = r.cfgKey === 'sk-work' && r.cfgBase === 'https://api.deepseek.com/v1' && r.cfgName === '工作号'
    && r.formKey === 'sk-work' && r.formBase === 'https://api.deepseek.com/v1'
    && r.mirrorKey === 'sk-work' && r.mirrorBase === 'https://api.deepseek.com/v1'
    && r.resolvedBase === 'https://api.deepseek.com/v1' && r.resolvedName === '工作号' && r.leaksOtherKey === false;
  if (good) ok('E. 切换档案（表单/运行时/镜像/resolver 四层一致；非当前档案 Key 不泄漏）');
  else bad('E. 切换档案', JSON.stringify(r));
} catch (e) { bad('E. 切换档案', e.message); }

// ---------- F. 删除当前档案（确认弹窗） ----------
try {
  const r = await evalIn(`(async () => {
    const before = aiProfilesCache.length;
    deleteAiProfile();
    const modalShown = !document.getElementById('confirmModal').classList.contains('hidden');
    document.getElementById('confirmOk').click();
    await new Promise(r => setTimeout(r, 300));
    const st = await chrome.storage.local.get(['aiProfiles', 'aiActiveProfileId', 'aiApiKey']);
    return { before, modalShown, n: st.aiProfiles.length, name: st.aiProfiles[0] && st.aiProfiles[0].name, active: st.aiActiveProfileId, mirrorKey: st.aiApiKey };
  })()`);
  // E 已切回「工作号」；删除后剩余 Kimi，镜像随之更新
  const good = r.before === 2 && r.modalShown === true && r.n === 1 && r.name === 'Kimi' && r.mirrorKey === 'mk-personal';
  if (good) ok('F. 删除当前档案（确认弹窗生效，自动切回剩余档案并同步镜像）');
  else bad('F. 删除档案', JSON.stringify(r));
} catch (e) { bad('F. 删除档案', e.message); }

// ---------- G. 最后一个档案不可删 ----------
try {
  const r = await evalIn(`(async () => {
    deleteAiProfile();
    await new Promise(r => setTimeout(r, 100));
    const st = await chrome.storage.local.get(['aiProfiles']);
    return { n: aiProfilesCache.length, stN: st.aiProfiles.length, modal: !document.getElementById('confirmModal').classList.contains('hidden') };
  })()`);
  if (r.n === 1 && r.stN === 1 && r.modal === false) ok('G. 至少保留一个档案（删除被拒、无弹窗）');
  else bad('G. 保留一个档案', JSON.stringify(r));
} catch (e) { bad('G. 保留一个档案', e.message); }

// ---------- H. 档案名注入防护 ----------
try {
  const PAYLOAD = '<img src=x onerror="window.__xss=1">';
  await evalIn(`(async () => { aiField('aiProfileName').value = '<img src=x onerror="window.__xss=1">'; await saveAiConfig(); return 1; })()`);
  await evalIn(`(async () => { setTimeout(() => location.reload(), 60); return 1; })()`);
  await sleep(1200);
  await waitReady();
  const r = await evalIn(`(() => {
    const sel = document.getElementById('aiProfileSelect');
    const opt = [...sel.options].find(o => o.value !== '__new__');
    return { text: opt ? opt.textContent : '', hasImg: !!sel.querySelector('img'), xss: !!window.__xss };
  })()`);
  if (r.text === PAYLOAD && r.hasImg === false && r.xss === false) ok('H. 档案名注入防护（option 纯文本渲染，无元素注入/脚本执行）');
  else bad('H. 注入防护', JSON.stringify(r));
} catch (e) { bad('H. 注入防护', e.message); }

// ---------- 收尾 ----------
try { await send('Target.closeTarget', { targetId }); } catch (e) { /* noop */ }
bws.close();
chrome.kill('SIGKILL');

console.log('─'.repeat(64));
const failed = results.filter((x) => !x).length;
console.log(`E2E 结果：通过 ${results.length - failed}/${results.length}${failed ? '，失败 ' + failed : '，全部通过 ✅'}`);
process.exit(failed ? 1 : 0);
