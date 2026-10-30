/* v122: enrich the existing answered-question related-learning area.
 * Avoid changes to official question data, scoring, localStorage, navigation, and existing related lists.
 * All v121 analysis associations remain provisional until separate full medical/source review.
 */
(()=>{
'use strict';
if(typeof PT_KNOWLEDGE_V121==='undefined'||typeof BYID==='undefined'||typeof renderPastRelated!=='function'||typeof beginOne!=='function')return;
const m=PT_KNOWLEDGE_V121;
const $=id=>document.getElementById(id);
const linksById={};const modulesById={};
for(const l of m.links){
 (linksById[l.from]??=[]).push({...l,reverse:false,target:l.to});
 (linksById[l.to]??=[]).push({...l,reverse:true,target:l.from});
}
for(const [k,v] of Object.entries(m.modules))for(const q of v.questionIds)(modulesById[q]??=[]).push(k);
const el=(tag,cls,text)=>{const d=document.createElement(tag);if(cls)d.className=cls;if(text!==undefined)d.textContent=text;return d};
const one=(parent,tag,cls,text)=>{const d=el(tag,cls,text);parent.append(d);return d};
const safe=id=>typeof id==='string'&&Object.prototype.hasOwnProperty.call(BYID,id);
function decorate(id){
 const parent=$('pastRelatedList'); if(!parent||!safe(id)||!m.questions[id])return;
 const associated=(linksById[id]||[])
   .filter(l=>safe(l.target)&&id.slice(0,2)!==l.target.slice(0,2))
   .sort((a,b)=>Number(a.reverse)-Number(b.reverse)||a.target.localeCompare(b.target));
 const topicList=(modulesById[id]||[]).map(t=>m.modules[t]).filter(Boolean);
 if(!topicList.length&&!associated.length)return;
 const section=el('details','pt-analysis');
 const summary=one(section,'summary','',`知識の深掘りと関連過去問（${associated.length}問の接続候補）`);
 summary.setAttribute('aria-label','この問題の知識を深掘りし、関連する別年度の過去問を確認する');
 one(section,'p','caption','10年分の分析から作成した学習用接続候補です。同一知識の再出題か、周辺知識かは各接続理由を確認してください。');
 const summaryQ=m.questions[id];
 if(summaryQ.readingPoint)one(section,'p','pt-analysis-key','この問題の着眼点：'+summaryQ.readingPoint);
 if(summaryQ.unscored)one(section,'p','pt-analysis-alert','公式採点除外の問題です。正答率の分母には加えません。');
 if(summaryQ.figureIncomplete)one(section,'p','pt-analysis-alert','原問に関係する図が未収録です。画像の確認が必要な場合は公式問題冊子を参照してください。');
 for(const topic of topicList){
  const block=one(section,'div','pt-analysis-topic');
  one(block,'strong','',topic.title);
  if(topic.prompt)one(block,'p','pt-analysis-prompt','考えてみよう：'+topic.prompt);
  const more=one(block,'details','pt-analysis-more');
  one(more,'summary','','知識のつながりを確認する');
  const ul=one(more,'ul','');
  for(const t of (topic.knowledge||[]).slice(0,12))one(ul,'li','',t);
  if(topic.expansion)one(more,'p','caption','選択肢からの広がり：'+topic.expansion);
 }
 if(associated.length){
  one(section,'h4','','別年度の公式過去問で知識を確かめる');
  const seen=new Set();let count=0;
  for(const l of associated){
   if(seen.has(l.target))continue;seen.add(l.target);
   if(count++>=8)break;
   const box=one(section,'div','pt-analysis-link');
   one(box,'strong','',l.target+'｜'+(m.questions[l.target]?.topic||BYID[l.target].cat));
   if(l.choice!==null&&!l.reverse)one(box,'p','pt-analysis-choice','選択肢'+l.choice+'からの接続');
   one(box,'p','caption',l.reason+(l.reverse?'（元の問題からの逆向きリンク）':''));
   const btn=one(box,'button','secondary tiny','この公式過去問を解く');btn.type='button';btn.addEventListener('click',()=>beginOne(l.target));
  }
  if(seen.size>8)one(section,'p','caption','ほかにも接続候補があります。順次検証し、必要なものを既存アプリに追加します。');
 }
 parent.prepend(section);
 const head=$('relatedDetails')?.querySelector('summary');
 if(head)head.textContent='別年度の過去問・知識を深掘り（分析あり）';
}
const legacy=renderPastRelated;
renderPastRelated=function(id){legacy(id);decorate(id)};
})();
