/* Run with Playwright installed: NODE_PATH=<dependencies> node scripts/test_tokyo_bus.cjs. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.webp':'image/webp','.woff2':'font/woff2','.png':'image/png','.jpg':'image/jpeg','.webmanifest':'application/manifest+json'};
const server=http.createServer((req,res)=>{
 const pathname=new URL(req.url,'http://local').pathname;
 const file=path.resolve(root,'.'+pathname+(pathname.endsWith('/')?'index.html':''));
 if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
 try{const data=fs.readFileSync(file);res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});res.end(data);}catch{res.writeHead(404);res.end();}
});
const screenshotDir=process.env.TOKYO_BUS_SCREENSHOTS;
const parked=page=>page.waitForFunction(()=>document.querySelector('#date-bus-vehicle').classList.contains('is-parked'));
async function pose(page){return page.evaluate(()=>{
 const bus=document.querySelector('#date-bus-vehicle'),stop=document.querySelector('[data-bus-day][aria-current=date]');
 const b=bus.getBoundingClientRect(),s=stop.getBoundingClientRect(),rail=document.querySelector('#date-bus-scroll').getBoundingClientRect();
 return {x:Number(bus.dataset.x),turn:parseFloat(bus.style.getPropertyValue('--bus-wheel-turn')),driving:bus.classList.contains('is-driving'),left:bus.classList.contains('go-left'),alignment:Math.abs(b.x+b.width/2-s.x-s.width/2),visible:b.x>=rail.x-1&&b.right<=rail.right+1,date:stop.dataset.busDay,overflow:document.documentElement.scrollWidth>innerWidth};
});}
async function verify(page){
 await page.waitForFunction(()=>document.querySelector('#date-bus-vehicle svg'));
 await page.evaluate(()=>document.fonts.ready);
 assert.equal(await page.locator('[data-bus-day]').count(),14);
 assert.equal(await page.locator('.date-bus-wheel-rotor').count(),2);
 assert(await page.locator('[data-bus-day=d1]').evaluate(e=>e.getBoundingClientRect().height>=44));
 await page.evaluate(()=>jumpToDay('d1'));await parked(page);
 await page.locator('[data-bus-day=d2]').click();await page.waitForTimeout(200);
 assert((await pose(page)).driving,'a real station click must continue animating after its first frame');
 assert(await page.locator('.date-bus-cabin').evaluate(e=>e.getAnimations().length>0));
 await parked(page);await page.locator('#day-picker').selectOption('d1');await parked(page);
 const start=await pose(page);assert(start.alignment<1.1);assert(start.visible);assert(!start.overflow);
 await page.evaluate(()=>jumpToDay('d14'));await page.waitForTimeout(600);
 const middle=await pose(page);assert(middle.driving);assert(middle.x>start.x);assert(middle.turn>start.turn);assert(middle.visible);
 const uninterrupted=await page.evaluate(()=>{
  const bus=document.getElementById('date-bus-vehicle'),x=bus.dataset.x;renderDateBus();
  return bus.classList.contains('is-driving')&&bus.dataset.x===x;
 });assert(uninterrupted,'unchanged renders must preserve the animation');
 const continuous=await page.evaluate(()=>{
  const bus=document.getElementById('date-bus-vehicle'),x=bus.dataset.x;jumpToDay('d2');
  return bus.dataset.x===x&&bus.classList.contains('go-left');
 });assert(continuous,'reverse selection must start from the current position');
 await parked(page);const reverse=await pose(page);assert.equal(reverse.date,'d2');assert(reverse.alignment<1.1);assert(reverse.visible);
 assert((await page.locator('#date-bus-status').textContent()).includes('12/14 停靠'));
 await page.evaluate(()=>jumpToDay('d14'));await page.waitForTimeout(250);
 await page.evaluate(()=>{localStorage.setItem('tokyo_motion_v1','reduce');applyMotion();});
 const reduced=await pose(page);assert(!reduced.driving);assert(reduced.alignment<1.1);assert(reduced.visible);
 await page.waitForTimeout(250);assert.equal((await pose(page)).x,reduced.x);
 assert.equal(await page.locator('#date-bus-vehicle').evaluate(e=>e.getAnimations({subtree:true}).length),0);
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.evaluate(()=>{localStorage.removeItem('tokyo_motion_v1');applyMotion();jumpToDay('d1');});
 assert(!(await pose(page)).driving,'OS reduced motion must stop the bus');
 await page.evaluate(()=>{localStorage.setItem('tokyo_motion_v1','full');applyMotion();jumpToDay('d10');});
 assert((await pose(page)).driving,'explicit full motion must override the OS preference');await parked(page);
 for(const size of ['compact','large','huge']){
  await page.locator(`[data-reading=${size}]`).click();await page.waitForTimeout(100);
  const p=await pose(page);assert(p.alignment<1.1);assert(p.visible);assert(!p.overflow);assert(!p.left,'layout changes must preserve the bus facing');
 }
 await page.locator('[data-reading=large]').click();
 await page.evaluate(()=>jumpToDay('d10'));await page.waitForTimeout(700);
 assert(await page.locator('#heading-d10').evaluate(e=>e.getBoundingClientRect().top>=document.querySelector('.day-sidebar').getBoundingClientRect().bottom-1),'date heading must clear sticky date controls');
 if(screenshotDir){
  fs.mkdirSync(screenshotDir,{recursive:true});
  await page.screenshot({path:path.join(screenshotDir,`bus-${page.viewportSize().width}.png`)});
  await page.locator('.day-sidebar').screenshot({path:path.join(screenshotDir,`bus-strip-${page.viewportSize().width}.png`)});
 }
 for(const mode of ['plan','today','journal']){
  await page.locator(`[data-mode=${mode}]`).click();assert.equal(await page.locator('body').getAttribute('data-mode'),mode);
  assert(!(await pose(page)).overflow);
 }
}
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const origin=`http://127.0.0.1:${server.address().port}`;
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
  for(const width of [390,1280]){
   const errors=[],context=await browser.newContext({viewport:{width,height:900}});
   await context.addInitScript(()=>{
    const NativeDate=Date;window.Date=class extends NativeDate{constructor(...args){super(...(args.length?args:['2026-10-10T12:00:00+09:00']));}static now(){return new NativeDate('2026-10-10T12:00:00+09:00').getTime();}};
   });
   await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
   const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
   await page.goto(origin+'/2026/tokyo/');await verify(page);
   if(width===390){
    await page.evaluate(()=>navigator.serviceWorker.ready);
    await page.locator('#offline-save').click();
    await page.waitForFunction(()=>document.getElementById('offline-status').textContent.includes('完整離線手冊已儲存'));
    await context.setOffline(true);await page.reload();
    await page.waitForFunction(()=>document.querySelector('#date-bus-vehicle svg'));
    await page.evaluate(()=>{localStorage.setItem('tokyo_motion_v1','full');applyMotion();jumpToDay('d14');});await parked(page);
    assert((await pose(page)).alignment<1.1);assert((await pose(page)).visible);
    await context.setOffline(false);
   }
   await page.goto(origin+'/2026/tokyo/?day=12-21&mode=family');
   await page.waitForSelector('.family-mode');
   assert.equal(await page.locator('[data-bus-day]').count(),0);
   assert.equal(await page.locator('#itinerary-list > article').getAttribute('data-date'),'2026-12-21');
   assert.deepEqual(errors,[]);await context.close();
   console.log(`PASS ${width}px: rolling/retarget/arrival, motion preferences, reading sizes, modes, family${width===390?', real full-cache and offline animation':''}`);
  }
  // Failed optional SVG inlining must retain the static image and date controls.
  const context=await browser.newContext({serviceWorkers:'block',viewport:{width:390,height:900}});
  await context.route('**/images/date-bus.svg',route=>route.request().resourceType()==='fetch'?route.fulfill({status:503,body:'Unavailable'}):route.continue());
  const page=await context.newPage();await page.goto(origin+'/2026/tokyo/');await page.waitForSelector('#date-bus-vehicle img');
  await page.evaluate(()=>jumpToDay('d3'));await parked(page);
  assert.equal((await pose(page)).date,'d3');assert(await page.locator('#date-bus-vehicle img').evaluate(e=>e.complete&&e.naturalWidth>0));
  await context.close();console.log('PASS optional SVG fetch failure: static image and date navigation remain usable');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
