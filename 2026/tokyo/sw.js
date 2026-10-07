/* Cache only this trip's public assets. Private notes never leave localStorage. */
const VERSION='tokyo-v2-20261008-1';
const CORE=['./','index.html','boot.js','app.js','extra.js','experience.css','trip.json','manifest.webmanifest','images/icon-192.png','images/icon-512.png','images/share.jpg'];
const freshRequest=url=>new Request(new URL(url,location.href),{cache:'reload'});
const FULL=[...CORE,'archive.json',...Array.from({length:14},(_,i)=>`images/covers/12${i+13}.webp`),'images/buy/buy-images.json',...Array.from({length:16},(_,i)=>`images/buy/${String(i+1).padStart(2,'0')}.webp`)];
self.addEventListener('install',e=>{e.waitUntil(caches.open(VERSION).then(c=>c.addAll(CORE.map(freshRequest))).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('tokyo-')&&k!==VERSION).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{
 const url=new URL(e.request.url);if(e.request.method!=='GET'||url.origin!==location.origin||!url.pathname.startsWith(new URL('./',location.href).pathname))return;
 e.respondWith((async()=>{const cache=await caches.open(VERSION),key=e.request.mode==='navigate'?new URL('./',location.href).href:e.request;try{const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),4000);let r;try{r=await fetch(e.request,{signal:controller.signal,cache:'no-cache'});}finally{clearTimeout(timer);}if(r.ok&&r.type!=='opaque')await cache.put(key,r.clone());return r;}catch{const r=await cache.match(key)||await cache.match(e.request,{ignoreSearch:true});if(r)return r;if(e.request.mode==='navigate')return cache.match('./');return new Response('Offline asset unavailable',{status:503});}})());
});
self.addEventListener('message',e=>{if(e.data?.type!=='CACHE_ALL')return;e.waitUntil((async()=>{const cache=await caches.open(VERSION);let done=0,failed=0;for(const url of FULL){try{await cache.add(freshRequest(url));}catch{failed++;}done++;e.source?.postMessage({type:'CACHE_PROGRESS',done,total:FULL.length});}e.source?.postMessage({type:'CACHE_DONE',failed});})());});
