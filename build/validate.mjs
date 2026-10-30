#!/usr/bin/env node
/**
 * PT国試アプリ v129 データ検証スクリプト
 *
 * 使い方: node build/validate.mjs
 * 出力: コンソール要約 + build/validation-report.json + build/validation-report.md
 * 終了コード: エラー(E)が1件以上あれば 1、なければ 0（警告 W は失敗にしない）
 *
 * 方針:
 * - 正答は公式正答表由来の key / void のみを正とする。このスクリプトはデータを書き換えない。
 * - 意味の矛盾（解説と正答の食い違い）は機械で断定できないため、警告(W-01)として候補を挙げるに留める。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

// ---- データ読み込み（アプリと同じ JS データをそのまま評価する） ----
function loadData() {
  // 全データファイルを1つのスコープで評価する（expansion が RATIONALES へ Object.assign するため）
  const combined = [
    'data/questions.js',
    'data/rationales.js',
    'data/rationale-expansion-v128.js',
    'data/rationale-expansion-pilot-w01.js',
    'data/related.js',
    'data/knowledge-v121.js',
  ].map((rel) => read(rel).replace(/^'use strict';/m, '')).join('\n');
  return new Function(`${combined}; return { QUESTIONS, RATIONALES, CURATED_STUDY_LINKS, PT_KNOWLEDGE_V121 };`)();
}

const { QUESTIONS, RATIONALES, CURATED_STUDY_LINKS, PT_KNOWLEDGE_V121 } = loadData();
const coreSrc = read('js/core.js');
const DOMAINS = JSON.parse(coreSrc.match(/const DOMAINS=(\[[^\]]*\])/)[1].replace(/'/g, '"'));
const figurePathsInCore = [...new Set([...coreSrc.matchAll(/assets\/figures\/[A-Za-z0-9._-]+/g)].map((m) => m[0]))];
const manifest = JSON.parse(read('data/figure-manifest.json'));

const errors = [];   // {code, id?, message}
const warnings = [];
const E = (code, message, id) => errors.push({ code, id: id || null, message });
const W = (code, message, id) => warnings.push({ code, id: id || null, message });

const byId = new Map();
for (const q of QUESTIONS) byId.set(q.id, q);

// ---- E-01 問題数 ----
if (QUESTIONS.length !== 2000) E('E-01', `問題数が 2000 ではありません: ${QUESTIONS.length}`);

// ---- E-02 ID重複・形式・年度ごとの完全性 ----
{
  const seen = new Set();
  for (const q of QUESTIONS) {
    if (seen.has(q.id)) E('E-02', '問題IDが重複しています', q.id);
    seen.add(q.id);
    if (!/^\d{2}-(AM|PM)-\d{3}$/.test(q.id)) E('E-02', `問題IDの形式が不正です: ${q.id}`, q.id);
  }
  for (let y = 52; y <= 61; y++) for (const s of ['AM', 'PM']) for (let n = 1; n <= 100; n++) {
    const id = `${y}-${s}-${String(n).padStart(3, '0')}`;
    if (!seen.has(id)) E('E-02', '問題IDが欠けています', id);
  }
}

// ---- E-03 選択肢・正答キー・採点除外の整合 ----
let voidCount = 0;
for (const q of QUESTIONS) {
  if (!Array.isArray(q.opts) || q.opts.length !== 5 || q.opts.some((o) => !String(o).trim()))
    E('E-03', '選択肢が5つ揃っていません', q.id);
  const key = Array.isArray(q.key) ? q.key : [];
  if (q.void) {
    voidCount++;
    if (key.length !== 0) E('E-03', '採点除外(void)なのに正答キーが設定されています', q.id);
  } else {
    if (key.length < 1 || key.length > 2) E('E-03', `正答キーの数が不正です (${key.length})`, q.id);
    if (key.some((k) => !Number.isInteger(k) || k < 1 || k > 5)) E('E-03', '正答キーが範囲外です', q.id);
    if (new Set(key).size !== key.length) E('E-03', '正答キーが重複しています', q.id);
  }
  if (q.acceptedKeys) {
    for (const set of q.acceptedKeys) {
      if (!Array.isArray(set) || set.some((k) => k < 1 || k > 5)) E('E-03', '別解(acceptedKeys)に不正な値があります', q.id);
    }
  }
}

// ---- E-04 分野(cat)が正式14分野に含まれているか ----
const unmappedCats = new Map();
for (const q of QUESTIONS) {
  if (!DOMAINS.includes(q.cat)) {
    unmappedCats.set(q.cat, (unmappedCats.get(q.cat) || 0) + 1);
    E('E-04', `cat「${q.cat}」が正式14分野(DOMAINS)に無く、分野別集計・絞り込みから漏れます`, q.id);
  }
}

// ---- E-05 図: マニフェストと実ファイル、core.js内の参照 ----
for (const p of manifest) if (!fs.existsSync(path.join(ROOT, p))) E('E-05', `マニフェストにある図ファイルが存在しません: ${p}`);
for (const p of figurePathsInCore) if (!fs.existsSync(path.join(ROOT, p))) E('E-05', `core.jsが参照する図ファイルが存在しません: ${p}`);
{
  const onDisk = fs.readdirSync(path.join(ROOT, 'assets/figures')).map((f) => `assets/figures/${f}`);
  for (const p of onDisk) if (!manifest.includes(p) && !figurePathsInCore.includes(p))
    W('W-05', `図ファイルがマニフェストにも core.js 参照にもありません（未使用の可能性）: ${p}`);
}

// ---- E-06 5肢別解説の整合 ----
for (const [id, r] of Object.entries(RATIONALES)) {
  if (!byId.has(id)) E('E-06', '5肢別解説の問題IDが問題データにありません', id);
  else if (!Array.isArray(r.options) || r.options.length !== 5) E('E-06', '5肢別解説が5肢分揃っていません', id);
}

// ---- E-07 関連リンクの整合 ----
let relatedLinks = 0;
for (const [from, links] of Object.entries(CURATED_STUDY_LINKS)) {
  if (!byId.has(from)) E('E-07', '関連リンク元の問題IDが存在しません', from);
  for (const l of links) {
    relatedLinks++;
    if (!byId.has(l.id)) E('E-07', `関連リンク先が存在しません: ${from} -> ${l.id}`, from);
    if (l.id === from) E('E-07', '関連リンクが自分自身を指しています', from);
  }
}

// ---- 集計の突合（画面表示 1,849問 との差異検出用に内訳を出す） ----
const stats = {
  total: QUESTIONS.length,
  void: voidCount,
  gradable: QUESTIONS.length - voidCount,
  provisional: QUESTIONS.filter((q) => q.provisional).length,
  inDomains: QUESTIONS.filter((q) => DOMAINS.includes(q.cat)).length,
  inDomainsGradable: QUESTIONS.filter((q) => DOMAINS.includes(q.cat) && !q.void).length,
  inDomainsGradableNonProvisional: QUESTIONS.filter((q) => DOMAINS.includes(q.cat) && !q.void && !q.provisional).length,
  rationales: Object.keys(RATIONALES).length,
  relatedSourceQuestions: Object.keys(CURATED_STUDY_LINKS).length,
  relatedLinks,
  knowledgeQuestions: PT_KNOWLEDGE_V121?.questions ? Object.keys(PT_KNOWLEDGE_V121.questions).length : null,
  noVerification: QUESTIONS.filter((q) => !q.verification).length,
  figureManifest: manifest.length,
  figurePathsInCore: figurePathsInCore.length,
};

// ---- W-01 解説(why)と正答の意味的な食い違い候補 ----
// why が誤答肢の語句を多く含み、正答肢の語句をほぼ含まない問題を候補として挙げる（断定はしない）。
function trigrams(s) {
  const t = String(s).replace(/[\s〈〉（）()・\/、。，．:：;；「」『』\[\]0-9０-９]/g, '');
  const set = new Set();
  for (let i = 0; i + 3 <= t.length; i++) set.add(t.slice(i, i + 3));
  return set;
}
function coverage(optText, whyText) {
  const tri = trigrams(optText);
  if (!tri.size) return 0;
  let hit = 0;
  for (const g of tri) if (whyText.includes(g)) hit++;
  return hit / tri.size;
}
let w01 = 0;
for (const q of QUESTIONS) {
  if (q.void || !q.key?.length || RATIONALES[q.id] || !q.why) continue; // 5肢解説がある問題は対象外
  const cov = q.opts.map((o) => coverage(o, q.why));
  const correctCov = Math.max(...q.key.map((k) => cov[k - 1]));
  const wrongCov = Math.max(...cov.filter((_, i) => !q.key.includes(i + 1)));
  if (wrongCov >= 0.15 && wrongCov > correctCov + 0.05 && correctCov < 0.1) {
    w01++;
    W('W-01', `解説(why)が誤答肢の語句に寄っていて正答肢にほぼ触れていない疑い (誤答肢一致 ${(wrongCov * 100).toFixed(0)}% / 正答肢一致 ${(correctCov * 100).toFixed(0)}%)`, q.id);
  }
}

// ---- W-02 照合記録なし / W-03 解説カバレッジ ----
if (stats.noVerification) W('W-02', `verification（照合状況）の記録がない問題が ${stats.noVerification} 問あります`);
W('W-03', `5肢別解説の登録は ${stats.rationales} / ${stats.total} 問です。残りは why の1文解説のみです`);

// ---- レポート出力 ----
const report = { generatedAt: new Date().toISOString(), stats, errorCount: errors.length, warningCount: warnings.length, errors, warnings };
fs.writeFileSync(path.join(ROOT, 'build/validation-report.json'), JSON.stringify(report, null, 2));

const byCode = (list) => list.reduce((m, x) => ((m[x.code] = (m[x.code] || 0) + 1), m), {});
const md = [
  '# データ検証レポート（自動生成）',
  '',
  `- 生成日時: ${report.generatedAt}`,
  `- エラー: ${errors.length} 件 / 警告: ${warnings.length} 件`,
  '',
  '## 集計',
  ...Object.entries(stats).map(([k, v]) => `- ${k}: ${v}`),
  '',
  '## エラー内訳（コード別）',
  ...Object.entries(byCode(errors)).map(([k, v]) => `- ${k}: ${v} 件`),
  '',
  '## 警告内訳（コード別）',
  ...Object.entries(byCode(warnings)).map(([k, v]) => `- ${k}: ${v} 件`),
  '',
  '## 分野未対応の cat 一覧（E-04）',
  ...[...unmappedCats.entries()].sort((a, b) => b[1] - a[1]).map(([c, n]) => `- ${c}: ${n} 問`),
  '',
  '## W-01 解説と正答の食い違い候補（先頭50件・全件はJSON）',
  ...warnings.filter((x) => x.code === 'W-01').slice(0, 50).map((x) => `- ${x.id}: ${x.message}`),
  '',
  '※ W-01 は機械的な候補抽出であり、矛盾の断定ではありません。人が読んで判断してください。',
].join('\n');
fs.writeFileSync(path.join(ROOT, 'build/validation-report.md'), md);

console.log(`検証完了: エラー ${errors.length} 件 / 警告 ${warnings.length} 件`);
console.log('コード別エラー:', byCode(errors));
console.log('コード別警告:', byCode(warnings));
console.log('集計:', stats);
console.log('詳細: build/validation-report.json / build/validation-report.md');
process.exit(errors.length ? 1 : 0);
