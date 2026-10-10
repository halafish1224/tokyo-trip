/* Date navigation follows selection and reading; the bus is decorative. */
let dateBusDay=null,dateBusFrame=null,dateBusArrivalTimer=null,dateBusScrollFrame=null;
let dateBusMotion=null,dateBusPosition=null,dateBusWheelTurn=0,dateBusWheelRadius=6.3;
const DATE_BUS_TEMPERATURES=[
 {below:5,key:'cold',label:'低於5°C',body:'#9DC6E0',stripe:'#75ABC9'},
 {below:12,key:'cool',label:'5–未滿12°C',body:'#B9DAA5',stripe:'#96BE85'},
 {below:20,key:'mild',label:'12–未滿20°C',body:'#F6D27A',stripe:'#EABF61'},
 {below:28,key:'warm',label:'20–未滿28°C',body:'#F2B287',stripe:'#DE946C'},
 {below:Infinity,key:'hot',label:'28°C以上',body:'#ECA19B',stripe:'#D7807C'}
];
function dateBusWeatherArt(){return `<svg class="date-bus-sky" viewBox="0 0 56 40" aria-hidden="true" focusable="false"><g stroke="#3E3A39" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><g class="bus-sky-sun"><circle cx="28" cy="20" r="9" fill="#F6D27A"/><path d="M28 3V7M28 33V37M11 20H15M41 20H45M16 8L19 11M37 29L40 32M16 32L19 29M37 11L40 8"/></g><g class="bus-sky-cloud"><path d="M13 28Q6 28 8 21Q9 16 15 17Q15 8 24 9Q31 8 34 17Q43 13 47 21Q50 28 42 28Z" fill="#FFFCF6"/></g><g class="bus-sky-rain"><path d="M7 22Q9 8 21 8Q33 8 35 22Q30 18 26 22Q21 18 17 22Q12 18 7 22Z" fill="#A8D3E6"/><path d="M21 8V32Q21 37 16 35" fill="none"/><path d="M42 7Q36 15 42 16Q48 15 42 7ZM47 23Q41 31 47 32Q53 31 47 23Z" fill="#A8D3E6"/></g><g class="bus-sky-snow"><path d="M28 6V34M16 13L40 27M16 27L40 13M24 9L28 13L32 9M24 31L28 27L32 31" fill="none"/></g><g class="bus-sky-fog"><path d="M10 13H42M15 20H47M9 27H40" fill="none"/></g></g></svg>`;}
function dateBusSky(row){
 if(!row)return 'default';
 if([51,53,55,56,57,61,63,65,66,67,80,81,82,95,96,97,99].includes(row.code))return 'rain';
 if([71,73,75,77,85,86].includes(row.code))return 'snow';
 if([45,48].includes(row.code))return 'fog';
 return row.code===2?'partly':row.code===3?'cloud':'sun';
}
function renderDateBusWeather(day){
 const vehicle=$('date-bus-vehicle'),label=$('date-bus-weather-status');if(!vehicle||!label)return;
 const city=forecastCityForDay(day),{row,cache,status}=forecastForDay(city,day.date),sky=dateBusSky(row);
 const band=row?DATE_BUS_TEMPERATURES.find(x=>row.max<x.below):DATE_BUS_TEMPERATURES[2];
 vehicle.dataset.sky=sky;vehicle.dataset.temperature=row?band.key:'unknown';
 vehicle.style.setProperty('--bus-body-color',band.body);vehicle.style.setProperty('--bus-stripe-color',band.stripe);
 const text=row?`${WEATHER[city].name} · 最高${row.max}°C · ${weatherCode(row.code)[1]+(sky==='rain'?'預報':'')} · ${status}`:'尚無預報 · 太陽為預設插畫';
 if(label.textContent!==text)label.textContent=text;label.dataset.forecast=row?'available':'unavailable';
 label.title=row?`${day.date} ${text}；降水機率${row.rain}%；取得 ${formatTimestamp(cache.updatedAt)}；車色依每日最高溫。`:`${day.date} ${WEATHER[city].name}，日期不在可用7日預報內或資料未取得；預設黃色不代表溫度。`;
 if($('date-bus-weather-detail'))$('date-bus-weather-detail').textContent=label.title;
}

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
  picker.insertAdjacentHTML('beforebegin',`<div class="date-bus" id="date-bus"><p class="date-bus-caption" id="date-bus-status" aria-live="polite" aria-atomic="true"></p><p class="date-bus-weather-status" id="date-bus-weather-status" aria-live="polite" aria-atomic="true"></p><div class="date-bus-scroll" id="date-bus-scroll" role="region" aria-label="日期巴士站，可左右滑動"><div class="date-bus-track"><div class="date-bus-road" aria-hidden="true"></div><div class="date-bus-vehicle is-parked" id="date-bus-vehicle" aria-hidden="true">${dateBusWeatherArt()}<div class="date-bus-direction"><img src="images/date-bus.svg" width="84" height="56" alt="" draggable="false"></div></div><nav class="date-bus-stations" aria-label="12月13日至26日日期站牌">${days.map(d=>`<button type="button" class="date-bus-stop" data-bus-day="${d.id}" aria-label="選擇 ${h(d.date.slice(5).replace('-','/'))} ${h(dailyFeature(d).title)}"><span class="date-bus-pole" aria-hidden="true"></span><span class="date-bus-stop-date">${h(d.date.slice(5).replace('-','/'))}</span></button>`).join('')}</nav></div></div></div>`);
  $('weather-heading').closest('section').insertAdjacentHTML('beforeend',`<details class="date-bus-weather-key"><summary>日期巴士的天候與溫度色階</summary><p>車色依當日所在地區的每日最高溫；雨滴與雨傘表示降雨預報。尚無預報時使用黃色與太陽插畫，不代表晴天或溫度。</p><p id="date-bus-weather-detail"></p><ul>${DATE_BUS_TEMPERATURES.map(x=>`<li><span class="date-bus-swatch" style="--swatch:${x.body}" aria-hidden="true"></span>${x.label}</li>`).join('')}</ul><p>使用東京、湘南或小田原的區域預報，非每個景點的現場天氣。快取顯示原取得時間；超過24小時標示過期。${ext('https://open-meteo.com/en/docs','Open-Meteo 預報說明 ↗')}</p></details>`);
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
 renderDateBusWeather(day);requestDayForecast(day);
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
document.addEventListener('tokyo-weather-change',()=>{if(familyMode)return;const day=selectedDay();renderDateBusWeather(day);requestDayForecast(day);});
