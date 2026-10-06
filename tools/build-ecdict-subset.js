#!/usr/bin/env node
// ECDICT → 划词即显离线词典子集（docs/009 §3.1）
// 用法：node tools/build-ecdict-subset.js [--full] [ecdict.csv 路径]
//   缺省自动 `npm pack ecdict` 取官方 npm 包内全量 CSV（22MB tgz，一次性）。
// 产物：data/ecdict-top50k.json.gz（英文词头 → 字段数组）
//       data/ecdict-zh-rev.json.gz（中文释义词 → 英文词头候选，zh→en 离线对照）
//       data/ecdict-zh-pinyin.json.gz（反向索引中文词 → 拼音，gtx 不可达时的离线原词读音）
//   --full：另产 data/ecdict-full/{a..z,#}.json.gz + manifest.json（全量词典按首字母分桶，
//       docs/013 §2.3 CDN 分发：提交开源仓 → jsDelivr 服务 → 扩展首用拉取 IndexedDB 缓存）
//   体积规则（009 审阅决定①）：gzip 产物 ≤5MB → 随扩展打包；>5MB → 打印 CDN 模式指引。
//   拼音索引依赖 pinyin-pro；无法获取时跳过该产物（不视为失败）。
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const os = require('os');
const { execSync } = require('child_process');

const TOP_N = parseInt(process.env.ECDICT_TOP_N || '50000', 10);
const LIMIT_MB = 5;
const REV_CAP = 6;          // docs/013 §2.4：多义词候选并列展示（原 3 → 6，卡片取前 4）
const FULL_BUCKET_MB = 19;  // jsDelivr 单文件 20MB 上限，留余量
const WANT_FULL = process.argv.includes('--full');

function acquireCsv(argPath) {
  if (argPath) return argPath;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ecdict-'));
  console.log('[build] npm pack ecdict（约 22MB，一次性下载）…');
  const name = execSync('npm pack ecdict --silent', { cwd: tmp, encoding: 'utf8' }).trim().split('\n').pop();
  execSync(`tar -xzf ${path.join(tmp, name)} -C ${tmp} package/assets/ecdict.csv`); // -C 须在成员名前（bsdtar）
  return path.join(tmp, 'package', 'assets', 'ecdict.csv');
}

// 获取 pinyin-pro（优先本地已装，否则 npm pack 到临时目录再 require）；失败返回 null
function acquirePinyin() {
  try { return require('pinyin-pro'); } catch (e) {}
  try {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pinyin-'));
    console.log('[build] npm pack pinyin-pro（离线拼音索引用）…');
    const name = execSync('npm pack pinyin-pro --silent', { cwd: tmp, encoding: 'utf8' }).trim().split('\n').pop();
    execSync(`tar -xzf ${path.join(tmp, name)} -C ${tmp}`);
    return require(path.join(tmp, 'package'));
  } catch (e) {
    console.warn('[build] ⚠️ 无法获取 pinyin-pro，跳过拼音索引:', e.message);
    return null;
  }
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
  const csvPath = acquireCsv(process.argv.filter((a) => !a.startsWith('--'))[2]);
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
      if (arr.length < REV_CAP && !arr.includes(r.word.toLowerCase())) arr.push(r.word.toLowerCase());
    }
  }
  const revJson = JSON.stringify(zhRev);
  const revGz = zlib.gzipSync(Buffer.from(revJson), { level: 9 });

  // 拼音索引：反向索引的中文词 → 拼音（含声调符号）。gtx `dt=rm` 不可达时离线补 sourceRoman（009 §11.3）
  const py = acquirePinyin();
  let pyGz = null, pyCount = 0;
  if (py && typeof py.pinyin === 'function') {
    const zhPy = {};
    for (const term of Object.keys(zhRev)) {
      try {
        const arr = py.pinyin(term, { toneType: 'symbol', type: 'array' });
        const s = Array.isArray(arr) ? arr.join(' ') : String(arr || '');
        if (s) { zhPy[term] = s; pyCount++; }
      } catch (e) {}
    }
    pyGz = zlib.gzipSync(Buffer.from(JSON.stringify(zhPy)), { level: 9 });
  }

  fs.mkdirSync(path.join(__dirname, '..', 'data'), { recursive: true });
  const out = path.join(__dirname, '..', 'data', 'ecdict-top50k.json.gz');
  fs.writeFileSync(out, gz);
  const outRev = path.join(__dirname, '..', 'data', 'ecdict-zh-rev.json.gz');
  fs.writeFileSync(outRev, revGz);
  const outPy = path.join(__dirname, '..', 'data', 'ecdict-zh-pinyin.json.gz');
  if (pyGz) fs.writeFileSync(outPy, pyGz);

  // 全量词典分桶（docs/013 §2.3，--full）：首字母 → 桶，条目同 top50k 格式（exchange 置空省体积）。
  // 重复词头保留首次出现（rows 已按频率升序 → 先出现 = 高频条目）。
  if (WANT_FULL) {
    const mb2 = (n) => (n / 1048576).toFixed(2) + 'MB';
    const buckets = {};
    for (const r of rows) {
      const w = r.word.toLowerCase();
      const c = /^[a-z]/.test(w) ? w[0] : '#';
      const b = buckets[c] || (buckets[c] = {});
      if (!b[w]) b[w] = [r.phonetic, r.defEn, r.defZh, '', r.badge];
    }
    const fullDir = path.join(__dirname, '..', 'data', 'ecdict-full');
    fs.mkdirSync(fullDir, { recursive: true });
    const bucketMeta = {};
    let entries = 0, biggest = 0;
    for (const c of Object.keys(buckets).sort()) {
      const bJson = JSON.stringify(buckets[c]);
      const bGz = zlib.gzipSync(Buffer.from(bJson), { level: 9 });
      biggest = Math.max(biggest, bGz.length);
      if (bGz.length > FULL_BUCKET_MB * 1048576) console.warn(`[build] ⚠️ 桶 ${c} gzip ${mb2(bGz.length)} 超过 jsDelivr 单文件安全上限 ${FULL_BUCKET_MB}MB，需再细分`);
      fs.writeFileSync(path.join(fullDir, c + '.json.gz'), bGz);
      bucketMeta[c] = { entries: Object.keys(buckets[c]).length, gzBytes: bGz.length };
      entries += Object.keys(buckets[c]).length;
    }
    const version = 'ecdict-' + entries + '-' + new Date().toISOString().slice(0, 10).replace(/-/g, '');
    fs.writeFileSync(path.join(fullDir, 'manifest.json'), JSON.stringify({ version, builtAt: new Date().toISOString(), entries, buckets: bucketMeta }, null, 2));
    console.log(`[build] 全量分桶 ${Object.keys(bucketMeta).length} 桶 / ${entries} 条（最大桶 gzip ${mb2(biggest)}）→ ${fullDir}`);
    console.log(`[build] version ${version} —— 提交开源仓并推送后 jsDelivr 即可服务（扩展端 ECDICT_CDN_BASE → @main）`);
  }

  const mb = (n) => (n / 1048576).toFixed(2) + 'MB';
  console.log(`[build] 全量 ${total} 条 → 入选 ${picked.length} 条，反向索引 ${Object.keys(zhRev).length} 个中文词`);
  console.log(`[build] 词典原始 ${mb(json.length)} → gzip ${mb(gz.length)} → ${out}`);
  console.log(`[build] 反向原始 ${mb(revJson.length)} → gzip ${mb(revGz.length)} → ${outRev}`);
  if (pyGz) console.log(`[build] 拼音 ${pyCount} 词 → gzip ${mb(pyGz.length)} → ${outPy}`);
  const sizes = [gz.length, revGz.length, ...(pyGz ? [pyGz.length] : [])];
  if (sizes.every((n) => n <= LIMIT_MB * 1048576)) {
    console.log(`[build] ✅ gzip 产物 ≤ ${LIMIT_MB}MB（合计 ${mb(sizes.reduce((a, b) => a + b, 0))}）→ 随扩展打包（docs/009 §3.1 体积规则）`);
  } else {
    console.log(`[build] ⚠️ gzip 产物 > ${LIMIT_MB}MB → 按 009 §3.1 应切 CDN 模式：产物上传 Release/jsDelivr，扩展首用时拉取缓存`);
    process.exitCode = 2;
  }
}
main();
