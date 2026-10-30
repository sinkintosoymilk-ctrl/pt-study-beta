(function(){
  // Put the knowledge-to-question route in the review area instead of permanently below the quiz.
  if(typeof VIEWS!=='undefined' && VIEWS.review && !VIEWS.review.includes('learningRoute')) VIEWS.review.push('learningRoute');
  const details=document.getElementById('officialPdfDetails');
  const viewers=document.getElementById('officialPdfViewers');
  if(details){details.addEventListener('toggle',()=>{if(!details.open)return;for(const frame of viewers.querySelectorAll('iframe[data-src]')){if(!frame.src)frame.src=frame.dataset.src;}});}
  const priorShow=show;
  show=function(...args){
    const result=priorShow(...args);
    const q=current;
    const sources=q?.figureSources||[];
    details.classList.toggle('hidden',sources.length===0);
    details.open=false;
    viewers.replaceChildren();
    for(const src of sources){
      const item=document.createElement('div');item.className='official-pdf-item';
      const title=document.createElement('strong');title.textContent=src.label+(Number.isInteger(src.page)?'｜PDF '+src.page+'ページ':'｜PDF全体');
      const link=document.createElement('a');link.href=src.url+(Number.isInteger(src.page)?'#page='+src.page:'');link.target='_blank';link.rel='noopener noreferrer';link.textContent=Number.isInteger(src.page)?'公式PDFの該当ページを表示':'公式PDF全体を別画面で開く（該当問を検索）';
      if(Number.isInteger(src.page)){const frame=document.createElement('iframe');frame.loading='lazy';frame.title=src.label;frame.dataset.src=src.url+'#page='+src.page+'&toolbar=0&navpanes=0&view=FitH';item.append(title,frame,link);}else{const note=document.createElement('p');note.className='caption';note.textContent='該当問番号をPDF内で検索してください。大容量PDFのため、アプリ内への埋め込み表示は行わず別画面で開きます。';item.append(title,note,link);}viewers.append(item);
    }
    if(q?.provisional && sources.length){const note=document.getElementById('figureMissingNote');note.classList.remove('hidden');note.textContent='※原図はまだアプリ内に埋め込まれていません。下の「公式問題冊子・別冊の図を表示」から原本を確認できます。画像の内蔵が完了するまでは採点・成績に加算しません。';}
    document.body.classList.toggle('in-session',!!session && !document.getElementById('play').classList.contains('hidden'));
    return result;
  };
  const priorEnd=endSession;
  endSession=function(...args){document.body.classList.remove('in-session');return priorEnd(...args);};
  if(typeof showView==='function')showView('learn',false);
})();
