(()=>{
 const btn=document.getElementById('offlinePreload'),out=document.getElementById('offlineStatus');
 if(!btn||!out)return;
 if(!('serviceWorker' in navigator)||!/^https?:$/.test(location.protocol)){
   out.textContent='ローカルファイルではオフライン保存を設定できません。HTTPSで公開後に操作してください。';return;
 }
 let busy=false;
 navigator.serviceWorker.addEventListener('message',({data})=>{
   if(data?.type==='PT_OFFLINE_PROGRESS'){out.textContent=`原図を保存中：${data.loaded}/${data.total}（取得失敗 ${data.failures}）`;}
   if(data?.type==='PT_OFFLINE_DONE'){busy=false;btn.disabled=false;out.textContent=data.failures?`保存終了。${data.failures}件の取得失敗があります。通信状態を確認し再実行してください。`:`全${data.total}画像の保存が完了。オフラインで利用できます。`;}
   if(data?.type==='PT_OFFLINE_ERROR'){busy=false;btn.disabled=false;out.textContent='保存できませんでした：'+data.message;}
 });
 navigator.serviceWorker.register('./sw.js').then(()=>navigator.serviceWorker.ready).then(reg=>{
   btn.disabled=false;out.textContent='画面と問題データのオフライン保存を準備しました。全原図の保存はこのボタンで実行できます。';
   btn.onclick=()=>{if(busy)return;busy=true;btn.disabled=true;out.textContent='原図の保存を開始します…';reg.active?.postMessage({type:'DOWNLOAD_ALL_FIGURES'});};
 }).catch(err=>{out.textContent='オフライン保存の準備に失敗：'+err.message;});
})();
