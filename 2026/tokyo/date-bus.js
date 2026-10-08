/* Date navigation follows both explicit selection and the visible itinerary. */
let dateBusDay=null,dateBusTimer=null,dateBusScrollFrame=null;
function renderDateBus(animate=true){
 const picker=$('day-picker');if(!picker||familyMode)return;
 if(!$('date-bus')){
  const days=TRIP.days.filter(d=>d.date>='2026-12-13'&&d.date<='2026-12-26');
  picker.insertAdjacentHTML('beforebegin',`<div class="date-bus" id="date-bus"><p class="date-bus-caption" id="date-bus-status" aria-live="polite"></p><div class="date-bus-scroll" id="date-bus-scroll" role="region" aria-label="日期巴士站，可左右滑動"><div class="date-bus-track"><div class="date-bus-road" aria-hidden="true"></div><div class="date-bus-vehicle" id="date-bus-vehicle" aria-hidden="true"><img src="images/date-bus.svg" width="64" height="44" alt="" draggable="false"></div><nav class="date-bus-stations" aria-label="12月13日至26日日期站牌">${days.map(d=>`<button type="button" class="date-bus-stop" data-bus-day="${d.id}" aria-label="選擇 ${h(d.date.slice(5).replace('-','/'))} ${h(dailyFeature(d).title)}"><span class="date-bus-pole" aria-hidden="true"></span><span>${h(d.date.slice(5).replace('-','/'))}</span></button>`).join('')}</nav></div></div></div>`);
 }
 if(!picker.closest('.date-bus-destination')){const label=document.querySelector('label[for="day-picker"]');if(label)label.hidden=true;const box=document.createElement('div');box.className='date-bus-destination';picker.before(box);box.innerHTML='<span id="date-bus-theme" aria-hidden="true"></span><span aria-hidden="true">⌄</span>';box.append(picker);picker.setAttribute('aria-label','選擇日期與旅程主題');}
 const day=selectedDay(),vehicle=$('date-bus-vehicle'),scroller=$('date-bus-scroll'),stop=document.querySelector(`[data-bus-day="${day.id}"]`);
 document.querySelectorAll('[data-bus-day]').forEach(b=>{if(b===stop)b.setAttribute('aria-current','date');else b.removeAttribute('aria-current');});
 $('date-bus-theme').textContent=day.date.slice(5).replace('-','/')+' · '+dailyFeature(day).title;picker.value=day.id;
 const changed=dateBusDay!==null&&dateBusDay!==day.id;
 $('date-bus-status').textContent=stop?`日期巴士 · ${day.date.slice(5).replace('-','/')} ${changed&&!reducedMotion()?'出發，前往這一站':'停靠這一站'} · 左右滑動選站`:'請用下方日期選單選擇行程';
 vehicle.hidden=!stop;
 clearTimeout(dateBusTimer);
 if(stop){
  const x=stop.offsetLeft+stop.offsetWidth/2-32,previous=Number(vehicle.dataset.x||x),moving=animate&&changed&&!reducedMotion();
  vehicle.style.transition=moving?'transform 800ms ease-in-out':'none';
  vehicle.classList.toggle('is-driving',moving);vehicle.classList.toggle('go-left',x<previous);
  vehicle.style.transform=`translateX(${x}px)`;vehicle.dataset.x=String(x);
  const left=Math.max(0,Math.min(scroller.scrollWidth-scroller.clientWidth,x+32-scroller.clientWidth/2));if(scroller.scrollTo)scroller.scrollTo({left,behavior:moving?'smooth':'instant'});else scroller.scrollLeft=left;
  if(moving)dateBusTimer=setTimeout(()=>{vehicle.classList.remove('is-driving');$('date-bus-status').textContent=`日期巴士 · ${day.date.slice(5).replace('-','/')} 停靠這一站 · 左右滑動選站`;},850);
 }
 dateBusDay=day.id;
}
const dateBusBaseRender=renderApp;
renderApp=function(){dateBusBaseRender();renderDateBus();};
document.addEventListener('click',event=>{const stop=event.target.closest('[data-bus-day]');if(!stop||familyMode)return;pinnedDate=true;jumpToDay(stop.dataset.busDay);});
window.addEventListener('resize',()=>renderDateBus(false),{passive:true});
document.addEventListener('click',event=>{if(event.target.closest('[data-reading]'))requestAnimationFrame(()=>renderDateBus(false));});
renderDateBus(false);

// Observe the reading line below the fixed navigation, without rebuilding content.
function syncDateBusFromViewport(){
 dateBusScrollFrame=null;
 if(familyMode||currentSection!=='trip'||viewMode==='journal')return;
 const sidebar=document.querySelector('.day-sidebar');
 const line=Math.min(window.innerHeight*.65,Math.max(document.querySelector('.topbar').getBoundingClientRect().bottom,sidebar.getBoundingClientRect().bottom)+24);
 const cards=[...document.querySelectorAll('#itinerary-list > article[data-date]')];
 const card=cards.find(el=>{const r=el.getBoundingClientRect();return r.height>0&&r.top<=line&&r.bottom>line;});
 if(!card||card.id===activeDay)return;
 activeDay=card.id;pinnedDate=true;renderNav();renderDateBus();refreshNow();
}
window.addEventListener('scroll',()=>{if(!dateBusScrollFrame)dateBusScrollFrame=requestAnimationFrame(syncDateBusFromViewport);},{passive:true});
document.addEventListener('shown.bs.collapse',()=>renderDateBus());
document.addEventListener('tokyo-motion-change',()=>renderDateBus(false));
