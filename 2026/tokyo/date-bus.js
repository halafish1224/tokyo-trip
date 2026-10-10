/* Date navigation follows selection and reading; the bus is decorative. */
let dateBusDay=null,dateBusFrame=null,dateBusArrivalTimer=null,dateBusScrollFrame=null;
let dateBusMotion=null,dateBusPosition=null,dateBusWheelTurn=0,dateBusWheelRadius=6.3;

function dateBusStatus(day,driving=false){
 $('date-bus-status').textContent=`日期巴士 · ${day.date.slice(5).replace('-','/')} ${driving?'行駛中':'停靠這一站'} · 左右滑動選站`;
}
function positionDateBus(vehicle,x,rolling=false){
 if(rolling&&dateBusPosition!==null){
  const facing=vehicle.classList.contains('go-left')?-1:1;
  dateBusWheelTurn+=(x-dateBusPosition)*facing*360/(2*Math.PI*dateBusWheelRadius);
 }
 dateBusPosition=x;
 vehicle.style.transform=`translateX(${x}px)`;
 vehicle.style.setProperty('--bus-wheel-turn',`${dateBusWheelTurn}deg`);
 vehicle.dataset.x=String(x);
}
function cancelDateBusMotion(){
 if(dateBusFrame!==null)cancelAnimationFrame(dateBusFrame);
 dateBusFrame=null;dateBusMotion=null;
 clearTimeout(dateBusArrivalTimer);dateBusArrivalTimer=null;
 $('date-bus-vehicle')?.classList.remove('is-driving','is-arrived');
}
function finishDateBusMotion(){
 const motion=dateBusMotion;if(!motion)return;
 const vehicle=$('date-bus-vehicle');
 positionDateBus(vehicle,motion.to,true);
 if(motion.follow)$('date-bus-scroll').scrollLeft=motion.toLeft;
 cancelDateBusMotion();
 vehicle.classList.add('is-arrived');dateBusStatus(motion.day);
 dateBusArrivalTimer=setTimeout(()=>{
  vehicle.classList.remove('is-arrived');vehicle.classList.add('is-parked');
  dateBusArrivalTimer=null;
 },360);
}
function stepDateBus(timestamp){
 dateBusFrame=null;
 const motion=dateBusMotion;if(!motion)return;
 if(reducedMotion()||document.hidden){renderDateBus(false);return;}
 if(motion.started===null)motion.started=timestamp;
 // Close the doors first, then accelerate and brake along one shared curve.
 const p=Math.max(0,Math.min(1,(timestamp-motion.started-120)/motion.duration));
 const eased=p*p*p*(p*(p*6-15)+10);
 positionDateBus($('date-bus-vehicle'),motion.from+(motion.to-motion.from)*eased,true);
 if(motion.follow)$('date-bus-scroll').scrollLeft=motion.fromLeft+(motion.toLeft-motion.fromLeft)*eased;
 if(p===1)finishDateBusMotion();else dateBusFrame=requestAnimationFrame(stepDateBus);
}
async function loadDateBusArt(){
 // Inline our local SVG so the page's motion preference also controls its parts.
 // The static image remains the fallback if this optional read fails.
 try{
  const response=await fetch('images/date-bus.svg');if(!response.ok)return;
  const source=new DOMParser().parseFromString(await response.text(),'image/svg+xml');
  if(source.querySelector('parsererror')||source.documentElement.localName!=='svg')return;
  const svg=document.importNode(source.documentElement,true);
  svg.setAttribute('aria-hidden','true');svg.setAttribute('focusable','false');
  svg.removeAttribute('role');svg.removeAttribute('aria-label');
  $('date-bus-vehicle')?.querySelector('.date-bus-direction')?.replaceChildren(svg);
 }catch{/* Navigation and the cached static drawing remain usable. */}
}
function renderDateBus(animate=true){
 const picker=$('day-picker');if(!picker||familyMode)return;
 if(!$('date-bus')){
  const days=TRIP.days.filter(d=>d.date>='2026-12-13'&&d.date<='2026-12-26');
  picker.insertAdjacentHTML('beforebegin',`<div class="date-bus" id="date-bus"><p class="date-bus-caption" id="date-bus-status" aria-live="polite" aria-atomic="true"></p><div class="date-bus-scroll" id="date-bus-scroll" role="region" aria-label="日期巴士站，可左右滑動"><div class="date-bus-track"><div class="date-bus-road" aria-hidden="true"></div><div class="date-bus-vehicle is-parked" id="date-bus-vehicle" aria-hidden="true"><div class="date-bus-direction"><img src="images/date-bus.svg" width="84" height="56" alt="" draggable="false"></div></div><nav class="date-bus-stations" aria-label="12月13日至26日日期站牌">${days.map(d=>`<button type="button" class="date-bus-stop" data-bus-day="${d.id}" aria-label="選擇 ${h(d.date.slice(5).replace('-','/'))} ${h(dailyFeature(d).title)}"><span class="date-bus-pole" aria-hidden="true"></span><span class="date-bus-stop-date">${h(d.date.slice(5).replace('-','/'))}</span></button>`).join('')}</nav></div></div></div>`);
  const interruptFollow=()=>{if(dateBusMotion)dateBusMotion.follow=false;};
  $('date-bus-scroll').addEventListener('pointerdown',interruptFollow,{passive:true});
  $('date-bus-scroll').addEventListener('wheel',interruptFollow,{passive:true});
  loadDateBusArt();
 }
 if(!picker.closest('.date-bus-destination')){
  const label=document.querySelector('label[for="day-picker"]');if(label)label.hidden=true;
  const box=document.createElement('div');box.className='date-bus-destination';picker.before(box);
  box.innerHTML='<span id="date-bus-theme" aria-hidden="true"></span><span aria-hidden="true">⌄</span>';
  box.append(picker);picker.setAttribute('aria-label','選擇日期與旅程主題');
 }
 const day=selectedDay(),vehicle=$('date-bus-vehicle'),scroller=$('date-bus-scroll');
 const stop=document.querySelector(`[data-bus-day="${day.id}"]`);
 document.querySelectorAll('[data-bus-day]').forEach(b=>{if(b===stop)b.setAttribute('aria-current','date');else b.removeAttribute('aria-current');});
 $('date-bus-theme').textContent=day.date.slice(5).replace('-','/')+' · '+dailyFeature(day).title;picker.value=day.id;
 const changed=dateBusDay!==null&&dateBusDay!==day.id,initial=dateBusDay===null;
 dateBusDay=day.id;vehicle.hidden=!stop;
 // Repainting an unchanged itinerary must not interrupt a journey in progress.
 if(dateBusMotion&&!changed&&animate&&!reducedMotion())return;
 cancelDateBusMotion();vehicle.style.transition='none';
 if(!stop){$('date-bus-status').textContent='請用下方日期選單選擇行程';return;}
 const width=vehicle.offsetWidth||84,x=stop.offsetLeft+stop.offsetWidth/2-width/2;
 const left=Math.max(0,Math.min(scroller.scrollWidth-scroller.clientWidth,x+width/2-scroller.clientWidth/2));
 dateBusWheelRadius=9*width/120;
 const moving=animate&&changed&&dateBusPosition!==null&&Math.abs(x-dateBusPosition)>1&&!reducedMotion()&&!document.hidden;
 if(moving){
  const distance=Math.abs(x-dateBusPosition),duration=Math.min(1500,Math.max(700,560+distance*.7));
  vehicle.classList.toggle('go-left',x<dateBusPosition);
  vehicle.classList.remove('is-parked');vehicle.classList.add('is-driving');
  vehicle.style.setProperty('--bus-travel-time',`${duration+120}ms`);
  dateBusMotion={day,from:dateBusPosition,to:x,fromLeft:scroller.scrollLeft,toLeft:left,duration,started:null,follow:true};
  dateBusStatus(day,true);dateBusFrame=requestAnimationFrame(stepDateBus);
 }else{
  if(changed&&dateBusPosition!==null&&Math.abs(x-dateBusPosition)>1)vehicle.classList.toggle('go-left',x<dateBusPosition);
  vehicle.classList.add('is-parked');positionDateBus(vehicle,x);dateBusStatus(day);
  if(changed||initial||!animate)scroller.scrollLeft=left;
 }
}
const dateBusBaseRender=renderApp;
renderApp=function(){dateBusBaseRender();renderDateBus();};
document.addEventListener('click',event=>{const stop=event.target.closest('[data-bus-day]');if(!stop||familyMode)return;pinnedDate=true;jumpToDay(stop.dataset.busDay);});
window.addEventListener('resize',()=>renderDateBus(false),{passive:true});
document.addEventListener('click',event=>{if(event.target.closest('button[data-reading]'))requestAnimationFrame(()=>renderDateBus(false));});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&dateBusMotion)renderDateBus(false);});
renderDateBus(false);

// Observe the reading line below the fixed navigation, without rebuilding content.
function syncDateBusFromViewport(){
 dateBusScrollFrame=null;
 if(familyMode||currentSection!=='trip'||viewMode==='journal')return;
 const sidebar=document.querySelector('.day-sidebar'),menu=document.querySelector('.topbar');
 if(!sidebar||!menu)return;
 const line=Math.min(window.innerHeight*.65,Math.max(menu.getBoundingClientRect().bottom,sidebar.getBoundingClientRect().bottom)+24);
 const cards=[...document.querySelectorAll('#itinerary-list > article[data-date]')];
 const card=cards.find(el=>{const r=el.getBoundingClientRect();return r.height>0&&r.top<=line&&r.bottom>line;});
 if(!card||card.id===activeDay)return;
 activeDay=card.id;pinnedDate=true;renderNav();renderDateBus();refreshNow();
}
window.addEventListener('scroll',()=>{if(!dateBusScrollFrame)dateBusScrollFrame=requestAnimationFrame(syncDateBusFromViewport);},{passive:true});
document.addEventListener('shown.bs.collapse',()=>renderDateBus());
document.addEventListener('tokyo-motion-change',()=>renderDateBus(false));
