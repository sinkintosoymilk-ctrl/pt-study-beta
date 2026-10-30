/* v31: One unified year-by-year examination view for the 52nd–61st sessions. */
(function(){
'use strict';
const $y=id=>document.getElementById(id);
const yearFormat=(y,h)=>`第${y}回${h==='AM'?'午前':'午後'}`;
const yearKey=(y,h)=>`${y}-${h}`;
const parseYear=id=>{const a=/^(5[2-9]|6[01])-(AM|PM)-(\d{3})$/.exec(id);return a?{year:Number(a[1]),half:a[2],num:Number(a[3])}:null};
const qByYear=(y,h)=>QUESTIONS.filter(q=>!q.provisional).filter(q=>{const p=parseYear(q.id);return p&&p.year===y&&p.half===h}).sort((a,b)=>Number(a.id.slice(-3))-Number(b.id.slice(-3)));
let yearContext=null;
function progress(y,h){return state.yearProgress?.[yearKey(y,h)]||null}
function segmentStats(y,h){const ids=qByYear(y,h);const seen=ids.filter(q=>recentOf(q.id));const right=seen.filter(q=>recentOf(q.id).correct).length;return {ids,seen,correct:right}}
function currentYear(){return Number($y('yearPick').value||52)}
function currentHalf(){return $y('yearHalf').value||'AM'}
function renderYears(){
 const y=currentYear(),h=currentHalf(),stats=segmentStats(y,h);
 const both=qByYear(y,'AM').length+qByYear(y,'PM').length;const excluded=Array.from({length:100},(_,i)=>`${y}-${h}-${String(i+1).padStart(3,'0')}`).filter(id=>PAST_BYID[id]?.scoring==='採点除外').length;
 const cards=$y('yearCards');cards.replaceChildren();
 for(let n=52;n<=61;n++){
   const count=qByYear(n,'AM').length+qByYear(n,'PM').length;
   const btn=document.createElement('button');btn.type='button';btn.className='year-card'+(n===y?' active':'');btn.setAttribute('aria-pressed',n===y?'true':'false');
   const title=document.createElement('strong');title.textContent=`第${n}回`;
   const sm=document.createElement('small');sm.textContent=`${count}/200問`;
   btn.append(title,sm);btn.addEventListener('click',()=>{$y('yearPick').value=String(n);renderYears()});cards.append(btn);
 }
 $y('yearStatus').textContent=`${yearFormat(y,h)}：演習可能 ${stats.ids.length}/100問｜未収録 ${100-stats.ids.length-excluded}問${excluded?`｜公式採点除外 ${excluded}問`:``}｜解答済 ${stats.seen.length}問｜解答済み問題の最新正答 ${stats.seen.length?Math.round(100*stats.correct/stats.seen.length)+'%':'—'} （第${y}回 全体 ${both}/200問）`;
 $y('yearCoverageBar').style.width=stats.ids.length+'%';
 $y('yearStart').disabled=stats.ids.length===0;$y('yearResume').disabled=stats.ids.length===0;
 const p=progress(y,h),list=$y('yearQuestionList');list.replaceChildren();
 $y('yearResumeNote').textContent=p?.done? '前回解いた位置がこの午前・午後の末尾です。「再開」は未回答問題があればそこから、なければ先頭から開始します。':p?.nextId?`前回の続き：${p.nextId}から。後日追加された問題は一覧から選んで解けます。`:'履歴がなくても1問目から開始できます。索引のみの設問は演習対象から除外されます。';
 for(let num=1;num<=100;num++){
   const id=`${y}-${h}-${String(num).padStart(3,'0')}`;
   const q=BYID[id];const ready=!!q&&!q.provisional;const el=document.createElement(q?'button':'div');
   if(q)el.type='button';el.className='year-item '+(ready?'is-ready':q?'is-missing':'is-missing');
   const no=document.createElement('strong');no.textContent=`問${num}`;el.append(no);
   const status=document.createElement('span');status.className='year-state';status.textContent=ready?'演習可能':q?'本文・正答あり／図待ち':(PAST_BYID[id]?.scoring==='採点除外'?'採点除外':'未収録');el.append(status);
   if(q){const last=recentOf(id);if(last){const m=document.createElement('span');m.className='year-last';m.textContent=last.correct?'✓ 最近○':'✓ 最近×';el.append(m)}
     el.title=`${id} ${q.stem.slice(0,90)}　${q.provisional?'図待ち・参考閲覧のみ':'この問題から解く'}`;el.setAttribute('aria-label',`${id} ${q.provisional?'図待ち・参考閲覧のみ':'演習可能'} ${last?'解答履歴あり':''}`);el.onclick=()=>q.provisional?beginOne(id):startYear(y,h,id);
   }else{el.title=PAST_BYID[id]?.topic?`索引のみ：${String(PAST_BYID[id].topic).slice(0,90)}`:'本文・選択肢は未収録'}
   list.append(el);
 }
 $y('yearReturnPanel').classList.toggle('hidden',!yearContext);
 if(yearContext)$y('yearReturnTitle').textContent=`${yearFormat(yearContext.year,yearContext.half)}の演習に戻る`;
}
function startYear(y,h,fromId=null){
 const ids=qByYear(y,h).map(q=>q.id);
 if(!ids.length){alert('この午前・午後は、まだ演習可能な原問がありません。');return}
 if(session&&!submitted&&!$y('play').classList.contains('hidden')&& !confirm('現在解いている未回答問題を中断して年度別演習を開始しますか？'))return;
 const ix=fromId?Math.max(0,ids.indexOf(fromId)):0;
 yearContext={year:y,half:h};$y('yearReturnPanel').classList.remove('hidden');session={ids,index:ix,events:[],mode:'year',cat:'all',year:y,half:h};
 $y('sessionEnd').classList.add('hidden');$y('play').classList.remove('hidden');
 showView('learn',false);show();renderYearNav();
}
function resumeYear(y,h){const ids=qByYear(y,h).map(q=>q.id);if(!ids.length)return;
 const p=progress(y,h);let id=p?.nextId&&ids.includes(p.nextId)?p.nextId:null;
 if(!id){id=ids.find(x=>!recentOf(x))||ids[0]}
 startYear(y,h,id)
}
function renderYearNav(){
 const isYear=session?.mode==='year';$y('yearPlayNav').classList.toggle('hidden',!isYear&&!yearContext);
 if(isYear)$y('yearPlayNote').textContent=`${yearFormat(session.year,session.half)}・問題番号順（収録済み${session.ids.length}問）`;
 else if(yearContext)$y('yearPlayNote').textContent=`${yearFormat(yearContext.year,yearContext.half)}の演習から寄り道中`;
}
function goYearList(){if(session?.mode==='year'&&!submitted){if(!confirm('未解答の問題を離れますか？ 解答済みの履歴は保持されます。'))return}
 if(yearContext){$y('yearPick').value=String(yearContext.year);$y('yearHalf').value=yearContext.half}
 showView('year');renderYears();
}
function returnToYear(){if(!yearContext)return;
 const {year,half}=yearContext;
 if(session?.mode==='year'&&current){showView('learn',false);$y('play').scrollIntoView({behavior:'smooth',block:'start'});return}
 resumeYear(year,half)
}
const oldShow=show;
show=function(){oldShow();if(session?.mode==='year'){
 $y('sessionType').textContent=`${yearFormat(session.year,session.half)}・年度別`;
 const p=parseYear(current?.id||'');$y('position').textContent=p?`問${p.num}｜収録済みの ${session.index+1} / ${session.ids.length} 問目`:'';
 }renderYearNav()};
const oldAnswer=answer;
answer=function(){const wasYear=session?.mode==='year',meta=wasYear?{year:session.year,half:session.half,id:current?.id,nextId:session.ids[session.index+1]||null}:null;
 oldAnswer();
 if(meta&&submitted){
 state.yearProgress??={};state.yearProgress[yearKey(meta.year,meta.half)]={lastId:meta.id,nextId:meta.nextId,done:!meta.nextId,updatedAt:new Date().toISOString()};save();
 }
};
const oldEnd=endSession;
endSession=function(){const meta=session?.mode==='year'?{year:session.year,half:session.half}:null;
 oldEnd();if(meta){$y('sessionSummary').textContent+=` ${yearFormat(meta.year,meta.half)}の収録済み問題による演習結果です。未収録問題は採点対象外です。`;
 $y('againButton').textContent='この年度の問題をもう一度解く';$y('againButton').onclick=()=>startYear(meta.year,meta.half);
 const b=document.createElement('button');b.className='secondary';b.textContent='この年度の一覧へ';b.onclick=()=>goYearList();$y('sessionSummary').append(document.createElement('br'),b);
 }else{$y('againButton').textContent='次の10問を学習';$y('againButton').onclick=()=>begin('daily','all')}
};
const oldBegin=begin;
begin=function(...args){yearContext=null;oldBegin(...args);renderYearNav();$y('yearReturnPanel').classList.add('hidden')};
const oldBeginOne=beginOne;
beginOne=function(...args){if(session?.mode==='year'&&!yearContext)yearContext={year:session.year,half:session.half};oldBeginOne(...args);renderYearNav()};
for(let y=52;y<=61;y++){const e=document.createElement('option');e.value=String(y);e.textContent=`第${y}回`;$y('yearPick').append(e)}
$y('yearPick').value='52';
const latestYear=Object.entries(state.yearProgress||{}).filter(([k,v])=>/^(5[2-9]|6[01])-(AM|PM)$/.test(k)&&v?.updatedAt).sort((a,b)=>a[1].updatedAt.localeCompare(b[1].updatedAt)).at(-1);
if(latestYear){const [y,h]=latestYear[0].split('-');$y('yearPick').value=y;$y('yearHalf').value=h}
$y('yearPick').onchange=renderYears;$y('yearHalf').onchange=renderYears;
$y('yearStart').onclick=()=>startYear(currentYear(),currentHalf());
$y('yearResume').onclick=()=>resumeYear(currentYear(),currentHalf());
$y('yearPlayBack').onclick=goYearList;
$y('yearReturnButton').onclick=returnToYear;
document.querySelector('.app-tabs .tab[data-view="year"]').addEventListener('click',renderYears);
renderYears();
})();
