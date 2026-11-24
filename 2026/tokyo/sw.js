/* Cache only this trip's public assets. Private notes never leave localStorage. */
const VERSION='tokyo-v2-20261124-food-locations';
const CORE=['./','index.html','boot.js','app.js','extra.js','experience.css','picturebook.css','illustrations.js','picturebook.js','date-bus.js','date-bus.css','images/date-bus.svg','fonts/Huninn-Regular.woff2','trip.json','manifest.webmanifest','images/icon-192.png','images/icon-512.png','images/share.jpg','images/routes/1220-proportional.svg','images/routes/1220-proportional-sources.json','images/routes/1221-proportional.svg','images/routes/1221-proportional-sources.json','images/routes/1222-proportional.svg','images/routes/1222-proportional-sources.json','images/routes/1225-proportional.svg','images/routes/1225-proportional-sources.json','images/routes/1223-proportional.svg','images/routes/1223-proportional-sources.json','images/routes/1224-proportional.svg','images/routes/1224-proportional-sources.json'];
CORE.push('budget.js','budget.css','go2.html','no-chew-food.html',...Array.from({length:14},(_,i)=>`images/covers/12${i+13}-picturebook.svg`));
const freshRequest=url=>new Request(new URL(url,location.href),{cache:'reload'});
const FULL=[...CORE,'archive.json',...Array.from({length:14},(_,i)=>`images/covers/12${i+13}.webp`),'images/buy/buy-images.json',...Array.from({length:16},(_,i)=>`images/buy/${String(i+1).padStart(2,'0')}.webp`)];
self.addEventListener('install',e=>{e.waitUntil(caches.open(VERSION).then(c=>c.addAll(CORE.map(freshRequest))).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('tokyo-')&&k!==VERSION).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{
 const url=new URL(e.request.url);if(e.request.method!=='GET'||url.origin!==location.origin||!url.pathname.startsWith(new URL('./',location.href).pathname))return;
 const scope = new URL('./', location.href);
 const isNavigation = e.request.mode === 'navigate';
 const isHandbook = [scope.pathname, scope.pathname + 'index.html'].includes(url.pathname);
 const key = isNavigation ? (isHandbook ? scope.href : url.origin + url.pathname) : e.request;
 e.respondWith((async () => {
   const cache = await caches.open(VERSION);
   const controller = new AbortController();
   const timer = setTimeout(() => controller.abort(), 4000);
   try {
     const response = await fetch(e.request, {signal: controller.signal, cache: 'no-cache'});
     if (response.ok && response.type !== 'opaque') await cache.put(key, response.clone());
     return response;
   } catch {
     const saved = await cache.match(key);
     if (saved) return saved;
     return new Response('離線時無法讀取這個項目，請連網後再試。', {status: 503, headers: {'Content-Type': 'text/plain; charset=utf-8'}});
   } finally {
     clearTimeout(timer);
   }
 })());
});
self.addEventListener('message',e=>{if(e.data?.type!=='CACHE_ALL')return;e.waitUntil((async()=>{const cache=await caches.open(VERSION);let done=0,failed=0;for(const url of FULL){try{await cache.add(freshRequest(url));}catch{failed++;}done++;e.source?.postMessage({type:'CACHE_PROGRESS',done,total:FULL.length});}e.source?.postMessage({type:'CACHE_DONE',failed});})());});
