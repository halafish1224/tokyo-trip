const {JSDOM,VirtualConsole,ResourceLoader}=require('jsdom');const fs=require('fs'),assert=require('node:assert/strict');
const root=require('path').join(__dirname,'../2026/tokyo');
async function test(query='',date='2026-10-03T00:00:00+09:00'){
 const errors=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));vc.on('error',e=>errors.push(String(e)));
 const dom=new JSDOM(fs.readFileSync(root+'/index.html','utf8'),{url:'http://localhost:8765/2026/tokyo/'+query,runScripts:'dangerously',resources:new class extends ResourceLoader{fetch(url){return Promise.resolve(fs.readFileSync(root+'/'+new URL(url).pathname.split('/').pop()));}}(),pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){
  const NativeDate=Date;w.Date=class extends NativeDate{constructor(...args){super(...(args.length?args:[date]));}static now(){return new NativeDate(date).getTime();}};
  w.fetch=async(url,opts)=>{const u=new URL(url,w.location.href);if(u.hostname==='localhost')return new Response(fs.readFileSync(root+'/'+u.pathname.replace('/2026/tokyo/','')),{status:200});return new Response('{}',{status:503});};
  w.matchMedia=()=>({matches:false,addEventListener(){}});w.ResizeObserver=class{observe(){}};w.HTMLElement.prototype.scrollIntoView=function(){};w.scrollTo=function(){};w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};w.URL.createObjectURL=()=>'';w.URL.revokeObjectURL=()=>{};w.CompressionStream=CompressionStream;w.DecompressionStream=DecompressionStream;w.TextEncoder=TextEncoder;w.Blob=Blob;w.Response=Response;
 }});
 await new Promise(r=>setTimeout(r,1200));const w=dom.window,d=w.document;
 assert.equal(errors.length,0,errors.join('\n'));assert(w.TokyoTrip,'app not initialized');
 assert(d.querySelector('.book-cover-art svg'));assert.equal(d.querySelectorAll('.flight-card').length,3);
 assert.equal(d.querySelector('#source-info').closest('.section').id,'sec-trans');
 if(!query){assert.equal(d.querySelectorAll('[data-bus-day]').length,14);assert.equal(d.querySelector('[data-bus-day]').dataset.busDay,'d1');assert.equal(d.querySelectorAll('[data-bus-day]')[13].dataset.busDay,'d14');assert.equal(d.querySelector('[data-bus-day][aria-current=date]').dataset.busDay,w.eval('activeDay'));}else assert.equal(d.querySelectorAll('[data-bus-day]').length,0);
 if(!query&&date.startsWith('2026-10')){
  const vehicle=d.querySelector('#date-bus-vehicle');assert.equal(vehicle.querySelectorAll('.date-bus-wheel-rotor').length,2);
  for(const stop of d.querySelectorAll('[data-bus-day]')){Object.defineProperty(stop,'offsetLeft',{get:()=>12+72*(Number(stop.dataset.busDay.slice(1))-1)});Object.defineProperty(stop,'offsetWidth',{get:()=>72});}
  w.renderDateBus(false);const start=vehicle.dataset.x;
  d.querySelector('[data-bus-day=d14]').click();assert.equal(d.querySelector('#day-picker').value,'d14');assert.equal(vehicle.dataset.x,start);assert(vehicle.classList.contains('is-driving'));assert.equal(d.querySelector('.accordion-item').dataset.date,'2026-12-26');
  await new Promise(r=>setTimeout(r,600));const midway=Number(vehicle.dataset.x);assert(midway>Number(start)&&midway<942,JSON.stringify({start,midway,driving:vehicle.classList.contains('is-driving')}));assert(Number.parseFloat(vehicle.style.getPropertyValue('--bus-wheel-turn'))>0);
  w.renderDateBus();assert(vehicle.classList.contains('is-driving'));assert.equal(Number(vehicle.dataset.x),midway);
  d.querySelector('[data-bus-day=d1]').click();assert.equal(Number(vehicle.dataset.x),midway);assert(vehicle.classList.contains('go-left'));assert.equal(d.querySelector('[aria-current=date]').dataset.busDay,'d1');
  await new Promise(r=>setTimeout(r,1700));assert.equal(vehicle.style.transform,'translateX(6px)');assert(vehicle.classList.contains('is-parked'));assert(d.getElementById('date-bus-status').textContent.includes('12/13 停靠'));
  d.querySelector('#motion-toggle').click();d.querySelector('#day-picker').value='d7';d.querySelector('#day-picker').dispatchEvent(new w.Event('change',{bubbles:true}));assert.equal(vehicle.style.transition,'none');assert(!vehicle.classList.contains('is-driving'));assert.equal(d.querySelector('[aria-current=date]').dataset.busDay,'d7');
  d.querySelector('#motion-toggle').click();w.eval('viewMode="plan";renderApp();');
  const card=d.getElementById('d8'),original=card;
  card.getBoundingClientRect=()=>({top:0,bottom:1000,height:1000});
  w.dispatchEvent(new w.Event('scroll'));await new Promise(r=>setTimeout(r,30));
  assert.equal(w.eval('activeDay'),'d8');assert.equal(d.querySelector('[aria-current=date]').dataset.busDay,'d8');assert.equal(d.getElementById('d8'),original);assert(d.getElementById('date-bus-theme').textContent.startsWith('12/20'));
  // Explicit full motion must override an OS reduce preference, without disabling control.
  w.eval("Object.defineProperty(motionQuery || {}, 'matches', {value:true,configurable:true})");
  w.localStorage.setItem('tokyo_motion_v1','full');w.applyMotion();assert.equal(d.documentElement.dataset.motion,'full');assert.equal(d.getElementById('motion-toggle').disabled,false);

 }
 d.querySelector('#motion-toggle').click();assert.equal(d.documentElement.dataset.motion,'reduce');
 const mode=d.body.dataset.mode;
 if(query){assert.equal(mode,'today');assert.equal(d.querySelectorAll('.accordion-item').length,1);assert(d.querySelector('.accordion-item').dataset.date.endsWith('12-21'));assert(d.body.classList.contains('family-mode'));}
 else if(date.startsWith('2026-10')){assert.equal(mode,'plan');assert.equal(d.querySelectorAll('.overview-day').length,14);d.querySelector('[data-mode=today]').click();assert.equal(d.querySelectorAll('.accordion-item').length,1);d.querySelector('[data-section=theme]').click();assert(d.querySelector('#sec-theme').classList.contains('active'));assert(d.querySelector('.experience').hidden);assert(d.querySelector('#decision-board').hidden);d.querySelector('[data-notes-layer=all]').click();assert(d.querySelector('#map-notes-list>details'));d.querySelector('[data-section=trans]').click();assert.equal(d.querySelectorAll('.phrase').length,6);}
 else if(date.startsWith('2026-12-21')){assert.equal(mode,'today');assert.equal(d.querySelectorAll('.accordion-item').length,1);assert.equal(d.querySelector('.accordion-item').dataset.date,'2026-12-21');}
 else {assert.equal(mode,'journal');assert.equal(d.querySelectorAll('.journal-day').length,14);}
 if(!query){w.mergeBackup({format:'tokyo-trip-backup',version:4,state:{custom:[],overrides:{},checks:{'sheet-2026-12-13-r10':'2026-12-13'}},expenses:[{id:999,item:'test',cost:120,date:'12/13'}],buyChecks:{'test-product':true},journal:{'sheet-2026-12-13-r10':{status:'went',text:'海風很舒服'}},decisions:{day1:true},privateNotes:'PRIVATE_TEST',picturebook:{mustGo:{'sheet-2026-12-25-r6':false,'not-an-event':true},packing:{passport:true,unknown:true}}});assert.equal(w.eval('expenses.find(e=>e.id===999).cost'),120);assert.equal(w.eval('privateNotes'),'PRIVATE_TEST');assert.equal(w.getBuyCheckedMap()['test-product'],true);assert.equal(w.eval('journal["sheet-2026-12-13-r10"].status'),'went');const state=w.getPicturebookState();assert.equal(state.packing.passport,true);assert.equal(state.mustGo['sheet-2026-12-25-r6'],false);assert.equal(state.mustGo['not-an-event'],undefined);assert.equal(state.packing.unknown,undefined);w.mergeBackup({format:'tokyo-trip-backup',version:3,state:{custom:[],overrides:{},checks:{}}});assert.equal(w.getPicturebookState().packing.passport,true);}else{assert.equal(d.querySelectorAll('[data-must-go]').length,0);assert.equal(d.querySelectorAll('[data-packing]').length,0);}assert.equal(errors.length,0,errors.join('\n'));console.log('PASS',query||date,mode);dom.window.close();
}
(async()=>{await test();await test('?day=12-21&mode=family');await test('','2026-12-21T10:00:00+09:00');await test('','2026-12-27T10:00:00+09:00');})().catch(e=>{console.error(e);process.exit(1)});
