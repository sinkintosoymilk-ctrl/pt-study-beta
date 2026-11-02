const CACHE='pt-kokushi-v171beta-20261031';
const CORE=['./','./index.html','./css/app.css','./data/questions.js','./data/rationales.js','./data/rationale-expansion-v128.js','./data/rationale-expansion-pilot-w01.js','./data/rationale-expansion-undou-r1.js','./data/rationale-expansion-undou-r2.js','./data/rationale-expansion-kaibou-r1.js','./data/rationale-expansion-kaibou-r2.js','./data/rationale-expansion-kaibou-r3.js','./data/rationale-expansion-byouri-r1.js','./data/rationale-expansion-byouri-r2.js','./data/rationale-expansion-byouri-r3.js','./data/rationale-expansion-byouri-r4.js','./data/rationale-expansion-byouri-r5.js',
  './data/rationale-expansion-hyouka-r1.js',
  './data/rationale-expansion-hyouka-r2.js',
  './data/rationale-expansion-hyouka-r3.js',
  './data/rationale-expansion-hyouka-r4.js',
  './data/rationale-expansion-seiri-r1.js',
  './data/rationale-expansion-seiri-r2.js',
  './data/rationale-expansion-seiri-r3.js',
  './data/rationale-expansion-shinri-r1.js',
  './data/rationale-expansion-shinri-r2.js',
  './data/rationale-expansion-naibu-r1.js',
  './data/rationale-expansion-naibu-r2.js',
  './data/rationale-expansion-shoni-r1.js',
  './data/rationale-expansion-shoni-r2.js',
  './data/rationale-expansion-chiiki-r1.js',
  './data/rationale-expansion-chiiki-r2.js',
  './data/rationale-expansion-shinkei-r1.js',
  './data/rationale-expansion-shinkei-r2.js',
  './data/rationale-expansion-shikkei-r1.js',
  './data/rationale-expansion-shikkei-r2.js',
  './data/rationale-expansion-gisoku-r1.js',
  './data/rationale-expansion-gisoku-r2.js',
  './data/rationale-expansion-chiryo-r1.js',
  './data/rationale-expansion-chiryo-r2.js',
  './data/rationale-expansion-tail-r1.js',
  './data/rationale-expansion-tail-r2.js','./data/topics-all.js','./js/core.js','./js/year-browser.js','./js/topics-all.js','./js/figure-zoom.js','./js/official-sources.js','./js/offline-control.js','./data/figure-manifest.json'];
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
