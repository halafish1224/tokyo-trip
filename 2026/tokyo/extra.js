/* Separate planning, field use and memory; preserve v3 local edits. */
const routeParams=new URLSearchParams(location.search);
const familyMode=routeParams.get('mode')==='family';
let viewMode='plan',notesLayer='today',gpsPosition=null,currentSection='trip';
let pinnedDate=routeParams.has('day');
let decisionState=readStore('tokyo_decisions_v1',{}),journal=readStore('tokyo_journal_v1',{});
let privateNotes=readStore('tokyo_private_v1','');
if(!decisionState||typeof decisionState!=='object')decisionState={};
if(!journal||typeof journal!=='object')journal={};
const baseBuildDays=buildDays;
buildDays=function(){return familyMode?parsed.days.filter(d=>d.id===activeDay).map(d=>({...d,events:d.events.map(e=>({...e}))})):baseBuildDays();};
function requestedDay(){const raw=routeParams.get('day');return parsed.days.find(d=>d.date===raw||d.date.slice(5)===raw);}
function initializeExperience(){
 const today=todayJapan(),requested=requestedDay();
 viewMode=familyMode||requested?'today':today<'2026-12-13'?'plan':today>'2026-12-26'?'journal':'today';
 activeDay=(requested||parsed.days.find(d=>d.date===today)||parsed.days[0]).id;filter='all';
 document.body.classList.toggle('family-mode',familyMode);
 if(familyMode){$('share-day').textContent='複製當日日頁連結';$('source-info').hidden=true;}
 document.querySelector('.hero-desc').textContent=familyMode?'家人共用日頁 · 公開路線唯讀':'12/13–26・東京冬日旅行手冊　先走湘南，再與家人一起過聖誕。';
 renderPhrasebook();renderHotelDirectory();renderPrivatePanel();
}
const baseShowSection=showSection;
showSection=function(section,options={}){
 const returnFromJournal=section==='trip'&&viewMode==='journal'&&currentSection!=='trip';
 currentSection=section;
 if(returnFromJournal){viewMode='plan';renderApp();}
 baseShowSection(section,options);
 document.querySelector('.experience').hidden=section!=='trip';
 $('decision-board').hidden=section!=='trans';
 $('overview').hidden=section!=='trip'||viewMode!=='plan';
 $('journal-view').hidden=section!=='trip'||viewMode!=='journal';
};
function selectedDay(){return buildDays().find(d=>d.id===activeDay)||buildDays()[0];}
function renderExperience(){
 document.body.dataset.mode=viewMode;
 document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===viewMode)));
 const day=selectedDay(),today=todayJapan(),isToday=day.date===today;
 $('experience-title').textContent=viewMode==='plan'?'出發前，先把重要的確認好。':viewMode==='journal'?'那些走過的路，都留下來。':`${day.date.slice(5).replace('-','/')} · ${familyMode?'家人日頁':isToday?'Today 今天':'單日預覽'}`;
 $('experience-status').textContent=viewMode==='plan'?'待確認事項見「隨身工具」。':viewMode==='journal'?'留下打卡、花費與回憶。':`${isToday?'日本今天':'行程預覽'} · ${day.guide.area} · ${navigator.onLine?'連線中':'離線可查路線與已儲存資訊'}`;
 $('experience-clock').textContent='日本時間 '+new Intl.DateTimeFormat('zh-TW',{timeZone:'Asia/Tokyo',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date());
 document.querySelector('.experience').hidden=currentSection!=='trip';$('decision-board').hidden=currentSection!=='trans';$('overview').hidden=currentSection!=='trip'||viewMode!=='plan';$('journal-view').hidden=currentSection!=='trip'||viewMode!=='journal';
 const events=day.events.filter(e=>!e.inherited&&!/住宿據點$/.test(e.title));
 const next=events.find(e=>(familyMode||!localState.checks[e.id])&&(!isToday||timeMinutes(e.time)>=japanMinutes()));
 $('next-stop').innerHTML=viewMode==='today'?`<div class="next-card"><span class="badge">下一站 · 行程計畫時間</span><h3>${next?h(next.time+' '+next.title):'今天的計畫已到尾聲'}</h3><p>${h(day.guide.text)}</p><p class="small">班次請以鐵路官網為準。</p><div class="source-links">${day.guide.sources.map(k=>SOURCES[k]?ext(SOURCES[k].url,SOURCES[k].name+' ↗'):'').join('')}</div></div>`:'';
 $('share-day').hidden=viewMode==='journal';
 document.querySelector('.travel-support').open=viewMode==='today';
 document.querySelector('[data-section="trip"] .nav-label').textContent=viewMode==='today'?'Today 今天':'每日行程';
 renderDecisions();renderOverview();if(viewMode==='journal')renderJournal();renderWeather();
}
function renderDecisions(){
 const items=familyMode?TRIP.decisions.filter(x=>x.day===activeDay):TRIP.decisions;
 const references=(TRAVEL_BUNDLE.items||[]).map(info=>({info,day:parsed.days.find(d=>d.events.some(e=>info.keys.some(k=>noteKey(e.title).includes(noteKey(k)))))})).filter(x=>!familyMode||x.day?.id===activeDay);
 $('decision-board').innerHTML=`<h2>出發決策看板 <span class="badge badge-note">${items.filter(x=>familyMode||!decisionState[x.id]).length} 項待處理</span></h2><p class="small">${familyMode?'提醒依公開行程顯示，不含個人確認狀態。':'勾選代表你已處理，僅存在此裝置；不表示官方已確認。'}</p><div class="decision-grid">${items.map(x=>`<article class="decision ${!familyMode&&decisionState[x.id]?'resolved':'unresolved'}"><h3><span aria-hidden="true">${!familyMode&&decisionState[x.id]?'✓':'●'}</span> ${h(x.title)}</h3><p>${h(x.text)}</p><button class="btn btn-small" data-day-jump="${x.day}">查看相關日期</button>${familyMode?'':`<label><input type="checkbox" data-decision="${x.id}"${decisionState[x.id]?' checked':''}> 我已處理</label>`}</article>`).join('')}</div><details class="decision-references"><summary>相關交通、營業與票券查證 · ${references.length} 項</summary>${references.map(({info,day})=>`<article class="decision-reference"><h3>${h(info.title)}</h3><p>${richText(info.text)}</p><div class="source-links">${ext(info.source,'官方資料 ↗')}<span>查閱 ${h(info.checked)}</span>${day?`<button class="btn btn-small" data-day-jump="${day.id}">看 ${h(day.date.slice(5))}</button>`:''}</div></article>`).join('')}</details>`;
}
function renderOverview(){if(viewMode!=='plan')return;$('overview').innerHTML=`<h2>14日總覽</h2><div class="overview-grid">${buildDays().map(d=>`<button class="overview-day" data-date="${d.date}" data-day-jump="${d.id}"><time>${h(d.date.slice(5).replace('-','/'))}</time><strong>${h(dailyFeature(d).title)}</strong><span>${h(d.guide.area)}</span></button>`).join('')}</div>`;}
function venueCard(v){
 const sources=v.sources||[];
 return `<article class="venue-card"><span class="badge${v.verified?'':' badge-note'}">${v.verified?'官網資料 '+h(v.checked):'部分資訊待核對'+(v.checked?' · '+h(v.checked):'')}</span>${v.category?` <span class="badge">${h(v.category)}</span>`:''}<h4 lang="ja">${h(v.ja)}</h4>${v.highlight?`<p><strong>不想錯過</strong> ${h(v.highlight)}</p>`:''}${v.caution?`<p class="day-note">${h(v.caution)}</p>`:''}${v.pending?.length?`<p class="small">待核對：${h(v.pending.join('、'))}</p>`:''}<dl><dt>地址</dt><dd>${h(v.address||'尚未核對，請用日文名稱導航')}</dd><dt>出口</dt><dd>${h(v.exit||'尚未核對，請確認站內指標')}</dd><dt>營業／休館</dt><dd>${h(v.hours||'尚未核對，出發前查官網')}</dd><dt>電話</dt><dd>${h(v.phone||'未提供核實電話')}</dd></dl><div class="event-tools"><button class="btn btn-small" data-copy="${h(v.ja)}">複製日文名</button>${v.address?`<button class="btn btn-small" data-copy="${h(v.ja+'\n'+v.address)}">給櫃台看／複製地址</button>`:''}${v.phone?`<button class="btn btn-small" data-copy="${h(v.phone)}">複製電話</button><a class="btn btn-small" href="tel:${h(v.phone)}">撥打</a>`:''}${v.official?ext(v.official,'官方資料 ↗','btn btn-small'):''}</div>${sources.length?`<details class="venue-sources"><summary>查證來源</summary><ul>${sources.map(s=>`<li>${ext(s.url,s.label+' ↗')} · ${h(s.checked)}<br>${h((s.fields||[]).join('、'))}</li>`).join('')}</ul></details>`:''}</article>`;
}
const baseEventHtml=eventHtml;
function seniorStopHtml(stop){
 const conditional=stop.status!=='官方已核實';
 return `<details class="senior-stop${conditional?' senior-stop-pending':''}"><summary><span class="senior-stop-label">樂齡推薦點${conditional?' · 待核對':''}</span><span class="senior-stop-name">${h(stop.for)}：${h(stop.name)}</span></summary><div class="senior-stop-body"><strong lang="ja">${h(stop.ja)}</strong><p>${h(stop.why)}</p><p class="senior-stop-caution">注意：${h(stop.caution||'出發前請再確認當日狀況。')}</p><dl><dt>位置</dt><dd>${h(stop.address)}</dd><dt>開放</dt><dd>${h(stop.hours)}</dd></dl><div class="event-tools">${ext(mapUrl(stop.ja+' '+stop.address),'導航 ↗','btn btn-small')}${ext(stop.source,'官方來源 ↗','btn btn-small')}</div><p class="small">${h(stop.status)} · 查核 ${h(stop.checked)}。座位以現場為準；不是對個人體力或無障礙的保證。</p></div></details>`;
}
function optionalEventHtml(day){
 const options=(TRIP.optionalEvents||[]).filter(item=>item.date===day.date);
 return options.length?`<section class="optional-route" aria-label="夜間活動資料"><h3>夜間活動 · 票券與步行提醒</h3>${options.map(item=>{const scheduled=day.events.some(e=>e.title.includes('Forest of Lights')&&item.id==='yoyogi-forest-of-lights-2026');return `<article class="optional-route-card"><span class="badge badge-note">${scheduled?'已列入行程 · 時段待訂票':'可選'} · ${h(item.status)}</span><h4>${h(item.title)}</h4><p lang="ja">${h(item.ja)}</p><p>${h(item.route)}</p><p><strong>日期／時段：</strong>${h(item.hours)}</p><p><strong>票券：</strong>${h(item.ticket)}</p><p class="optional-route-warning"><strong>注意：</strong>${h(item.caution)}</p>${item.seniorStop?seniorStopHtml(item.seniorStop):''}<div class="event-tools">${ext(mapUrl(item.ja+' '+item.address),'地圖 ↗','btn btn-small')}${ext(item.source,'主辦公告 ↗','btn btn-small')}${item.ticketSource?ext(item.ticketSource,'售票資訊 ↗','btn btn-small'):''}</div><p class="small">${h(item.address)} · 查核 ${h(item.checked)}。尚未替你購票。</p></article>`}).join('')}</section>`:'';
}
eventHtml=function(e,day){
 let html=baseEventHtml(e,day);
 const venues=(e.venueIds||[]).map(id=>TRIP.venues.find(v=>v.id===id)).filter(Boolean);
 const seniorStops=(TRIP.seniorStops||[]).filter(stop=>stop.eventId===e.id);
 const state=journal[e.id]||{};
 const tools=familyMode?'':`<details class="journal-editor"><summary>這一站的實際紀錄</summary><label>結果 <select data-journal-status="${h(e.id)}"><option value="">尚未記錄</option>${[['went','去了'],['rescheduled','改期'],['skipped','沒去']].map(([v,t])=>`<option value="${v}"${state.status===v?' selected':''}>${t}</option>`).join('')}</select></label><label>一句話 <input maxlength="300" data-journal-text="${h(e.id)}" value="${h(state.text||'')}" placeholder="今天最想記住的一件事"></label><label>一張照片 <input type="file" accept="image/*" data-journal-photo="${h(e.id)}"></label>${state.photo?`<img class="journal-photo" src="${h(state.photo)}" alt="這一站的私人照片"><button class="btn btn-small" data-photo-remove="${h(e.id)}">移除照片</button>`:''}<p class="small">只存在此裝置；照片縮小後儲存，請定期匯出完整備份。</p></details>`;
 return html.replace(/<\/li>$/,`${seniorStops.map(seniorStopHtml).join('')}${venues.length?`<details class="venue-details"><summary>日文名稱・地址・出口・營業資訊</summary>${venues.map(venueCard).join('')}</details>`:`<div class="event-tools"><button class="btn btn-small" data-copy="${h(e.navigation||e.title)}">複製導航名稱</button><span class="small">複合行程／分店資訊待核對</span></div>`}${tools}</li>`);
};
function renderHotelDirectory(){
 const panel=document.createElement('section');panel.className='panel';panel.id='hotel-directory';panel.innerHTML='<h2>住宿聯絡資料參考</h2><p class="small">飯店公開聯絡資訊；不代表已訂房。訂位碼、房號請放下方私人筆記。</p>'+TRIP.venues.filter(v=>v.id.startsWith('hotel-')).map(venueCard).join('');$('sec-trans').prepend(panel);
}
function renderPhrasebook(){
 $('phrasebook').innerHTML='<h2>給店員看，直接複製日文</h2>'+[['請問有這個商品嗎？','この商品はありますか？'],['請問可以免稅嗎？','免税できますか？'],['請問可以刷卡嗎？','クレジットカードは使えますか？'],['可以幫我寫下來嗎？','書いていただけますか？'],['請問這班車往成田機場嗎？','この電車は成田空港に行きますか？'],['我想確認預約。','予約を確認したいです。']].map(([zh,ja])=>`<div class="phrase"><p>${h(zh)}</p><strong lang="ja">${h(ja)}</strong><button class="btn btn-small" data-copy="${h(ja)}">複製日文</button></div>`).join('');
}
function renderPrivatePanel(){
 if(familyMode)return;
 const panel=document.createElement('section');panel.className='panel';panel.innerHTML=`<h2>裝置內的私人筆記</h2><p class="small">訂位碼、房號與保險資訊只儲存在此裝置，不上傳。完整備份會包含此欄，請妥善保管。</p><textarea id="private-notes" rows="5" maxlength="12000" aria-label="私人旅遊筆記">${h(privateNotes)}</textarea><h3>換手機備份碼</h3><p class="small">包含打卡、記帳與待購狀態；不含照片、私人筆記或自訂行程。家人日頁只分享公開路線。</p><button class="btn" id="state-code">產生備份碼</button><label>備份碼<textarea id="backup-code" rows="3" maxlength="100000" placeholder="在新手機貼上備份碼"></textarea></label><button class="btn" id="import-code">匯入狀態（合併）</button>`;$('sec-trans').append(panel);
}
function renderJournal(){
 let actual=0;const total=expenses.reduce((n,e)=>n+e.cost,0);
 $('journal-view').innerHTML=`<h2>14天實際路線</h2><p>花費 ¥${total.toLocaleString()} · 約 NT$${Math.round(total*currentExchangeRate).toLocaleString()}（估算）</p>`+buildDays().map(d=>`<section class="panel journal-day"><h3>${h(d.date.slice(5))} · ${h(dailyFeature(d).title)}</h3>${d.events.filter(e=>!e.inherited).map(e=>{const j=journal[e.id]||{},status=j.status||(localState.checks[e.id]?'went':'');if(status==='went')actual++;return `<div class="journal-comparison"><div><span class="small">原計畫 ${h(e.time)}</span><p>${h(e.title)}</p></div><div><span class="badge">${h({went:'去了',rescheduled:'改期',skipped:'沒去'}[status]||'尚未記錄')}</span>${j.text?`<p>${h(j.text)}</p>`:''}${j.photo?`<img class="journal-photo" src="${h(j.photo)}" alt="旅途紀錄照片">`:''}</div></div>`;}).join('')}<button class="btn" data-journal-day="${d.id}">補記這一天</button></section>`).join('');
 $('experience-status').textContent=`${actual} 站已留下足跡 · 可用原計畫對照實際路線。`;
}
function journalSave(){writeStore('tokyo_journal_v1',journal);}
// Unattested older coordinates must not replace researched points or enter distances.
function verifiedCoordinate(p){return Number.isFinite(p.lat)&&Number.isFinite(p.lng)&&Math.abs(p.lat)<=90&&Math.abs(p.lng)<=180&&/^https?:\/\//.test(p.coordinateSource?.url||'')&&safeUrl(p.coordinateSource.url)&&/^\d{4}-\d{2}-\d{2}$/.test(p.coordinateSource?.checked||'');}
function coordinateForNote(n){if(verifiedCoordinate(n))return n;const p=PLACES.find(p=>p.id===n.venueId&&verifiedCoordinate(p));return p?{...n,lat:p.lat,lng:p.lng,coordinateSource:p.coordinateSource}:null;}
function allGeoPoints(){const points=new Map(PLACES.filter(verifiedCoordinate).map(p=>[p.id,{...p,kind:'內建景點'}]));for(const n of MAP_NOTES){if(!n.closed&&verifiedCoordinate(n)&&!points.has(n.venueId||n.id))points.set(n.venueId||n.id,{...n,kind:'筆記點',name:n.name,food:[],keys:n.aliases||[],route:''});}return [...points.values()];}
nearbyPlaces=function(lat,lng){return allGeoPoints().map(p=>({...p,distance:haversineMeters(lat,lng,p.lat,p.lng)})).filter(p=>p.distance<MATCH_RADIUS_METERS).sort((a,b)=>a.distance-b.distance);};
const baseDetectNearby=detectNearby;
detectNearby=function(){
 if(gpsBusy)return;if(!navigator.geolocation)return toast('此裝置不支援定位。');
 gpsBusy=true;$('gps-button').disabled=true;$('gps-result').textContent='定位中…';
 navigator.geolocation.getCurrentPosition(p=>{gpsBusy=false;$('gps-button').disabled=false;if(p.coords.accuracy>500){$('gps-result').textContent='定位誤差超過500公尺，請到戶外再試。';return;}gpsPosition={lat:p.coords.latitude,lng:p.coords.longitude};const list=nearbyPlaces(gpsPosition.lat,gpsPosition.lng);$('gps-result').innerHTML=`<p>500公尺內 ${list.length} 筆 · 誤差約${Math.round(p.coords.accuracy)}公尺</p>`+list.map(n=>`<p>${ext(mapUrl(n.name),n.name+' ↗')} · ${Math.round(n.distance)}m（直線） · ${h(n.kind)}<br><span class="small">${ext(n.coordinateSource.url,'座標來源 ↗')} · ${h(n.coordinateSource.checked)}</span></p>`).join('')+'<p class="small">未核實座標不參與距離計算；座標是公開位置摘錄，並非入口或步行距離。</p>';notesLayer='nearby';renderMapNotes();},()=>{gpsBusy=false;$('gps-button').disabled=false;$('gps-result').textContent='定位未成功；今日筆記與日文名稱仍可使用。';},{enableHighAccuracy:true,timeout:12000,maximumAge:60000});
};
const baseMapNoteCard=mapNoteCard;
mapNoteCard=function(n,compact=false){return baseMapNoteCard(n,compact).replace('<details',`<p><span class="badge">${h(n.area||'待分類')}</span> <span class="badge badge-note">${n.verified?'地址已核對 '+h(n.checked||TRIP.map.checked):'地址未核對'}${n.mappedByNote?' · 請用店名導航':''}</span>${Number.isFinite(n.distance)?` · ${Math.round(n.distance)}m（直線）`:''}</p><div class="event-tools"><button class="btn btn-small" data-copy="${h(n.name)}">複製名稱</button>${ext(mapUrl(n.name),'以店名導航 ↗','btn btn-small')}</div><details`);};
mapNotesHtml=function(e){const notes=MAP_NOTES.filter(n=>!n.closed&&noteMatches(n,e));return notes.length?`<details class="event-map-notes"><summary>今日補充筆記</summary>${notes.map(n=>mapNoteCard(n,true)).join('')}</details>`:'';};
renderMapNotes=function(){
 const day=selectedDay(),q=noteKey($('map-notes-search').value),source=$('map-notes-source').value;
 let notes=MAP_NOTES.filter(n=>!n.closed&&(source==='all'||String(n.source)===source)&&(!q||noteKey(n.name+' '+n.note+' '+n.area).includes(q)));
 if(notesLayer==='today')notes=notes.filter(n=>day.events.some(e=>noteMatches(n,e))||(n.area!=='待分類'&&day.guide.area.split(/[・／→]/).some(a=>n.area.includes(a.trim()))));
 if(notesLayer==='nearby')notes=gpsPosition?notes.map(coordinateForNote).filter(Boolean).map(n=>({...n,distance:haversineMeters(gpsPosition.lat,gpsPosition.lng,n.lat,n.lng)})).filter(n=>n.distance<500).sort((a,b)=>a.distance-b.distance):[];
 $('map-notes-count').textContent=`${notesLayer==='today'?day.date.slice(5)+' 今日相關':notesLayer==='nearby'?'附近500公尺':'完整摘錄'} · ${notes.length} 筆`;
 $('map-notes-description').textContent=`兩份來源清單共${MAP_NOTE_SOURCES.reduce((n,s)=>n+s.count,0)}個地點；目前離線收錄${MAP_NOTES.length}筆文字摘錄，不代表已匯入全部地點或核對全部地址。核對標示見個別卡片。`;
 $('map-notes-sync').textContent=navigator.onLine?'顯示整合筆記':'離線 · 顯示已儲存筆記';
 document.querySelectorAll('[data-notes-layer]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.notesLayer===notesLayer)));
 const html=notes.length?notes.map(n=>mapNoteCard(n)).join(''):`<p class="empty">${notesLayer==='nearby'&&!gpsPosition?'請先按「偵測附近」取得位置。':'此範圍暫無筆記，可切換完整口袋名單。'}</p>`;
 $('map-notes-list').innerHTML=notesLayer==='all'?`<details><summary>展開完整摘錄（${notes.length}筆）</summary>${html}</details>`:html;
};
function foodContext(f){return f.restricted||f.closed?'避開':/咖啡/.test(f.kind)?'走累歇腳':f.backup?'排隊':'當地午餐';}
const baseFoodCard=foodCard;
foodCard=function(f){return baseFoodCard(f).replace('<h4>',`<span class="badge">${foodContext(f)}</span><h4>`);};
function renderFoodContexts(){
 const c=$('food-context').value;
 $('food-guide').querySelector('p').textContent='評分是有來源的摘錄，非即時 Places；各筆查閱日期見卡片。';
 const currentIds=new Set(TRIP.days.flatMap(d=>d.events.flatMap(e=>e.venueIds||[])));
 const venues=TRIP.venues.filter(v=>currentIds.has(v.id)&&v.category&&!v.closed&&(c==='all'||v.category===c));
 $('all-foods').innerHTML=venues.map(v=>`<details class="venue-details"><summary>${h(v.category)} · ${h(v.ja)}</summary>${venueCard(v)}</details>`).join('')+FOODS.filter(f=>!f.closed&&(c==='all'||foodContext(f)===c)).map(foodCard).join('');
}
// Real forecast window: never present October observations as December weather.
const FORECAST_CODES=new Set([0,1,2,3,45,48,51,53,55,56,57,61,63,65,66,67,71,73,75,77,80,81,82,85,86,95,96,97,99]);
const weatherInFlight=new Map(),weatherFailures=new Map();
if(!weatherCache||typeof weatherCache!=='object'||Array.isArray(weatherCache))weatherCache={};
function forecastInRange(date){
 const today=todayJapan(),end=new Date(today+'T00:00:00Z');end.setUTCDate(end.getUTCDate()+6);
 return typeof date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(date)&&date>=today&&date<=end.toISOString().slice(0,10);
}
function validForecastRow(row){return row&&forecastInRange(row.date)&&[row.min,row.max,row.code,row.rain].every(Number.isFinite)&&row.min<=row.max&&row.min>=-90&&row.max<=70&&row.rain>=0&&row.rain<=100&&FORECAST_CODES.has(row.code);}
function forecastForDay(city,date){
 const cache=weatherCache[city],updated=Date.parse(cache?.updatedAt);
 const row=Number.isFinite(updated)&&updated<=Date.now()+300000&&Array.isArray(cache?.daily)?cache.daily.find(x=>x?.date===date&&validForecastRow(x)):null;
 const stale=!!row&&Date.now()-updated>86400000;
 const status=!row?'尚無預報':stale?'上次預報 · 已過期':!navigator.onLine?'離線快取預報':weatherFailures.has(city)?'更新失敗 · 上次預報':'7日預報';
 return {row,cache,stale,status};
}
function forecastCityForDay(day){return /小田原/.test(day.guide.area)?'odawara':day.number<=6?'fujisawa':'tokyo';}
function requestDayForecast(day){
 const city=forecastCityForDay(day),updated=Date.parse(weatherCache[city]?.updatedAt);
 if(!navigator.onLine||!forecastInRange(day.date)||weatherInFlight.has(city)||Date.now()-(weatherFailures.get(city)||0)<120000)return;
 if(Number.isFinite(updated)&&updated<=Date.now()+300000&&Date.now()-updated<1800000)return;
 fetchWeather(city);
}
renderWeather=function(){
 const city=WEATHER[weatherCity],date=selectedDay().date,{row,cache,status}=forecastForDay(weatherCity,date);
 $('weather-temp').textContent=row?`${row.min}–${row.max}°C`:'—';$('weather-condition').textContent=row?`${weatherCode(row.code)[1]} · 降水機率${row.rain}%`:`${date.slice(5)} 尚無可用預報`;
 $('weather-mode').textContent=status;
 $('weather-tip').textContent=row?(row.min<8?'保暖內層＋防風外套；早晚加圍巾。':'多層穿搭＋防風外套。')+(row.rain>=40?' 帶折傘與防水鞋。':''):city.tip;
 $('weather-status').textContent=row?`${city.name} · 取得 ${formatTimestamp(cache.updatedAt)} · Open-Meteo，非即時保證`:(weatherFailures.has(weatherCity)?'更新失敗，保留上次資料。':'')+'只查詢未來7日；旅行日期超出範圍時不顯示溫度。';
 $('weather-live').disabled=weatherInFlight.has(weatherCity);
 document.querySelectorAll('[data-weather]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.weather===weatherCity)));
 document.dispatchEvent(new CustomEvent('tokyo-weather-change'));
};
fetchWeather=async function(requestedCity=weatherCity){
 if(!navigator.onLine){renderWeather();return;}
 const city=Object.hasOwn(WEATHER,requestedCity)?requestedCity:weatherCity,d=WEATHER[city];
 if(weatherInFlight.has(city))return weatherInFlight.get(city);
 const task=(async()=>{
  try{
   const r=await fetchWithTimeout(`https://api.open-meteo.com/v1/forecast?latitude=${d.lat}&longitude=${d.lng}&daily=temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max&forecast_days=7&timezone=Asia%2FTokyo`,{},10000);if(!r.ok)throw new Error();
   const data=await r.json(),raw=data.daily,keys=['temperature_2m_min','temperature_2m_max','weather_code','precipitation_probability_max'];
   if(!Array.isArray(raw?.time)||raw.time.length!==7||keys.some(k=>!Array.isArray(raw[k])||raw[k].length!==raw.time.length)||new Set(raw.time).size!==7)throw new Error('Incomplete forecast');
   const daily=raw.time.map((date,i)=>({date,min:raw.temperature_2m_min[i],max:raw.temperature_2m_max[i],code:raw.weather_code[i],rain:raw.precipitation_probability_max[i]}));
   if(!daily.every(validForecastRow))throw new Error('Invalid forecast');
   weatherCache[city]={daily,updatedAt:new Date().toISOString()};weatherFailures.delete(city);writeStore('tokyo_weather_v2',weatherCache);
  }catch{weatherFailures.set(city,Date.now());}
  finally{weatherInFlight.delete(city);renderWeather();}
 })();
 weatherInFlight.set(city,task);$('weather-live').disabled=weatherInFlight.has(weatherCity);return task;
};
async function updateExchangeRate(){
 const saved=readStore('tokyo_exchange_v1',{});$('expense-rate').value=currentExchangeRate;
 const show=()=>{$('exchange-status').textContent=saved.updatedAt?` · 更新${formatTimestamp(saved.updatedAt)}，公開中間價估算`:' · 未連線更新：手動估值0.215';};show();
 if(!navigator.onLine||saved.updatedAt&&Date.now()-Date.parse(saved.updatedAt)<86400000)return;
 try{const r=await fetchWithTimeout('https://open.er-api.com/v6/latest/JPY',{},10000);if(!r.ok)throw new Error();const data=await r.json(),rate=data.rates?.TWD;if(data.result!=='success'||!Number.isFinite(rate)||rate<=0)throw new Error();currentExchangeRate=rate;saved.rate=rate;saved.updatedAt=new Date().toISOString();writeStore('tokyo_exchange_v1',saved);$('expense-rate').value=rate.toFixed(4);show();renderExpenses();}catch{$('exchange-status').textContent=' · 更新失敗，保留估算值；非銀行賣出匯率';}
}
async function copyText(text){try{await navigator.clipboard.writeText(text);toast('已複製，可直接貼給家人或櫃台。');}catch{const dialog=document.createElement('dialog');dialog.innerHTML='<h2>選取後複製</h2><textarea aria-label="複製內容"></textarea><button class="btn">關閉</button>';dialog.querySelector('textarea').value=text;document.body.append(dialog);dialog.querySelector('button').onclick=()=>dialog.remove();dialog.showModal();dialog.querySelector('textarea').select();}}
function familyLink(){const url=new URL(location.pathname,location.origin);url.searchParams.set('day',selectedDay().date.slice(5));url.searchParams.set('mode','family');return url.href;}
async function shareDay(){const url=familyLink();if(navigator.share){try{await navigator.share({title:selectedDay().date.slice(5)+' 東京冬日紀行',url});return;}catch(e){if(e.name==='AbortError')return;}}await copyText(url);}
// Full backups include photos and private notes; compact codes explicitly exclude them.
exportBackup=function(){const data={format:'tokyo-trip-backup',version:4,exportedAt:new Date().toISOString(),state:localState,expenses,buyChecks:getBuyCheckedMap(),journal,decisions:decisionState,privateNotes,exchange:currentExchangeRate,...(typeof getPicturebookState==='function'?{picturebook:getPicturebookState()}:{})};const url=URL.createObjectURL(new Blob([JSON.stringify(data)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='tokyo-trip-private-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
function sanitizeJournal(raw){const out={};if(!raw||typeof raw!=='object')return out;for(const[id,j]of Object.entries(raw).slice(0,1000)){if(!/^[\w-]{1,180}$/.test(id)||!j||!['','went','rescheduled','skipped'].includes(j.status||''))continue;const photo=typeof j.photo==='string'&&/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(j.photo)&&j.photo.length<500000?j.photo:'';out[id]={status:j.status||'',text:String(j.text||'').slice(0,300),photo};}return out;}
function mergeBackup(b){
 if(b?.format!=='tokyo-trip-backup'||![3,4].includes(b.version)||!b.state)throw new Error('格式不符');
 const state=sanitizeState(b.state),custom=new Map(localState.custom.map(e=>[e.id,e]));state.custom.forEach(e=>custom.set(e.id,e));localState={...localState,custom:[...custom.values()],overrides:{...localState.overrides,...state.overrides},checks:{...localState.checks,...state.checks}};saveState();
 if(b.version===4){if(Array.isArray(b.expenses)){const all=new Map(expenses.map(e=>[String(e.id),e]));b.expenses.filter(e=>e&&Number.isFinite(e.cost)&&e.cost>0&&e.cost<=99999999&&typeof e.item==='string').slice(0,2000).forEach(e=>all.set(String(e.id),{id:e.id,item:e.item.slice(0,300),cost:e.cost,date:String(e.date||'').slice(0,60)}));expenses=[...all.values()];writeStore('trip_acc_2026',expenses);}if(b.buyChecks&&typeof b.buyChecks==='object'){const checks=getBuyCheckedMap();for(const[k,v]of Object.entries(b.buyChecks).slice(0,2000))if(v===true&&k.length<1000)checks[k]=true;saveBuyCheckedMap(checks);}journal={...journal,...sanitizeJournal(b.journal)};journalSave();if(b.decisions&&typeof b.decisions==='object')for(const item of TRIP.decisions)if(b.decisions[item.id]===true)decisionState[item.id]=true;writeStore('tokyo_decisions_v1',decisionState);if(typeof b.privateNotes==='string'){privateNotes=b.privateNotes.slice(0,12000);writeStore('tokyo_private_v1',privateNotes);if($('private-notes'))$('private-notes').value=privateNotes;}}
 if(b.version===4&&Number.isFinite(b.exchange)&&b.exchange>0&&b.exchange<=100){currentExchangeRate=b.exchange;writeStore('tokyo_exchange_v1',{rate:currentExchangeRate,updatedAt:null});$('expense-rate').value=currentExchangeRate;$('exchange-status').textContent=' · 備份中的估算匯率，非銀行賣出匯率';}
 if(b.version===4&&typeof mergePicturebookState==='function')mergePicturebookState(b.picturebook);
 renderApp();renderExpenses();shoppingLoaded=false;
}
importBackup=async function(event){const file=event.target.files?.[0];if(!file)return;try{if(file.size>12000000)throw new Error('檔案超過12MB');mergeBackup(JSON.parse(await file.text()));toast('已合併備份；原有其他紀錄保留。');}catch(e){toast('無法匯入：'+e.message);}finally{event.target.value='';}};
async function encodeState(){const data={format:'tokyo-trip-backup',version:4,state:{checks:localState.checks,custom:[],overrides:{}},expenses,buyChecks:getBuyCheckedMap(),journal:Object.fromEntries(Object.entries(journal).map(([id,j])=>[id,{status:j.status,text:j.text}])),decisions:decisionState,...(typeof getPicturebookState==='function'?{picturebook:getPicturebookState()}:{})};const bytes=new TextEncoder().encode(JSON.stringify(data));if(!window.CompressionStream)throw new Error('此瀏覽器請使用下載備份');const compressed=await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer();const code='TT4.'+btoa(String.fromCharCode(...new Uint8Array(compressed)));if(code.length>100000)throw new Error('紀錄太多，請改用下載備份');$('backup-code').value=code;await copyText(code);}
async function decodeState(){const code=$('backup-code').value.trim();if(!code.startsWith('TT4.')||code.length>100000||!window.DecompressionStream)throw new Error('備份碼格式或瀏覽器不支援');const data=Uint8Array.from(atob(code.slice(4)),c=>c.charCodeAt(0));const reader=new Blob([data]).stream().pipeThrough(new DecompressionStream('gzip')).getReader();let chunks=[],size=0;while(true){const{value,done}=await reader.read();if(done)break;size+=value.length;if(size>2000000){await reader.cancel();throw new Error('解壓資料過大');}chunks.push(value);}mergeBackup(JSON.parse(await new Blob(chunks).text()));toast('狀態已匯入這台裝置。');}
async function attachPhoto(file,id){if(!file||!file.type.startsWith('image/')||file.size>15000000)return toast('請選擇15MB以下的圖片。');try{const bitmap=await createImageBitmap(file),scale=Math.min(1,960/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement('canvas');canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();const photo=canvas.toDataURL('image/jpeg',.65);if(photo.length>500000)return toast('圖片仍較大，請選擇較小圖片。');journal[id]={...journal[id],photo};journalSave();renderApp();}catch{toast('此圖片格式無法讀取，請改用JPEG或PNG。');}}
// Offline registration and an explicit, reviewable full-cache action.
let swReady=null;
if('serviceWorker'in navigator){swReady=navigator.serviceWorker.register('sw.js',{scope:'./'}).then(()=>navigator.serviceWorker.ready);swReady.then(()=>{$('offline-status').textContent=navigator.onLine?'基本手冊已就緒；按鈕儲存全部封面':'離線使用已儲存手冊';}).catch(()=>{$('offline-status').textContent='離線安裝失敗，請連網再試。';});navigator.serviceWorker.addEventListener('message',e=>{if(e.data.type==='CACHE_DONE'){$('offline-status').textContent=e.data.failed?'部分圖片未存妥，請連網重試；文字手冊仍可用':'完整離線手冊已儲存（含14日封面與筆記）';$('offline-save').disabled=false;}if(e.data.type==='CACHE_PROGRESS')$('offline-status').textContent=`離線儲存 ${e.data.done}/${e.data.total}…`;});}
$('offline-save').addEventListener('click',async()=>{if(!swReady)return toast('此瀏覽器不支援離線安裝。');if(!navigator.onLine)return toast('儲存完整封面需要連網；文字手冊可離線使用。');$('offline-save').disabled=true;try{const reg=await swReady;reg.active.postMessage({type:'CACHE_ALL'});}catch{$('offline-save').disabled=false;toast('離線儲存失敗，請再試。');}});
$('share-day').addEventListener('click',shareDay);
$('food-context').addEventListener('change',renderFoodContexts);
document.addEventListener('click',async event=>{
 const b=event.target.closest('button,a');if(!b)return;
 if(b.dataset.copy){copyText(b.dataset.copy);return;}
 if(b.dataset.mode&&!familyMode){viewMode=b.dataset.mode;filter='all';if(viewMode==='today'){activeDay=(parsed.days.find(d=>d.date===todayJapan())||selectedDay()).id;}renderApp();return;}
 if(b.dataset.notesLayer){notesLayer=b.dataset.notesLayer;renderMapNotes();return;}
 if(b.dataset.journalDay){viewMode='today';jumpToDay(b.dataset.journalDay);return;}
 if(b.dataset.photoRemove){delete journal[b.dataset.photoRemove]?.photo;journalSave();renderApp();return;}
 if(b.id==='state-code'){try{await encodeState();}catch(e){toast(e.message);}return;}
 if(b.id==='import-code'){try{await decodeState();}catch(e){toast('無法匯入：'+e.message);}return;}
 if(b.id==='archive-open'){event.preventDefault();const el=$('archive');el.hidden=!el.hidden;if(!el.hidden&&!el.dataset.loaded){try{const r=await fetch('archive.json');if(!r.ok)throw new Error();const data=await r.json();LEGACY=data.legacy;el.innerHTML='<h3>封存資料（不作為現行路線）</h3>'+parsed.days.map(legacyHtml).join('');el.dataset.loaded='true';}catch{el.textContent='封存資料未能載入。';}}}
});
// Capture mutations for family mode even if triggered programmatically through a UI click.
document.addEventListener('click',e=>{if(familyMode&&e.target.closest('[data-check],[data-edit],[data-add-day],[data-geo-check],#add-button,#export-button,#import-code,#state-code')){e.preventDefault();e.stopImmediatePropagation();}},true);
document.addEventListener('change',e=>{const t=e.target;if(familyMode)return;
 if(t.id==='day-picker'){pinnedDate=true;jumpToDay(t.value);return;}
 if(t.dataset.decision){decisionState[t.dataset.decision]=t.checked;writeStore('tokyo_decisions_v1',decisionState);renderDecisions();renderOverview();}
 if(t.dataset.journalStatus){const id=t.dataset.journalStatus;journal[id]={...journal[id],status:t.value};if(t.value==='went')localState.checks[id]=new Date().toISOString();else delete localState.checks[id];saveState();journalSave();renderApp();}
 if(t.dataset.journalText){journal[t.dataset.journalText]={...journal[t.dataset.journalText],text:t.value.slice(0,300)};journalSave();}
 if(t.dataset.journalPhoto)attachPhoto(t.files?.[0],t.dataset.journalPhoto);
 if(t.id==='private-notes'){privateNotes=t.value;writeStore('tokyo_private_v1',privateNotes);}
 if(t.id==='expense-rate')writeStore('tokyo_exchange_v1',{rate:currentExchangeRate,updatedAt:null});
});
const originalClock=refreshClock;
refreshClock=function(){const today=todayJapan();if(!pinnedDate&&viewMode==='today'){const d=parsed.days.find(x=>x.date===today);if(d&&d.id!==activeDay){activeDay=d.id;renderApp();}}originalClock();$('experience-clock').textContent='日本時間 '+$('japan-clock').textContent;renderWeather();};
// A manually chosen date stays selected until the user requests Japan today.
document.addEventListener('click',e=>{if(e.target.closest('[data-day-jump],[data-theme-jump]'))pinnedDate=true;if(e.target.closest('#now-button')){pinnedDate=false;viewMode='today';}} ,true);
window.addEventListener('online',()=>{renderExperience();fetchWeather();updateExchangeRate();});window.addEventListener('offline',()=>{renderExperience();renderMapNotes();});
migrateOldCustom();
setReading(safeStorage.getItem('tokyo_reading_size_v1')||'large');
updateNavigationMetrics();
initializeExperience();
renderApp();



renderWeather();
renderExpenses();
refreshClock();
setInterval(refreshClock,60000);
if(navigator.onLine){fetchWeather();updateExchangeRate();}
$('expense-rate').addEventListener('input',e=>{const rate=Number(e.target.value);if(Number.isFinite(rate)&&rate>0&&rate<=100){currentExchangeRate=rate;renderExpenses();}});
document.addEventListener('click',e=>{const b=e.target.closest('[data-expense-remove]');if(b){expenses=expenses.filter(x=>String(x.id)!==b.dataset.expenseRemove);writeStore('trip_acc_2026',expenses);renderExpenses();}});
document.addEventListener('change',e=>{if(e.target.matches('[data-buy-id]'))toggleBuyGalleryChecked(e.target.dataset.buyId,e.target);});
// Expose only pure calculation helpers for reproducible regression checks.
window.TokyoTrip={parseCSV,parseGrid,haversineMeters,nearbyPlaces,ratingEligible,normalizeTime};
