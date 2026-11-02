/* v170: 論点IDによる「つながり」表示（後付けモジュール、全分野版）。
 * core.js 本体・問題データ・学習履歴には触らない。renderPastRelated を包み、
 * 結果画面の専用枠 #topicLinks にだけ描く。対象は全1,975問。
 * リンクは2種:
 *  - 同じ論点: この問題の正解肢の論点が、別年度の問題でも正解側になっている
 *  - 誤答→正解: この問題の誤答肢の論点が、別年度の問題では正解側になっている
 *    （自分が選んだ誤答肢からのリンクを前面に出す）
 */
(() => {
  'use strict';
  if (typeof PT_CHOICE_TAGS === 'undefined' || typeof PT_TOPIC_MASTER === 'undefined') return;
  if (typeof BYID === 'undefined' || typeof renderPastRelated !== 'function' || typeof beginOne !== 'function') return;
  // 前提の手当て: 拡張分の5肢別解説エントリ(1,713件)には refs が無く、core の
  // showOptionRationales が d.refs.length で例外を投げ、復習のポイント以降の
  // 結果表示(このパイロット含む)が止まっていた。空配列で正規化して通す。
  if (typeof RATIONALES !== 'undefined') {
    for (const d of Object.values(RATIONALES)) { if (d && !Array.isArray(d.refs)) d.refs = []; }
  }
  const $ = id => document.getElementById(id);
  const tags = PT_CHOICE_TAGS;
  const scopeByTopic = Object.fromEntries(PT_TOPIC_MASTER.map(t => [t.name, t.scope]));

  const correctNums = id => {
    const q = BYID[id];
    if (!q) return new Set();
    const sets = Array.isArray(q.acceptedKeys) && q.acceptedKeys.length ? q.acceptedKeys : [q.key || []];
    const s = new Set();
    sets.forEach(a => (a || []).forEach(n => s.add(Number(n))));
    return s;
  };
  // 正解肢に付いた論点 = その問題の中心論点 (core)
  const coreById = {};
  for (const id of Object.keys(tags)) {
    const cs = correctNums(id);
    const out = new Set();
    (tags[id].choices || []).forEach(c => { if (cs.has(c.n)) (c.topics || []).forEach(t => out.add(t)); });
    coreById[id] = [...out];
  }
  // 論点 -> その論点が正解側の問題ID一覧
  const coreIndex = {};
  for (const [id, topics] of Object.entries(coreById)) topics.forEach(t => { (coreIndex[t] ??= []).push(id); });

  const otherYear = (a, b) => a.slice(0, 2) !== b.slice(0, 2);
  const playable = id => !!BYID[id] && !BYID[id].provisional;
  const el = (tag, cls, text) => { const d = document.createElement(tag); if (cls) d.className = cls; if (text !== undefined) d.textContent = text; return d; };
  const trunc = (s, n) => { s = String(s || ''); return s.length > n ? s.slice(0, n) + '…' : s; };

  function linkBlock(titleText, descText, targetId) {
    const box = el('div', 'suggested-sibling');
    box.append(el('strong', '', titleText));
    if (descText) box.append(el('p', '', descText));
    const btn = el('button', 'tiny primary', 'この問題を解く');
    btn.type = 'button';
    btn.addEventListener('click', () => beginOne(targetId));
    box.append(btn);
    return box;
  }

  function ensureRoot() {
    let root = $('topicLinks');
    if (root) return root;
    root = el('div', 'hidden'); root.id = 'topicLinks';
    const tip = $('learningTip');
    if (tip && tip.parentNode) tip.parentNode.insertBefore(root, tip.nextSibling);
    else $('feedback')?.append(root);
    return root;
  }

  function decorate(id) {
    const root = ensureRoot();
    root.replaceChildren();
    const entry = tags[id];
    const q = BYID[id];
    if (!entry || !q) { root.classList.add('hidden'); return; }
    const core = coreById[id] || [];
    if (!core.length) { root.classList.add('hidden'); return; }

    // 同じ論点の別年度問題
    const sameMap = new Map(); // targetId -> shared topics[]
    core.forEach(t => (coreIndex[t] || []).forEach(o => {
      if (o !== id && otherYear(id, o) && playable(o)) {
        if (!sameMap.has(o)) sameMap.set(o, []);
        sameMap.get(o).push(t);
      }
    }));
    const sameList = [...sameMap.entries()]
      .map(([target, shared]) => ({ target, shared }))
      .sort((a, b) => b.shared.length - a.shared.length || a.target.localeCompare(b.target));

    // 誤答→正解リンク（選択肢単位）
    const cs = correctNums(id);
    const selected = (typeof selection !== 'undefined' && Array.isArray(selection)) ? selection : [];
    const wrongLinks = []; // {n, topic, target, cross, selected}
    (entry.choices || []).forEach(c => {
      if (cs.has(c.n)) return;
      (c.topics || []).forEach(t => {
        (coreIndex[t] || []).forEach(o => {
          if (o !== id && otherYear(id, o) && playable(o)) {
            wrongLinks.push({ n: c.n, topic: t, target: o, cross: !core.includes(t), selected: selected.includes(c.n) });
          }
        });
      });
    });
    const frontWrong = wrongLinks
      .filter(x => x.selected)
      .sort((a, b) => Number(b.cross) - Number(a.cross) || a.target.localeCompare(b.target));
    // 前面に出した誤答リンクの対象は、同じ論点リストと重ねない
    const frontTargets = new Set(frontWrong.slice(0, 3).map(x => x.target));

    root.classList.remove('hidden');
    root.append(el('h3', '', 'つながりで確認する'));
    const coreLine = el('p', 'caption');
    coreLine.append(document.createTextNode('この問題の論点：'));
    const strong = el('strong', '', core.join('、'));
    coreLine.append(strong);
    root.append(coreLine);
    if (scopeByTopic[core[0]]) root.append(el('p', 'caption', scopeByTopic[core[0]]));

    // 自分が選んだ誤答肢からのリンクを前面に
    const seenFront = new Set();
    let frontCount = 0;
    for (const x of frontWrong) {
      if (frontCount >= 3) break;
      const key = x.n + ':' + x.topic + ':' + x.target;
      if (seenFront.has(key)) continue;
      seenFront.add(key); frontCount++;
      if (frontCount === 1) {
        const box = el('div', 'topic-wrong-box');
        box.append(el('strong', '', '選んだ選択肢の内容は、別の年度では正解です'));
        root.append(box);
        root._frontBox = box;
      }
      const choiceText = trunc(q.opts[x.n - 1], 42);
      root._frontBox.append(linkBlock(
        x.target + '｜' + x.topic,
        '選択肢' + x.n + '「' + choiceText + '」はこの問題では誤答ですが、' + x.target + ' では正解側の論点です。',
        x.target
      ));
    }

    // 同じ論点：まず3問まで
    const sameVisible = sameList.filter(x => !frontTargets.has(x.target)).slice(0, 3);
    const sameRest = sameList.filter(x => !frontTargets.has(x.target)).slice(3);
    if (sameVisible.length) {
      const head = el('strong', '', '同じ論点の別年度問題');
      root.append(head);
      for (const x of sameVisible) {
        root.append(linkBlock(
          x.target + '｜' + x.shared.join('・'),
          trunc(BYID[x.target].stem, 72),
          x.target
        ));
      }
    }

    // もっと見る：残りの同じ論点 + 中心論点と異なる誤答リンク（混同の元）
    const crossWrong = wrongLinks.filter(x => x.cross && !x.selected);
    const seenCross = new Set();
    const crossUnique = crossWrong.filter(x => { const k = x.n + ':' + x.topic + ':' + x.target; if (seenCross.has(k)) return false; seenCross.add(k); return true; });
    if (sameRest.length || crossUnique.length) {
      const details = el('details', 'candidate-details');
      const summary = el('summary', '', 'もっと見る（同じ論点あと' + sameRest.length + '問／誤答が正解になる問題 ' + crossUnique.length + '件）');
      details.append(summary);
      for (const x of sameRest.slice(0, 10)) {
        details.append(linkBlock(x.target + '｜' + x.shared.join('・'), trunc(BYID[x.target].stem, 72), x.target));
      }
      if (sameRest.length > 10) details.append(el('p', 'caption', '同じ論点はほかにもあります（表示は10問まで）。'));
      for (const x of crossUnique.slice(0, 10)) {
        const choiceText = trunc(q.opts[x.n - 1], 42);
        details.append(linkBlock(
          x.target + '｜' + x.topic,
          '選択肢' + x.n + '「' + choiceText + '」の論点は、' + x.target + ' では正解側です。',
          x.target
        ));
      }
      if (crossUnique.length > 10) details.append(el('p', 'caption', '誤答リンクはほかにもあります（表示は10件まで）。'));
      root.append(details);
    }

    if (!sameList.length && !wrongLinks.length) {
      root.append(el('p', 'caption', '別年度へのつながりはまだありません。'));
    }
    root.append(el('p', 'caption', '論点タグは全問題に付与済み（論点411件）。誤答肢の論点も全分野横断でつながります。'));
  }

  const legacy = renderPastRelated;
  renderPastRelated = function (id) { try { legacy(id); } catch (e) { /* 旧枠は v168 で除去済み */ } decorate(id); };
})();
