#!/usr/bin/env node
/**
 * 翻译源 UI 真机 E2E（2026-10-07：用户反馈「翻译失败翻译失败」修复的回归）
 * 用法：npm run test:e2e:trans   （或 node tools/test-e2e-translate-ui.mjs）
 *
 * 覆盖：底部状态条「翻译源」第四段（渲染/随设置跟随/点击直达蓝区翻译 tab）+ 失败文案
 * （源失败带「当前翻译源」/无前缀重复/完整三级失败链路）+ 英文界面 i18n。
 * Chrome 定位同 test-e2e-profiles.mjs（CHROME_PATH 可覆盖；找不到浏览器时打印跳过并以 0 退出）。
 */
import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 9450;
const PROFILE = path.join(os.tmpdir(), 'tabu-e2e-translate-ui-profile');

function findChrome() {
  if (process.env.CHROME_PATH) return fs.existsSync(process.env.CHROME_PATH) ? process.env.CHROME_PATH : '';
  const home = os.homedir();
  const candidates = [
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
  console.log('⚠️  未找到 Chrome / Edge（可设 CHROME_PATH 指定）——跳过翻译 UI 真机 E2E');
  process.exit(0);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const t = (name, cond, extra = '') => { results.push(!!cond); console.log((cond ? '  ✅ ' : '  ❌ ') + name + (extra ? ' — ' + extra : '')); };

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

fs.rmSync(PROFILE, { recursive: true, force: true });
const chrome = spawn(CHROME, [
  `--user-data-dir=${PROFILE}`, `--load-extension=${ROOT}`, `--disable-extensions-except=${ROOT}`,
  `--remote-debugging-port=${PORT}`, '--headless=new', '--disable-features=DisableLoadExtensionCommandLineSwitch',
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

const findId = async () => {
  const tt = await send('Target.getTargets');
  for (const x of tt.result.targetInfos) {
    const m = /^chrome-extension:\/\/([a-p]{32})\/background\.js/.exec(x.url || '');
    if (m) return m[1];
  }
  return '';
};
const extId = await waitFor(findId, 15000, 400, '扩展 SW target');
console.log('TabU AI 扩展 ID:', extId);

const created = await send('Target.createTarget', { url: `chrome-extension://${extId}/sidepanel.html` });
const targetId = created.result.targetId;
const att = await send('Target.attachToTarget', { targetId, flatten: true });
const S = att.result.sessionId;
await sleep(2800);
async function ev(expression, timeout = 90000) {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, timeout }, S);
  if (r.result && r.result.exceptionDetails) {
    throw new Error('页面异常: ' + String((r.result.exceptionDetails.exception || {}).description || JSON.stringify(r.result.exceptionDetails)).slice(0, 300));
  }
  return r.result && r.result.result ? r.result.result.value : undefined;
}
await waitFor(() => ev(`typeof updateRedStatusStrip === 'function' && !!document.getElementById('rsTrans')`), 25000, 400, 'sidepanel 初始化');
console.log('─'.repeat(64));

// ── 1) 第四段渲染 + 四段齐全 + 高度 ──
try {
  const r = await ev(`(() => {
    const seg = document.getElementById('rsTrans');
    const segs = [...document.querySelectorAll('#redStatusStrip .rs-seg')].map(e => e.textContent.trim());
    const cs = getComputedStyle(document.getElementById('redStatusStrip'));
    return { text: seg ? seg.textContent.trim() : '(none)', segs, padding: cs.paddingTop, height: document.getElementById('redStatusStrip').getBoundingClientRect().height };
  })()`);
  t('第四段 rsTrans 显示「🌐 自动」（默认 auto）', r.text === '🌐 自动', r.text);
  t('状态条四段齐全（LLM/ASR/TTS/翻译源）', r.segs.length === 4, JSON.stringify(r.segs));
  t('状态条高度放宽（≥24px）', r.height >= 24, `height=${r.height}px padding=${r.padding}`);
} catch (e) { t('第四段渲染', false, e.message); }

// ── 2) 切源跟随 + storage 落值 ──
try {
  const r = await ev(`(async () => {
    const sel = document.getElementById('transProviderBlue');
    sel.value = 'mymemory'; sel.dispatchEvent(new Event('change'));
    await new Promise(r => setTimeout(r, 150));
    const st = await chrome.storage.local.get('translateProvider');
    const seg1 = document.getElementById('rsTrans').textContent.trim();
    sel.value = 'google'; sel.dispatchEvent(new Event('change'));
    await new Promise(r => setTimeout(r, 150));
    const seg2 = document.getElementById('rsTrans').textContent.trim();
    return { seg1, seg2, stored: st.translateProvider };
  })()`);
  t('切 MyMemory → 第四段即时跟随', r.seg1 === '🌐 MyMemory', r.seg1);
  t('切 Google → 第四段即时跟随', r.seg2 === '🌐 Google', r.seg2);
  t('storage 落 translateProvider', r.stored === 'mymemory', String(r.stored));
} catch (e) { t('切源跟随', false, e.message); }

// ── 3) 失败文案单测（源失败带源 / 详情 / 非源失败无重复） ──
try {
  const r = await ev(`(() => {
    currentTranslateProvider = 'google';
    const e1 = Object.assign(new Error(''), { code: 'TRANS_SRC_FAIL', source: 'Google' });
    const msgGoogle = translateFailMessage(e1);
    currentTranslateProvider = 'mymemory';
    const e2 = Object.assign(new Error('PLEASE SELECT TWO DISTINCT LANGUAGES'), { code: 'TRANS_SRC_FAIL', source: 'MyMemory' });
    const msgDetail = translateFailMessage(e2);
    currentTranslateProvider = 'auto';
    const msgAuto = translateFailMessage(e1);
    const msgOther = translateFailMessage(new Error('HTTP 500: internal'));
    return { msgGoogle, msgDetail, msgAuto, msgOther };
  })()`);
  t('源失败(Google)：带源、无重复', r.msgGoogle === '翻译失败（当前翻译源：Google）', JSON.stringify(r.msgGoogle));
  t('源失败+详情：带源 + 冒号详情', r.msgDetail === '翻译失败（当前翻译源：MyMemory）：PLEASE SELECT TWO DISTINCT LANGUAGES', JSON.stringify(r.msgDetail));
  t('源失败(auto)：显示「自动」', r.msgAuto === '翻译失败（当前翻译源：自动）', JSON.stringify(r.msgAuto));
  t('非源失败：无前缀重复', r.msgOther === '翻译失败：HTTP 500: internal', JSON.stringify(r.msgOther));
} catch (e) { t('失败文案单测', false, e.message); }

// ── 4) 完整链路（三级全败）→ toast 提示带源 ──
try {
  const r = await ev(`(async () => {
    const origFetch = window.fetch;
    window.fetch = (u, o) => {
      const s = String(u);
      if (s.includes('translate.googleapis.com') || s.includes('api.mymemory.translated.net')) {
        return Promise.reject(new TypeError('Failed to fetch (simulated)'));
      }
      return origFetch(u, o);
    };
    // 假 API 档案（端口 9）→ LLM 兜底快速失败 → 返回 null → 抛原错误
    await chrome.storage.local.set({
      translateProvider: 'google',
      aiProfiles: [{ id: 'p_verify', name: 'VerifyFail', provider: 'custom', baseUrl: 'http://127.0.0.1:9/v1', apiKey: '', model: '', allowAnyHost: false }],
      aiActiveProfileId: 'p_verify'
    });
    currentTranslateProvider = 'google';
    const origToast = window.showToast;
    window.__lastToast = '';
    window.showToast = (m) => { window.__lastToast = String(m || ''); try { origToast(m); } catch (e) {} };
    document.getElementById('injectInput').value = '构建';
    document.getElementById('injectTranslateFree').click();
    let status = '';
    for (let i = 0; i < 240; i++) {
      await new Promise(r => setTimeout(r, 250));
      status = window.__lastToast || '';
      if (status.includes('翻译失败')) break;
    }
    window.fetch = origFetch;
    window.showToast = origToast;
    await chrome.storage.local.set({ translateProvider: 'auto' });
    currentTranslateProvider = 'auto';
    return { status };
  })()`, 100000);
  t('完整链路（免费源+LLM 兜底全败）提示带源且无重复', /^翻译失败（当前翻译源：Google）/.test(r.status || '') && !/翻译失败翻译失败/.test(r.status || ''), JSON.stringify(r.status));
} catch (e) { t('完整链路', false, e.message); }

// ── 5) 点击第四段 → 蓝区 AI 能力中心「🌐 翻译」tab ──
try {
  const r = await ev(`(async () => {
    document.getElementById('rsTrans').click();
    await new Promise(r => setTimeout(r, 400));
    const sec = document.querySelector('#layer-blue .bsec[data-bsec="ai"]');
    const panel = document.querySelector('[data-captab-panel="trans"]');
    const tab = document.querySelector('.cap-tab[data-captab="trans"]');
    return { layer: document.getElementById('app').dataset.layer, secFolded: sec ? sec.classList.contains('folded') : null,
      panelHidden: panel ? panel.classList.contains('hidden') : null, tabActive: tab ? tab.classList.contains('active') : null };
  })()`);
  t('点击直达：蓝区 + AI 分区展开 + 翻译 tab 激活', r.layer === 'blue' && r.secFolded === false && r.panelHidden === false && r.tabActive === true, JSON.stringify(r));
} catch (e) { t('点击直达', false, e.message); }

// ── 6) 英文界面 i18n（标题不含中文标点） ──
try {
  const r = await ev(`(async () => {
    await chrome.storage.local.set({ translateProvider: 'auto' });
    currentTranslateProvider = 'auto';
    updateRedStatusStrip();
    I18N.toggle();
    await new Promise(r => setTimeout(r, 300));
    const seg = document.getElementById('rsTrans').textContent.trim();
    const title = document.getElementById('rsTrans').title;
    I18N.toggle();
    return { en: seg, enTitle: title };
  })()`);
  t('英文下显示「🌐 Auto」+ 英文 title（中性分隔符）', r.en === '🌐 Auto' && /Current free translation source/.test(r.enTitle || '') && !/：/.test(r.enTitle || ''), JSON.stringify(r));
} catch (e) { t('英文 i18n', false, e.message); }

try { await send('Target.closeTarget', { targetId }); } catch (e) { /* noop */ }
bws.close();
chrome.kill('SIGKILL');

console.log('─'.repeat(64));
const failed = results.filter((x) => !x).length;
console.log(`翻译 UI 真机 E2E：通过 ${results.length - failed}/${results.length}${failed ? '，失败 ' + failed : '，全部通过 ✅'}`);
process.exit(failed ? 1 : 0);
