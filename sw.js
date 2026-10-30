const CACHE='pt-kokushi-v130beta3-20261031';
const CORE=['./','./index.html','./css/app.css','./data/questions.js','./data/related.js','./data/rationales.js','./data/rationale-expansion-v128.js','./data/rationale-expansion-pilot-w01.js','./data/knowledge-v121.js','./js/core.js','./js/knowledge-route.js','./js/knowledge-v121-integration.js','./js/year-browser.js','./js/figure-zoom.js','./js/official-sources.js','./js/offline-control.js','./data/figure-manifest.json'];
self.addEventListener('install', event => event.waitUntil((async()=>{const cache=await caches.open(CACHE);await cache.addAll(CORE);await self.skipWaiting()})()));
self.addEventListener('activate', event => event.waitUntil((async()=>{for(const name of await caches.keys()) if(name.startsWith('pt-kokushi-')&&name!==CACHE) await caches.delete(name);await self.clients.claim()})()));
self.addEventListener('fetch', event => {if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;
  const url=new URL(event.request.url);
  const networkFirst=event.request.mode==='navigate'||/\.(html|css|js|json)$/.test(url.pathname);
  event.respondWith((async()=>{const c=await caches.open(CACHE);
    if(networkFirst){try{const r=await fetch(event.request);if(r.ok)event.waitUntil(c.put(event.request,r.clone()).catch(()=>{}));return r}catch(e){const found=await c.match(event.request);if(found)return found;if(event.request.mode==='navigate'){const fallback=await c.match('./index.html');if(fallback)return fallback;}throw e;}}
    const found=await c.match(event.request);if(found)return found;
    const r=await fetch(event.request);if(r.ok)event.waitUntil(c.put(event.request,r.clone()).catch(()=>{}));return r;})());
});
self.addEventListener('message',event=>{if(event.data?.type!=='DOWNLOAD_ALL_FIGURES')return;
  event.waitUntil((async()=>{const source=event.source;const progress=(loaded,total,failures)=>source?.postMessage({type:'PT_OFFLINE_PROGRESS',loaded,total,failures});
  try{const cache=await caches.open(CACHE);const all=await (await fetch('./data/figure-manifest.json')).json();let cursor=0,completed=0,failures=0;
    // Concurrency kept low for mobile memory/network stability.
    const workers=Array.from({length:4},async()=>{while(true){let idx=cursor++;if(idx>=all.length)return;const url=new URL(all[idx],self.registration.scope).href;try{if(!(await cache.match(url))){const resp=await fetch(url);if(!resp.ok)throw Error('HTTP '+resp.status);await cache.put(url,resp.clone())}}catch(err){failures++;}completed++;progress(completed,all.length,failures);}});
    await Promise.all(workers);source?.postMessage({type:'PT_OFFLINE_DONE',total:all.length,failures});
  }catch(error){source?.postMessage({type:'PT_OFFLINE_ERROR',message:String(error)})}})());
});
