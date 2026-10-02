#!/usr/bin/env node
// ECDICT → 划词即显离线词典子集（docs/009 §3.1）
// 用法：node tools/build-ecdict-subset.js [ecdict.csv 路径]
//   缺省自动 `npm pack ecdict` 取官方 npm 包内全量 CSV（22MB tgz，一次性）。
// 产物：data/ecdict-top50k.json.gz
//   体积规则（009 审阅决定①）：gzip 产物 ≤5MB → 随扩展打包；>5MB → 打印 CDN 模式指引。
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const os = require('os');
const { execSync } = require('child_process');

const TOP_N = parseInt(process.env.ECDICT_TOP_N || '50000', 10);
const LIMIT_MB = 5;

function acquireCsv(argPath) {
  if (argPath) return argPath;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ecdict-'));
  console.log('[build] npm pack ecdict（约 22MB，一次性下载）…');
  const name = execSync('npm pack ecdict --silent', { cwd: tmp, encoding: 'utf8' }).trim().split('\n').pop();
  execSync(`tar -xzf ${path.join(tmp, name)} package/assets/ecdict.csv -C ${tmp}`);
  return path.join(tmp, 'package', 'assets', 'ecdict.csv');
}

// 流式状态机 CSV 解析（字段含引号/逗号/换行）
function parseCsv(file, onRow) {
  const raw = fs.readFileSync(file, 'utf8');
  let row = [], field = '', inQ = false, hit = false;
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (inQ) {
      if (c === '"') { if (raw[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += c;
    } else if (c === '"') { inQ = true; hit = true; }
    else if (c === ',') { row.push(hit ? field : field.trim()); field = ''; hit = false; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && raw[i + 1] === '\n') i++;
      row.push(hit ? field : field.trim());
      if (row.length > 1 || row[0] !== '') onRow(row);
      row = []; field = ''; hit = false;
    } else field += c;
  }
  if (field || row.length) { row.push(hit ? field : field.trim()); onRow(row); }
}

function clip(s, lines, width) {
  const out = String(s || '').split('\n').map(l => l.trim()).filter(Boolean)
    .slice(0, lines).map(l => (l.length > width ? l.slice(0, width - 1) + '…' : l));
  return out.join('\n');
}

function main() {
  const csvPath = acquireCsv(process.argv[2]);
  console.log('[build] 解析', csvPath);
  const header = ['word', 'phonetic', 'definition', 'translation', 'pos', 'collins', 'oxford', 'tag', 'bnc', 'frq', 'exchange'];
  const rows = [];
  let total = 0;
  parseCsv(csvPath, (r) => {
    total++;
    const o = {};
    header.forEach((k, i) => { o[k] = r[i] || ''; });
    if (!o.translation && !o.definition) return; // 无释义的条目无用
    const bnc = parseInt(o.bnc, 10) || 0, frq = parseInt(o.frq, 10) || 0;
    const rank = Math.min(bnc || Infinity, frq || Infinity);
    rows.push({ rank, word: o.word, phonetic: (o.phonetic.split(',')[0] || '').trim(), defEn: clip(o.definition, 3, 120), defZh: clip(o.translation, 4, 100), exchange: o.exchange.length <= 80 ? o.exchange : '', badge: [o.collins ? 'C' + o.collins : '', o.oxford ? 'O1' : ''].filter(Boolean).join(' ') });
  });
  rows.sort((a, b) => a.rank - b.rank || b.word.length - a.word.length);
  const picked = rows.slice(0, TOP_N);
  const dict = {};
  for (const r of picked) dict[r.word.toLowerCase()] = [r.phonetic, r.defEn, r.defZh, r.exchange, r.badge];
  const json = JSON.stringify(dict);
  const gz = zlib.gzipSync(Buffer.from(json), { level: 9 });

  // 反向索引：中文释义词 → 英文词头（zh→en 离线对照，docs/009 §3.1；频率序即权重序）
  const zhRev = {};
  for (const r of picked) {
    if (!r.defZh) continue;
    const terms = r.defZh.split('\n').join('，')
      .replace(/(^|\s)[a-zA-Z.]+\s/g, '$1')   // 去行首词性标记（n. / v. / a. ...）
      .split(/[，,；;、\s]+/).map(s => s.trim())
      .filter(s => s.length >= 1 && s.length <= 4 && /^[\u4e00-\u9fff]+$/.test(s))
      .slice(0, 6);
    for (const term of terms) {
      const arr = zhRev[term] || (zhRev[term] = []);
      if (arr.length < 3 && !arr.includes(r.word.toLowerCase())) arr.push(r.word.toLowerCase());
    }
  }
  const revJson = JSON.stringify(zhRev);
  const revGz = zlib.gzipSync(Buffer.from(revJson), { level: 9 });

  fs.mkdirSync(path.join(__dirname, '..', 'data'), { recursive: true });
  const out = path.join(__dirname, '..', 'data', 'ecdict-top50k.json.gz');
  fs.writeFileSync(out, gz);
  const outRev = path.join(__dirname, '..', 'data', 'ecdict-zh-rev.json.gz');
  fs.writeFileSync(outRev, revGz);

  const mb = (n) => (n / 1048576).toFixed(2) + 'MB';
  console.log(`[build] 全量 ${total} 条 → 入选 ${picked.length} 条，反向索引 ${Object.keys(zhRev).length} 个中文词`);
  console.log(`[build] 词典原始 ${mb(json.length)} → gzip ${mb(gz.length)} → ${out}`);
  console.log(`[build] 反向原始 ${mb(revJson.length)} → gzip ${mb(revGz.length)} → ${outRev}`);
  if (gz.length <= LIMIT_MB * 1048576 && revGz.length <= LIMIT_MB * 1048576) {
    console.log(`[build] ✅ gzip 产物 ≤ ${LIMIT_MB}MB → 随扩展打包（docs/009 §3.1 体积规则）`);
  } else {
    console.log(`[build] ⚠️ gzip 产物 > ${LIMIT_MB}MB → 按 009 §3.1 应切 CDN 模式：产物上传 Release/jsDelivr，扩展首用时拉取缓存`);
    process.exitCode = 2;
  }
}
main();
