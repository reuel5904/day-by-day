const CACHE_PREFIX='dbd-pages-'+new URL(self.registration.scope).pathname.replace(/[^a-z0-9]/gi,'_')+'-';
const CACHE=CACHE_PREFIX+'BUILD_VERSION';
const APP_ROOT=new URL(self.registration.scope).pathname;
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil((async()=>{for(const name of await caches.keys())if(name.startsWith(CACHE_PREFIX)&&name!==CACHE)await caches.delete(name);await self.clients.claim();})()));
self.addEventListener('fetch',event=>{
  const req=event.request;const url=new URL(req.url);
  if(req.method!=='GET'||url.origin!==self.location.origin||!url.pathname.startsWith(APP_ROOT))return;
  if(req.mode==='navigate'){
    event.respondWith((async()=>{const cache=await caches.open(CACHE);try{const response=await fetch(req);if(response.ok&&response.headers.get('content-type')?.includes('text/html')&&(url.pathname===APP_ROOT||url.pathname===APP_ROOT+'index.html'))await cache.put(APP_ROOT,response.clone());return response;}catch{return await cache.match(APP_ROOT)||new Response('Open Day by Day once while online to prepare your offline workout.',{status:503,headers:{'Content-Type':'text/plain'}});}})());return;
  }
  if(/\.(js|css|woff2?|svg|png|ico)$/.test(url.pathname))event.respondWith((async()=>{const cache=await caches.open(CACHE);const hit=await cache.match(req);if(hit)return hit;const response=await fetch(req);if(response.ok)await cache.put(req,response.clone());return response;})());
});
self.addEventListener('message',event=>{if(event.data==='CACHE_SHELL')event.waitUntil((async()=>{const r=await fetch(APP_ROOT,{cache:'no-store'});if(r.ok&&r.headers.get('content-type')?.includes('text/html')){const cache=await caches.open(CACHE);await cache.put(APP_ROOT,r.clone());const html=await r.text();const urls=[...html.matchAll(/(?:src|href)="([^"?#]+\.(?:js|css))"/g)].map(m=>new URL(m[1],self.registration.scope)).filter(url=>url.origin===self.location.origin&&url.pathname.startsWith(APP_ROOT));await Promise.allSettled(urls.map(async url=>{const r=await fetch(url);if(r.ok)await cache.put(url,r);}));}})());});
