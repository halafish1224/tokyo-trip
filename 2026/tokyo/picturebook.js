/* Display enhancements only. Itinerary data and all existing device keys stay intact. */
const BOOK_SCENES={'2026-12-13':'flight','2026-12-14':'coast','2026-12-15':'temple','2026-12-16':'castle','2026-12-17':'town','2026-12-18':'coast','2026-12-19':'station','2026-12-20':'ginza','2026-12-21':'park','2026-12-22':'asakusa','2026-12-23':'forest','2026-12-24':'mall','2026-12-25':'rest','2026-12-26':'flight'};
const BOOK_SCENE_RULES={flight:[/✈/],coast:[/江之島|江ノ島|鎌倉|材木座|腰越/],temple:[/大船|觀音|観音/],castle:[/小田原/],town:[/藤澤|藤沢/],station:[/東京|浜町/],ginza:[/銀座/,/大時計/],park:[/芝公園|草坪/],asakusa:[/淺草|浅草/,/上野/],forest:[/澀谷|渋谷|LOFT/,/Forest of Lights/],mall:[/LakeTown/i],rest:[]};
const PACKING_ITEMS=[['passport','護照與入境資料'],['medicine','常備藥與個人需要的用品'],['warm','保暖外套、圍巾'],['charge','手機、充電線、行動電源'],['water','水壺與輕便雨具'],['wallet','交通卡、錢包與必要票券']];
function sanitizeBookState(raw){
 const out={version:1,mustGo:{},packing:{}};
 if(!raw||typeof raw!=='object')return out;
 const known=new Set(buildDays().flatMap(d=>d.events.map(e=>e.id)));
 for(const[id,value]of Object.entries(raw.mustGo||{}).slice(0,1000))if(known.has(id)&&typeof value==='boolean')out.mustGo[id]=value;
 for(const[id]of PACKING_ITEMS)if(typeof raw.packing?.[id]==='boolean')out.packing[id]=raw.packing[id];
 return out;
}
let bookState=sanitizeBookState(readStore('tokyo_picturebook_v1',{}));
function getPicturebookState(){return sanitizeBookState(bookState);}
function mergePicturebookState(raw){if(familyMode)return;const clean=sanitizeBookState(raw);bookState={version:1,mustGo:{...bookState.mustGo,...clean.mustGo},packing:{...bookState.packing,...clean.packing}};writeStore('tokyo_picturebook_v1',bookState);}
function isDefaultMustGo(e){return !e.inherited&&!/候選|待購|原筆記/.test(e.title)&&/淺草寺參拜|全員新橋.*大時計|港區立芝公園草坪|LOFT 最大店|出發 越谷|江之島岩屋|鶴岡八幡宮/.test(e.title);}
function isMustGo(e){return !familyMode&&typeof bookState.mustGo[e.id]==='boolean'?bookState.mustGo[e.id]:isDefaultMustGo(e);}
function transportTags(e){
 const text=e.title+' '+(e.note||''),tags=[];
 if(/\bJR\b|NEX|京成|山手線|京濱東北線|武藏野線|江ノ電|江之電/.test(text))tags.push(['rail','🚆 鐵路']);
 if(/銀座線|大江戶線|有樂町線|淺草線|三田線|新宿線|地鐵|地下鐵/.test(text))tags.push(['metro','🚇 地鐵']);
 if(/接駁/.test(text))tags.push(['shuttle','🚌 接駁']);
 if(/步行|徒歩|漫步/.test(text))tags.push(['walk','🚶 步行']);
 return tags.length?`<span class="transport-tags" aria-label="原行程提到的交通方式">${tags.slice(0,2).map(([kind,label])=>`<span class="transport-tag ${kind}">${label}</span>`).join('')}</span>`:'';
}
const bookBaseCover=dayCoverHtml;
dayCoverHtml=function(day){const source='images/covers/'+day.date.slice(5).replace('-','')+'-picturebook.svg',kind=BOOK_SCENES[day.date]||'tokyo',route=meaningfulEvents(day).map(e=>e.title).join(' '),match=(BOOK_SCENE_RULES[kind]||[]).every(rule=>rule.test(route));return `<figure class="book-cover"><div class="book-cover-art" data-local-illustration="${source}">${pictureIllustration(kind,match?dailyFeature(day).title+' · 原創氣氛插畫':'前版氣氛插畫，路線更新後待核對')}</div><figcaption>DAY ${String(day.number).padStart(2,'0')} · ${h(day.guide.area)} · ${ext(source,'原創氣氛插畫 ↗')}${match?'':' · 插畫待依新路線更新'}</figcaption></figure><details class="reference-photo"><summary>看看這天的旅景照片</summary>${bookBaseCover(day)}<p class="small">照片作者、來源與授權列於隨身工具的圖片來源。</p></details>`;};
const bookBaseEvent=eventHtml;
eventHtml=function(e,day){
 let markup=bookBaseEvent(e,day);
 const must=isMustGo(e),tags=transportTags(e);
 if(tags)markup=markup.replace('</time></div>',`</time>${tags}</div>`);
 if(must)markup=markup.replace('<h3>',`<h3><span class="must-go-badge">★ 必去 · 重點行程</span> `);
 if(!familyMode&&!e.inherited)markup=markup.replace('<summary>這一站的實際紀錄</summary>',`<summary>這一站的紀錄與必去設定</summary><button type="button" class="btn btn-small must-go-toggle" data-must-go="${h(e.id)}" aria-pressed="${must}" aria-label="${must?'取消':'標為'}必去：${h(e.title)}">${must?'★ 已標必去':'☆ 標為必去'}</button>`);
 return markup;
};
const motionQuery=window.matchMedia?window.matchMedia('(prefers-reduced-motion: reduce)'):null;
function reducedMotion(){const preference=safeStorage.getItem('tokyo_motion_v1');return preference==='full'?false:preference==='reduce'?true:!!motionQuery?.matches;}
function applyMotion(){const reduce=reducedMotion();document.documentElement.dataset.motion=reduce?'reduce':'full';const checkbox=$('motion-toggle');checkbox.checked=reduce;checkbox.disabled=false;checkbox.title='勾選減少動態；取消即可播放動畫。僅在此裝置儲存。';document.dispatchEvent(new Event('tokyo-motion-change'));}
motionQuery?.addEventListener?.('change',applyMotion);
$('motion-toggle').addEventListener('change',event=>{safeStorage.setItem('tokyo_motion_v1',event.target.checked?'reduce':'full');applyMotion();});
function renderCountdown(){
 const today=todayJapan(),start='2026-12-13',end='2026-12-26',days=Math.round((Date.parse(start+'T00:00:00Z')-Date.parse(today+'T00:00:00Z'))/86400000);
 $('departure-countdown').innerHTML=days>0?`<span class="countdown-caption">距離出發</span><strong class="countdown-number">${days}</strong><span class="countdown-caption">天</span><span class="countdown-date">12/13（日）出發 · 依日本日期</span>`:today<=end?`<span class="countdown-caption">旅程第</span><strong class="countdown-number">${1-days}</strong><span class="countdown-caption">天 / 14 天</span>`:'<span class="countdown-caption">旅程已珍藏，回來看看那些足跡。</span>';
}
function renderFlights(){
 const flights=TRIP.days.flatMap(day=>day.events.filter(e=>/✈|CI\d{3}/.test(e.title)).map(e=>({day,event:e})));
 $('flight-cards').innerHTML=flights.map(({day,event:e})=>{
  const returning=/回台/.test(e.title),flight=e.title.match(/CI\s?\d{3}/)?.[0]||'班號待核對';
  return `<article class="flight-card">${dateStampHtml(day.date)}<h3>${returning?'回家航班':day.date==='2026-12-19'?'家族出發':'湘南旅程出發'} · ${h(flight)}</h3><p class="flight-route">${returning?'成田 → 桃園':'桃園 → 成田'}<br><span class="small">T2 → T2 · 依行程表，航廈待機票核對</span></p><strong class="flight-time">${h(e.time||'未定')} <span class="small">計畫起飛</span></strong><span class="badge badge-note">行程表計畫 · 未核實班次</span><p class="small">機票時間依當地時區；不換算抵達時間。</p><button type="button" class="btn btn-small" data-day-jump="${h(day.id)}">查看 ${h(day.date.slice(5).replace('-','/'))} 行程</button></article>`;
 }).join('');
}
function renderPacking(){
 const target=$('packing-checklist');target.hidden=familyMode;
 if(familyMode){target.innerHTML='';return;}
 const done=PACKING_ITEMS.filter(([id])=>bookState.packing[id]).length;
 target.innerHTML=`<h2>隨身物品待辦 <span class="badge">${done} / ${PACKING_ITEMS.length}</span></h2><p class="small">勾選僅存在此裝置，可隨完整備份或備份碼匯出。</p><ul class="packing-list">${PACKING_ITEMS.map(([id,label])=>`<li><label class="packing-item"><input type="checkbox" data-packing="${id}"${bookState.packing[id]?' checked':''}><span>${label}</span></label></li>`).join('')}</ul>`;
}
function enhanceBook(){document.body.dataset.section=currentSection;renderCountdown();renderFlights();renderPacking();}
const bookBaseRender=renderApp;
renderApp=function(){bookBaseRender();enhanceBook();};
const bookBaseSection=showSection;
showSection=function(section,options={}){bookBaseSection(section,options);document.body.dataset.section=currentSection;};
const bookBaseJump=jumpToDay;
jumpToDay=function(id,eventId){bookBaseJump(id,eventId);requestAnimationFrame(()=>{
 const target=$(eventId?'event-'+eventId:id);if(!target)return;
 const menu=document.querySelector('.topbar').getBoundingClientRect().height,selector=document.querySelector('.day-sidebar'),picker=selector.getClientRects().length&&getComputedStyle(selector).position==='sticky'?selector.getBoundingClientRect().height:0;
 window.scrollTo({top:Math.max(0,window.scrollY+target.getBoundingClientRect().top-menu-picker-20),behavior:reducedMotion()?'instant':'smooth'});
 if(!reducedMotion()&&$(id)){const day=$(id);day.classList.remove('date-bounce');void day.offsetWidth;day.classList.add('date-bounce');}
});};
const bookBaseClock=refreshClock;
refreshClock=function(){bookBaseClock();renderCountdown();};
document.addEventListener('click',event=>{
 const button=event.target.closest('[data-must-go],[data-home]');if(!button)return;
 if(button.hasAttribute('data-home')){event.preventDefault();if(!familyMode){viewMode='plan';filter='all';renderApp();}showSection('trip',{scroll:false});window.scrollTo({top:0,behavior:reducedMotion()?'instant':'smooth'});return;}
 if(familyMode)return;const e=buildDays().flatMap(d=>d.events).find(e=>e.id===button.dataset.mustGo);if(!e)return;
 bookState.mustGo[e.id]=!isMustGo(e);writeStore('tokyo_picturebook_v1',bookState);
 const li=button.closest('.event'),must=isMustGo(e);button.setAttribute('aria-pressed',String(must));button.setAttribute('aria-label',(must?'取消':'標為')+'必去：'+e.title);button.textContent=must?'★ 已標必去':'☆ 標為必去';
 li.querySelector('.must-go-badge')?.remove();if(must)li.querySelector('h3').insertAdjacentHTML('afterbegin','<span class="must-go-badge">★ 必去 · 重點行程</span> ');
});
document.addEventListener('change',event=>{const id=event.target.dataset?.packing;if(familyMode||!PACKING_ITEMS.some(([key])=>key===id))return;bookState.packing[id]=event.target.checked;writeStore('tokyo_picturebook_v1',bookState);renderPacking();});
$('hero-illustration').innerHTML=pictureIllustration('tokyo','東京與湘南的冬日旅行 · 原創繪本插畫');
// Keep the Tools heading before hotel contact cards.
if($('hotel-directory'))$('sec-trans').querySelector('.page-heading').insertAdjacentElement('afterend',$('hotel-directory'));
if($('source-info'))$('sec-trans').append($('source-info'));
applyMotion();renderApp();updateNavigationMetrics();
