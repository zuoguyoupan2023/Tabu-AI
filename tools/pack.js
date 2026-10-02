#!/usr/bin/env node
// 扩展发布打包（docs/009 §11.3）
// 用法：npm run pack
// 产物：dist/tabu-ai-<version>/    —— 可直接「加载已解压的扩展程序」（含 manifest.json）
//       dist/tabu-ai-<version>.zip —— 分发用压缩包（内容同上）
//   仅含扩展运行时文件，data/ 离线词典资产随包；
//   排除：docs/（私有文档）、node_modules/、tools/、bridge/（Node 桥接服务，独立分发）、
//         package*.json、.git*、dist/ 自身。
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.join(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const version = manifest.version;
const dist = path.join(root, 'dist');
fs.mkdirSync(dist, { recursive: true });

// 顶层排除项（其余全部打进包，避免漏掉运行时资源）
const SKIP = new Set([
  'docs', 'node_modules', '.git', 'tools', 'bridge', 'dist',
  'package.json', 'package-lock.json', '.DS_Store', '.gitignore', '.gitattributes',
]);
const entries = fs.readdirSync(root).filter((n) => !SKIP.has(n));

// ① 干净的可加载目录（load unpacked 直接指向它）
const stageDir = path.join(dist, `tabu-ai-${version}`);
const zipPath = path.join(dist, `tabu-ai-${version}.zip`);
fs.rmSync(stageDir, { recursive: true, force: true });
fs.rmSync(zipPath, { force: true });
fs.mkdirSync(stageDir, { recursive: true });
for (const name of entries) {
  fs.cpSync(path.join(root, name), path.join(stageDir, name), { recursive: true });
}

// ② 同内容的 zip（在 stage 目录内打包，保证 manifest.json 位于压缩包根部）
console.log(`[pack] 打包扩展 v${version}（${entries.length} 个顶层条目）…`);
execFileSync('zip', ['-r', '-q', zipPath, ...entries], { cwd: stageDir });

// 体积报告（词典资产是主要构成，便于核对 docs/009 的体积预算）
const mb = (n) => (n / 1048576).toFixed(2) + 'MB';
const size = (p) => { try { return fs.statSync(p).size; } catch (e) { return 0; } };
let dataTotal = 0;
for (const f of fs.readdirSync(path.join(root, 'data'))) dataTotal += size(path.join(root, 'data', f));
console.log(`[pack] 词典资产 ${mb(dataTotal)}（data/*.gz）`);
console.log(`[pack] 解压目录 ${stageDir}（加载已解压的扩展程序选这里）`);
console.log(`[pack] 压缩包 ${zipPath} · ${mb(size(zipPath))}`);
