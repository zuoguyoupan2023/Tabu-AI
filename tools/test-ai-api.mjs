#!/usr/bin/env node
/**
 * ai-api.js 档案层桩测（docs/017；发版回归见 docs/013 §5）
 * 用法：npm run test:ai-api   （或 node tools/test-ai-api.mjs）
 *
 * 纯逻辑测试：vm 加载 ai-api.js（无 chrome 依赖），覆盖
 * 归一化幂等 / 旧键迁移 / 档案解析优先级 / 密钥档案隔离 / 读取路径未回退到平铺键。
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(root, 'ai-api.js'), 'utf8');
const ctx = vm.createContext({});
vm.runInContext(src + `
;globalThis.__E = {
  normalizeAiConfig, migrateAiProfiles, resolveAiConfig, normalizeAiProfile,
  newAiProfileId, aiProviderLabel, AI_PROVIDERS, AI_CFG_STORAGE_KEYS, AI_CFG_FLAT_KEYS,
};`, ctx);
const E = ctx.__E;

const failures = [];
let passed = 0;
async function test(name, fn) {
  try { await fn(); passed++; console.log('  ✅ ' + name); }
  catch (e) { failures.push(name); console.log('  ❌ ' + name + '\n     ' + String(e.message).split('\n').join('\n     ')); }
}

console.log('ai-api.js 档案层桩测（tools/test-ai-api.mjs）');
console.log('─'.repeat(64));

await test('normalizeAiConfig：原始平铺形态 → 协议/默认模型', async () => {
  const a = E.normalizeAiConfig({ aiProvider: 'anthropic', aiBaseUrl: 'https://api.anthropic.com', aiApiKey: 'k1' });
  assert.equal(a.provider, 'anthropic');
  assert.equal(a.rawProvider, 'anthropic');
  assert.equal(a.model, E.AI_PROVIDERS.anthropic.defaultModel);
  const b = E.normalizeAiConfig({ aiProvider: 'nope-unknown', aiBaseUrl: 'https://x.example/v1' });
  assert.equal(b.rawProvider, 'custom');
  assert.equal(b.provider, 'openai');
  assert.equal(b.baseUrl, 'https://x.example/v1', '未知 provider 归 custom 但保留 baseUrl');
});

await test('normalizeAiConfig 幂等：归一化结果再归一化不变（askApiStream 二次归一化路径）', async () => {
  const flat = { aiProvider: 'deepseek', aiBaseUrl: 'https://api.deepseek.com/v1', aiApiKey: 'sk-x', aiModel: '', aiAllowAnyHost: true };
  const once = E.normalizeAiConfig(flat);
  const twice = E.normalizeAiConfig(once);
  assert.deepEqual(twice, once, '二次归一化必须逐字段相等（含 silent 丢失 baseUrl 的回归）');
  assert.equal(twice.baseUrl, 'https://api.deepseek.com/v1');
  assert.equal(twice.apiKey, 'sk-x');
  assert.equal(twice.allowAnyHost, true);
});

await test('normalizeAiConfig：resolve 结果可直接喂回（端到端幂等）', async () => {
  const raw = {
    aiProfiles: [{ id: 'p1', name: 'Kimi', provider: 'kimi', baseUrl: 'https://api.moonshot.cn/v1', apiKey: 'mk', model: 'kimi-k3', allowAnyHost: false }],
    aiActiveProfileId: 'p1',
  };
  const resolved = E.resolveAiConfig(raw);
  const renorm = E.normalizeAiConfig(resolved);
  assert.equal(renorm.rawProvider, 'kimi');
  assert.equal(renorm.baseUrl, 'https://api.moonshot.cn/v1');
  assert.equal(renorm.apiKey, 'mk');
  assert.equal(renorm.model, 'kimi-k3');
});

await test('migrateAiProfiles：空存储 → 占位档案（不变式 ≥1）+ changed', async () => {
  const m = E.migrateAiProfiles({});
  assert.equal(m.profiles.length, 1);
  assert.ok(m.profiles[0].id);
  assert.equal(m.activeId, m.profiles[0].id);
  assert.equal(m.changed, true);
});

await test('migrateAiProfiles：旧平铺键迁移为单档案（字段完整保留）', async () => {
  const m = E.migrateAiProfiles({
    aiProvider: 'chatglm', aiBaseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    aiApiKey: 'glm-key', aiModel: 'glm-4.6', aiAllowAnyHost: true,
  });
  assert.equal(m.profiles.length, 1);
  const p = m.profiles[0];
  assert.equal(p.provider, 'chatglm');
  assert.equal(p.baseUrl, 'https://open.bigmodel.cn/api/paas/v4');
  assert.equal(p.apiKey, 'glm-key');
  assert.equal(p.model, 'glm-4.6');
  assert.equal(p.allowAnyHost, true);
  assert.equal(m.activeId, p.id);
  assert.equal(m.changed, true);
});

await test('migrateAiProfiles：已有档案列表 → 原样保留；activeId 非法时回落到首个并标记 changed', async () => {
  const raw = {
    aiProfiles: [
      { id: 'a', name: 'A', provider: 'openai', baseUrl: 'https://a/v1', apiKey: 'ka', model: '', allowAnyHost: false },
      { id: 'b', name: 'B', provider: 'kimi', baseUrl: 'https://b/v1', apiKey: 'kb', model: '', allowAnyHost: false },
    ],
    aiActiveProfileId: 'missing',
  };
  const m = E.migrateAiProfiles(raw);
  assert.equal(m.profiles.length, 2);
  assert.equal(m.activeId, 'a');
  assert.equal(m.changed, true);
  const m2 = E.migrateAiProfiles({ ...raw, aiActiveProfileId: 'b' });
  assert.equal(m2.activeId, 'b');
  assert.equal(m2.changed, false, '合法 activeId 不应触发写回');
});

await test('normalizeAiProfile：字段缺失/类型异常收敛到安全值', async () => {
  const p = E.normalizeAiProfile({ id: 7, name: 123, provider: 'kimi', baseUrl: null, apiKey: undefined, model: 42, allowAnyHost: 'yes' });
  assert.equal(p.id, '7');
  assert.equal(p.name, '123');
  assert.equal(p.baseUrl, '');
  assert.equal(p.apiKey, '');
  assert.equal(p.model, '42');
  assert.equal(p.allowAnyHost, true);
});

await test('resolveAiConfig：档案优先 + profileId/profileName 附带', async () => {
  const raw = {
    aiProfiles: [{ id: 'p9', name: '工作号', provider: 'qwen', baseUrl: 'https://dashscope.example/v1', apiKey: 'qk', model: '', allowAnyHost: false }],
    aiActiveProfileId: 'p9',
    aiBaseUrl: 'https://stale-mirror.example/v1', aiApiKey: 'stale-key', // 陈旧镜像
  };
  const c = E.resolveAiConfig(raw);
  assert.equal(c.baseUrl, 'https://dashscope.example/v1', '镜像过期时档案必须赢');
  assert.equal(c.apiKey, 'qk', '密钥取档案而非镜像');
  assert.equal(c.rawProvider, 'qwen');
  assert.equal(c.model, E.AI_PROVIDERS.qwen.defaultModel, '模型留空回落 provider 默认');
  assert.equal(c.profileId, 'p9');
  assert.equal(c.profileName, '工作号');
});

await test('resolveAiConfig：无档案时回落平铺旧键（迁移时间窗兼容）', async () => {
  const c = E.resolveAiConfig({ aiProvider: 'deepseek', aiBaseUrl: 'https://api.deepseek.com/v1', aiApiKey: 'dk', aiModel: 'deepseek-v4-pro' });
  assert.equal(c.rawProvider, 'deepseek');
  assert.equal(c.baseUrl, 'https://api.deepseek.com/v1');
  assert.equal(c.apiKey, 'dk');
  assert.equal(c.model, 'deepseek-v4-pro');
  assert.equal(c.profileId, '');
  assert.equal(c.profileName, '');
});

await test('resolveAiConfig：activeId 缺失 → 用首个档案（不落空）', async () => {
  const c = E.resolveAiConfig({ aiProfiles: [{ id: 'only', provider: 'kimi', baseUrl: 'https://m/v1', apiKey: 'k' }] });
  assert.equal(c.baseUrl, 'https://m/v1');
  assert.equal(c.profileId, 'only');
});

await test('密钥档案隔离：两份档案各持 Key，解析只暴露当前档案的 Key', async () => {
  const raw = {
    aiProfiles: [
      { id: 'p1', name: 'A', provider: 'openai', baseUrl: 'https://a/v1', apiKey: 'KEY-A', model: '', allowAnyHost: false },
      { id: 'p2', name: 'B', provider: 'openai', baseUrl: 'https://b/v1', apiKey: 'KEY-B', model: '', allowAnyHost: false },
    ],
    aiActiveProfileId: 'p2',
  };
  const a = E.resolveAiConfig({ ...raw, aiActiveProfileId: 'p1' });
  const b = E.resolveAiConfig(raw);
  assert.equal(a.apiKey, 'KEY-A');
  assert.equal(a.baseUrl, 'https://a/v1');
  assert.equal(b.apiKey, 'KEY-B');
  assert.equal(b.baseUrl, 'https://b/v1');
  assert.ok(!JSON.stringify(a).includes('KEY-B'), '非当前档案的 Key 不得出现在解析结果中');
});

await test('AI_CFG_STORAGE_KEYS 覆盖平铺旧键 + 档案键（读写同源）', async () => {
  for (const k of E.AI_CFG_FLAT_KEYS) assert.ok(E.AI_CFG_STORAGE_KEYS.includes(k), '缺平铺键 ' + k);
  assert.ok(E.AI_CFG_STORAGE_KEYS.includes('aiProfiles'));
  assert.ok(E.AI_CFG_STORAGE_KEYS.includes('aiActiveProfileId'));
});

await test('读取路径未回退：background/capabilities 均经由 resolver（防回退源码守卫）', async () => {
  const bg = fs.readFileSync(path.join(root, 'background.js'), 'utf8');
  const cap = fs.readFileSync(path.join(root, 'capabilities.js'), 'utf8');
  const sp = fs.readFileSync(path.join(root, 'sidepanel.js'), 'utf8');
  assert.ok(bg.includes('resolveAiConfig(r)'), 'background.getAiConfig 必须走 resolveAiConfig');
  assert.ok(cap.includes('resolveAiConfig(r)'), 'capabilities.translateViaLLM 必须走 resolveAiConfig');
  assert.ok(!/translateViaLLM[\s\S]{0,600}?\.aiBaseUrl\b/.test(cap.slice(cap.indexOf('async function translateViaLLM'), cap.indexOf('async function translateViaLLM') + 900)),
    'translateViaLLM 不应再直读 r.aiBaseUrl');
  assert.ok(sp.includes('migrateAiProfiles(r)'), 'sidepanel.loadAiConfig 必须走 migrateAiProfiles');
  assert.ok(!/storage\.local\.get\(\['aiProvider', 'aiBaseUrl'/.test(bg + cap + sp), '不应再有旧五键整组直读');
});

await test('aiProviderLabel：已知 provider 有静态标签（新增档案默认名）', async () => {
  assert.equal(E.aiProviderLabel('deepseek'), 'DeepSeek');
  assert.equal(E.aiProviderLabel('kimi'), 'Kimi');
  assert.equal(E.aiProviderLabel('unknown-x'), 'unknown-x');
});

console.log('─'.repeat(64));
const total = passed + failures.length;
console.log(`结果：通过 ${passed}/${total}${failures.length ? '，失败 ' + failures.length : '，全部通过 ✅'}`);
process.exitCode = failures.length ? 1 : 0;
