/* v19. No new storage format: all progress derives from existing official answer history and knowledge notes. */
(()=>{
'use strict';
const $r=id=>document.getElementById(id);
const select=$r('routeSelect'),root=$r('routeSteps'),flag=$r('routeType');
if(!select||!root||typeof QUESTIONS==='undefined'||typeof CURATED_STUDY_LINKS==='undefined')return;
const year=id=>String(id||'').slice(0,2);
const latest=id=>{const h=state.history.filter(x=>x.id===id);return h[h.length-1]||null};
const records=()=>{
 const ids=[...new Set(state.history.map(h=>h.id))];
 return ids.filter(id=>BYID[id]).map(id=>({id,h:latest(id)}))
 .filter(x=>x.h&&(!x.h.correct||['uncertain','again','未評価'].includes(x.h.quality)))
 .sort((a,b)=>Number(!!a.h.correct)-Number(!!b.h.correct)||b.h.at.localeCompare(a.h.at));
};
const topicOf=id=>{
 for(const tid of (KNOWLEDGE_QMAP[id]||[])){
   const topic=KNOWLEDGE_BYID[tid];if(!topic)continue;
   const node=topic.nodes.find(n=>n.q.includes(id));if(node)return {topic,node};
 }
 return null;
};
const siblings=id=>{
 const map=new Map();
 for(const x of CURATED_STUDY_LINKS[id]||[]){
   if(!BYID[x.id]||year(id)===year(x.id))continue;
   map.set(x.id,{id:x.id,grade:x.grade==='same'?'same':'related',note:x.note||'',basis:'curated'});
 }
 const k=topicOf(id);
 if(k)for(const nodeid of k.node.q){
   if(!BYID[nodeid]||year(nodeid)===year(id)||map.has(nodeid))continue;
   map.set(nodeid,{id:nodeid,grade:'related',note:'同じ知識ノートにある関連問題（同一論点かは未確認）',basis:'node'});
 }
 return [...map.values()].sort((a,b)=>Number(a.grade!=='same')-Number(b.grade!=='same')||Number(!!latest(a.id))-Number(!!latest(b.id)));
};
const item=(title,txt,cls='')=>{
 const div=document.createElement('div');div.className='route-step '+cls;
 const h=document.createElement('strong');h.textContent=title;div.append(h);
 if(txt){const p=document.createElement('p');p.textContent=txt;div.append(p)}
 root.append(div);return div;
};
const button=(node,label,onclick,primary=false)=>{
 const b=document.createElement('button');b.type='button';b.className=primary?'primary':'secondary';b.textContent=label;b.addEventListener('click',onclick);node.append(b);return b;
};
let chosen=null;
function render(){
 const id=select.value;if(!BYID[id])return;
 chosen=id;root.replaceChildren();const q=BYID[id];const seed=latest(id);const topic=topicOf(id),links=siblings(id);
 flag.textContent=seed&&!seed.correct?'誤答から復習':seed?'自信・理解度を再確認':'演習前のお試し';
 const a=item('① 起点：'+id+'（'+q.cat+'）',q.stem);
 const hist=document.createElement('div');hist.className='route-note';hist.textContent=seed?(!seed.correct?'直近は不正解。正答と間違えた理由を説明できるか確認します。':(seed.quality==='solid'?'正答・理由を説明できたと記録済み。':'正答でも理解度に不安が残るため復習対象です。')):'まだ解答記録がありません。流れを試すための教材です。';a.append(hist);
 const act1=document.createElement('div');act1.className='route-action';a.append(act1);button(act1,'この公式問題を解く',()=>beginOne(id));
 if(topic){
   const {topic:t,node:n}=topic;
   const b=item('② 知識を理解：'+n.name,t.lead);
   const question=document.createElement('p');question.className='route-question';question.textContent='説明してみよう：'+n.ask;b.append(question);
   const reveal=document.createElement('button');reveal.type='button';reveal.className='secondary';reveal.textContent='知識のつながりを確認する';b.append(reveal);
   const chain=document.createElement('div');chain.className='route-chain';chain.textContent=n.chain.join('\n↓\n');chain.hidden=true;b.append(chain);
   reveal.onclick=()=>{chain.hidden=!chain.hidden;reveal.textContent=chain.hidden?'知識のつながりを確認する':'知識のつながりを隠す'};
   const stateKey=t.id+'|'+n.id;const st=state.knowledge?.states?.[stateKey]?.status;
   const stat=document.createElement('p');stat.className='route-muted';stat.textContent=st==='solid'?'この知識は「説明できる」と記録されています（自己評価）。':st==='review'?'この知識は「まだ説明できない」と記録されています。':'この知識の理解度はまだ未記録です。';b.append(stat);
   const act2=document.createElement('div');act2.className='route-action';b.append(act2);button(act2,'詳しく見る・理解度を記録',()=>{showView('review',false);showKnowledge(t.id,n.id);$r('knowledgeBook').scrollIntoView({block:'start',behavior:'smooth'})});
 }else{
   const b=item('② 知識を整理：個別ノート',q.tip||'関連する事前教材は未整備です。');
   const note=document.createElement('p');note.className='route-muted';note.textContent='この問題は45の事前テーマにまだ対応づいていません。問題ごとの知識メモとして記録できます。';b.append(note);
   const act2=document.createElement('div');act2.className='route-action';b.append(act2);button(act2,'個別の知識ノートを開く',()=>{showView('review',false);showKnowledge('question:'+id);$r('knowledgeBook').scrollIntoView({block:'start',behavior:'smooth'})});
 }
 const c=item('③ 別年度の公式過去問で確認',links.length?'問題の丸暗記ではなく、別年度で使える知識になったか確かめます。':'現在収録済みの別年度に対応する演習問題がありません。無理に類題を作らず、索引の候補を今後照合します。');
 if(links.length){const first=links[0];const label=document.createElement('p');label.className='route-note';label.textContent=(first.grade==='same'?'同じ論点の類題候補':'関連知識を補強する問題')+'：'+first.id+'｜'+first.note;c.append(label);
   const later=latest(first.id);const status=document.createElement('p');status.className='route-muted';
   if(later&&seed&&later.at>seed.at)status.textContent=later.correct?'この別年度問題は起点問題の後に正答しています（1回の確認。定着は未判定）。':'この別年度問題にも誤答があり、再復習が必要です。';
   else if(later)status.textContent='この別年度問題には以前の解答記録があります。';
   else status.textContent='この別年度問題はまだ解いていません。';c.append(status);
   const act3=document.createElement('div');act3.className='route-action';c.append(act3);
   button(act3,first.id+'を解く',()=>beginOne(first.id),true);
   if(links.length>1){const second=links[1];button(act3,'別候補：'+second.id,()=>beginOne(second.id))}
 }
}
function options(preferred){
 const all=records(),ids=all.map(x=>x.id);
 if(preferred&&BYID[preferred]&&!ids.includes(preferred))ids.unshift(preferred);
 if(!ids.length)ids.push('56-PM-021');
 const current=preferred&&ids.includes(preferred)?preferred:(ids.includes(chosen)?chosen:ids[0]);
 select.replaceChildren();const grp=document.createElement('optgroup');grp.label=all.length?'復習候補（最近の誤答・自信なし）':'サンプル（まだ復習履歴なし）';select.append(grp);
 for(const id of ids.slice(0,50)){const o=document.createElement('option');o.value=id;o.textContent=id+'｜'+(BYID[id].stem||'').slice(0,37);grp.append(o)}
 select.value=current;render();
}
select.addEventListener('change',render);
const btn=$r('routeFromAnswer');if(btn)btn.addEventListener('click',()=>{if(!current)return;showView('review',false);options(current.id);$r('learningRoute').scrollIntoView({block:'start',behavior:'smooth'})});
// Rerender from the latest official study history when entering review or importing a JSON backup.
document.querySelectorAll('.app-tabs .tab[data-view="review"]').forEach(b=>b.addEventListener('click',()=>options()));
const importBtn=$r('importLog');if(importBtn)importBtn.addEventListener('click',()=>{setTimeout(()=>options(),500)});
const backupInput=$r('logFile');if(backupInput)backupInput.addEventListener('change',()=>setTimeout(()=>options(),500));
// A passed question has a new event immediately; the button picks that question, regardless of correctness.
options();
})();
