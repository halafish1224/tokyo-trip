
'use strict';
// Source readings: 2026-09-29. Ratings are explicit Google-score excerpts,
// not live Google Places responses. Never substitute Tabelog/Tripadvisor scores.
const SOURCES = TRIP.sources;
const DAY_GUIDES = TRIP.days.map(d=>d.guide);
// Approximate landmark centroids for on-device Haversine checks (metres).
const PLACES = TRIP.places;
const FOODS = TRIP.foods;

const $ = id => document.getElementById(id);
const h = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const plain = value => new DOMParser().parseFromString(String(value ?? '').replace(/<br\s*\/?\s*>/gi,'\n'),'text/html').body.textContent || '';
const toText = value => String(value ?? '').trim();
const safeUrl = value => {try{const u=new URL(value,location.href);return /^https?:$/.test(u.protocol)?u.href:'';}catch{return '';}};
const mapUrl = query => 'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(query);
const directionsUrl = (destination,origin='',mode='transit') => 'https://www.google.com/maps/dir/?api=1&destination='+encodeURIComponent(destination)+(origin?'&origin='+encodeURIComponent(origin):'')+'&travelmode='+mode;
const ext = (url,label,cls='') => {const safe=safeUrl(url);return safe?`<a href="${h(safe)}" target="_blank" rel="noopener noreferrer" class="${h(cls)}">${h(label)}</a>`:h(label);};

// Linkify plain URLs / Markdown links without trusting source HTML.
function richText(value) {
 const text=String(value??''),pattern=/\[([^\]\n]{1,200})\]\((https?:\/\/[^\s<>"']+)\)|(https?:\/\/[^\s<>"'，。！？；：、（）「」『』【】]+|www\.[^\s<>"'，。！？；：、（）「」『』【】]+)/g;
 let result='',cursor=0;
 for(const match of text.matchAll(pattern)) {
  result+=h(text.slice(cursor,match.index));
  if(match[1]) result+=ext(match[2],match[1]);
  else {
   const original=match[0];let url=original.replace(/[.,;:!?\]}]+$/g,'');
   while(url.endsWith(')')&&(url.match(/\)/g)||[]).length>(url.match(/\(/g)||[]).length)url=url.slice(0,-1);
   result+=ext(url.startsWith('www.')?'https://'+url:url,url)+h(original.slice(url.length));
  }
  cursor=match.index+match[0].length;
 }
 return result+h(text.slice(cursor));
}
function dateStampHtml(date) {
 const instant=new Date(date+'T12:00:00+09:00');
 if(!Number.isFinite(instant.getTime()))return h(date);
 const en=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Tokyo',weekday:'short'}).format(instant);
 const ja=new Intl.DateTimeFormat('ja-JP',{timeZone:'Asia/Tokyo',weekday:'long'}).format(instant);
 return `<span class="date-stamp"><time datetime="${h(date)}">${h(date.slice(5).replace('-','/'))}</time><span class="date-weekday"><span lang="en">${h(en)}</span><span aria-hidden="true">／</span><span lang="ja">${h(ja)}</span></span></span>`;
}

let storageAvailable = true;
function storageWarning(){storageAvailable=false;$('storage-warning').hidden=false;$('storage-warning').textContent='此瀏覽器目前無法儲存資料。本次修改仍可使用，關閉前請下載本機行程備份。';}
const safeStorage={getItem(key){try{return window.localStorage.getItem(key);}catch{storageWarning();return null;}},setItem(key,value){try{window.localStorage.setItem(key,value);return true;}catch{storageWarning();return false;}}};
function readStore(key,fallback){try{const text=safeStorage.getItem(key);return text?JSON.parse(text):fallback;}catch{return fallback;}}
function writeStore(key,value){return safeStorage.setItem(key,JSON.stringify(value));}
const BASE_GRID=[];
let LEGACY=[];
let MAP_BUNDLE=TRIP.map,TRAVEL_BUNDLE=TRIP.travel;
let MAP_NOTES=MAP_BUNDLE.notes,MAP_NOTE_SOURCES=MAP_BUNDLE.sources;

const EXPECTED_DATES=Array.from({length:14},(_,i)=>`2026-12-${String(i+13).padStart(2,'0')}`);

const STATE_KEY='tokyo_trip_spa_v3';
const CACHE_KEY='tokyo_trip_grid_cache_v3';
const MATCH_RADIUS_METERS=500;
const isTime=t=>/^([01]\d|2[0-3]):[0-5]\d$/.test(t);
const timeMinutes=t=>isTime(t)?Number(t.slice(0,2))*60+Number(t.slice(3)):1440;
function normalizeTime(value){const m=toText(value).match(/^(\d{1,2}):(\d{2})/);if(m){const t=m[1].padStart(2,'0')+':'+m[2];return isTime(t)?t:'';}const n=Number(value);if(value!==''&&Number.isFinite(n)&&n>=0&&n<1){const min=Math.round(n*1440);return `${Math.floor(min/60).toString().padStart(2,'0')}:${(min%60).toString().padStart(2,'0')}`;}return '';}
// RFC 4180 CSV: handles quoted commas, CRLF, escaped quotes and multiline cells.
function parseCSV(text){
 if(typeof text!=='string'||text.length>2000000)throw new Error('CSV 資料過大或不是文字');
 const rows=[];let row=[],cell='',quoted=false;
 const s=text.replace(/^\uFEFF/,'');
 for(let i=0;i<s.length;i++){const ch=s[i];if(ch==='"'){if(quoted&&s[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(ch===','&&!quoted){row.push(cell);cell='';}else if((ch==='\n'||ch==='\r')&&!quoted){row.push(cell);rows.push(row);row=[];cell='';if(ch==='\r'&&s[i+1]==='\n')i++;}else cell+=ch;}
 if(quoted)throw new Error('CSV 引號不完整');
 if(cell.length||row.length){row.push(cell);rows.push(row);}
 return rows.filter(r=>r.some(c=>toText(c)));
}
function cleanSourceTitle(raw){return raw.replace(/^\d{1,2}:\d{2}\s*/,'').replace(/★\s*[0-5](?:\.\d+)?\s*/g,'').trim();}
function sourceDate(header){const m=header.match(/(\d{1,2})\/(\d{1,2})/);return m?`2026-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}`:'';}
function parseGrid(rows){
 if(!Array.isArray(rows)||rows.length<2||rows.length>101)throw new Error('行程表格式不符');
 const head=rows.findIndex(r=>Array.isArray(r)&&r.slice(1).filter(x=>/12\/\d+/.test(toText(x))).length===14);
 if(head<0)throw new Error('找不到完整 14 天日期欄');
 const headers=rows[head];const dates=headers.slice(1,15).map(x=>sourceDate(toText(x)));
 if(dates.some((d,i)=>d!==EXPECTED_DATES[i]))throw new Error('日期不符：需保留 2026/12/13–12/26 全部 14 天');
 const days=dates.map((date,i)=>({id:'d'+(i+1),date,number:i+1,header:toText(headers[i+1]),events:[],guide:DAY_GUIDES[i]}));
 let count=0;
 for(let r=head+1;r<rows.length;r++){
  if(!Array.isArray(rows[r]))throw new Error('行程列格式不符');
  const row=rows[r],slot=normalizeTime(row[0]);let lodging='';
  for(let c=1;c<=14;c++){
   const raw=toText(row[c]);if(raw.length>12000)throw new Error('單格文字過長');
   // Only the known merged hotel row is forward-filled; empty itinerary cells stay empty.
   if(slot==='22:00'&&c===7)lodging='';
   if(slot==='22:00'&&c===14)lodging='';
   if(slot==='22:00'&&raw.startsWith('東橫INN'))lodging=raw;
   const inherited=slot==='22:00'&&!raw&&lodging&&c<14;
   if(!raw&&!inherited)continue;
   const text=raw||lodging;if(raw)count++;
   const explicit=normalizeTime(text),time=explicit||slot;
   const event={id:`sheet-${dates[c-1]}-r${r+1}`,time,title:cleanSourceTitle(text),note:'',map:'',raw:text,cell:String.fromCharCode(65+c)+(r+1),inherited:!!inherited,slot,explicit:!!explicit,origin:'sheet'};
   days[c-1].events.push(event);
  }
 }
 if(count===0||days.some(d=>d.events.length===0))throw new Error('部分日期沒有行程，未覆蓋現有資料');
 for(const day of days)day.events.sort((a,b)=>timeMinutes(a.time)-timeMinutes(b.time));
 return {days,count,rows};
}
function validCustom(e){return e&&typeof e==='object'&&typeof e.id==='string'&&e.id.length<150&&EXPECTED_DATES.includes(e.date)&&isTime(e.time)&&typeof e.title==='string'&&e.title.trim().length>0&&e.title.length<=300&&typeof (e.note??'')==='string'&&(e.note??'').length<=4000&&typeof(e.map??'')==='string'&&(e.map??'').length<=300;}
function sanitizeState(raw){
 const result={version:3,custom:[],overrides:{},checks:{},migrated:false};
 if(!raw||typeof raw!=='object')return result;
 if(Array.isArray(raw.custom))result.custom=raw.custom.filter(validCustom).slice(0,1000).map(e=>({id:e.id,date:e.date,time:e.time,title:e.title,note:e.note||'',map:e.map||'',origin:'custom'}));
 if(raw.overrides&&typeof raw.overrides==='object')for(const [id,v] of Object.entries(raw.overrides)){
  if(/^sheet-2026-12-(?:1[3-9]|2[0-6])-r\d+$/.test(id)&&v&&isTime(v.time)&&typeof v.title==='string'&&v.title.trim()&&v.title.length<=300&&typeof(v.note??'')==='string'&&(v.note??'').length<=4000&&typeof(v.map??'')==='string'&&(v.map??'').length<=300){result.overrides[id]={time:v.time,title:v.title,note:v.note||'',map:v.map||'',sourceRaw:String(v.sourceRaw||'').slice(0,12000),date:EXPECTED_DATES.includes(v.date)?v.date:id.slice(6,16)};}
 }
 if(raw.checks&&typeof raw.checks==='object')for(const [k,v]of Object.entries(raw.checks)){if(/^[\w-]{1,180}$/.test(k)&&typeof v==='string'&&v.length<=60)result.checks[k]=v;}
 result.migrated=raw.migrated===true;return result;
}
let localState=sanitizeState(readStore(STATE_KEY,null));
function migrateOldCustom(){if(localState.migrated)return;const old=readStore('tokyo_custom_events_2026',[]);if(Array.isArray(old))for(const d of old){if(!EXPECTED_DATES.includes(d.fullDate)||!Array.isArray(d.events))continue;d.events.forEach((e,i)=>{if(!e.isCustom)return;const item={id:`legacy-custom-${d.fullDate}-${i}`,date:d.fullDate,time:normalizeTime(e.time),title:plain(e.title).slice(0,300),note:plain(e.desc).slice(0,4000),map:toText(e.map).slice(0,300),origin:'custom'};if(validCustom(item)&&!localState.custom.some(x=>x.id===item.id))localState.custom.push(item);});}localState.migrated=true;writeStore(STATE_KEY,localState);}
let activeGrid=[],parsed={days:TRIP.days,count:TRIP.days.reduce((n,d)=>n+d.events.length,0)},activeDay='d1',filter='all',search='',allExpanded=false;
let sourceLabel='整合行程 · '+TRIP.updatedAt;
function formatTimestamp(value){const d=new Date(value);return Number.isFinite(d.getTime())?new Intl.DateTimeFormat('zh-TW',{timeZone:'Asia/Tokyo',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}).format(d)+' 日本時間':'時間未記錄';}
function todayJapan(){const p=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const v=t=>p.find(x=>x.type===t).value;return `${v('year')}-${v('month')}-${v('day')}`;}
function japanMinutes(){const p=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Tokyo',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date());return Number(p.find(x=>x.type==='hour').value)*60+Number(p.find(x=>x.type==='minute').value);}
function buildDays(){return parsed.days.map(d=>{
 const ids=new Set(d.events.map(e=>e.id));
 const events=d.events.map(e=>{const o=localState.overrides[e.id];return o?{...e,...o,raw:e.raw,edited:true,conflict:o.sourceRaw!==e.raw}: {...e};});
 // Retain local edits even when the corresponding cloud cell disappears.
 for(const [id,o]of Object.entries(localState.overrides))if(o.date===d.date&&!ids.has(id))events.push({...o,id,origin:'sheet',raw:o.sourceRaw,edited:true,conflict:true,orphan:true});
 events.push(...localState.custom.filter(e=>e.date===d.date));events.sort((a,b)=>timeMinutes(a.time)-timeMinutes(b.time));
 return {...d,events};
});}
function saveState(){writeStore(STATE_KEY,localState);}
function getPlaces(event){return PLACES.filter(p=>p.keys.some(k=>event.title.toLowerCase().includes(k.toLowerCase())));}
function queryFor(event){
 if(event.navigation&&!event.edited&&event.origin!=='custom')return event.navigation;
 if(event.map)return event.map;
 if(/35°39/.test(event.title))return '35.6575,139.658694';
 if(/成田.*>/.test(event.title)&&/藤澤/.test(event.title))return '東横INN湘南鎌倉藤沢駅北口';
 if(/成田.*>/.test(event.title))return '東横INN東京駅新大橋前';
 if(/>成田|成田 Terminal|京成 Access|班機起飛/.test(event.title))return '成田空港第2ターミナル';
 if(/東橫INN藤澤/.test(event.title))return '東横INN湘南鎌倉藤沢駅北口';
 if(/東橫INN東京/.test(event.title))return '東横INN東京駅新大橋前';
 if(/OS\s*DRUG|OS Drug/i.test(event.title)){const area=event.title.match(/(大船|銀座|上野|淺草|下北澤)/)?.[1]||'';return 'OS DRUG '+area.replace('淺草','浅草');}
 if(/経堂|經堂/.test(event.title))return '叙々苑 経堂コルティ店';
 if(/敘敘苑.*晴空塔/.test(event.title))return '叙々苑 東京スカイツリータウン・ソラマチ店';
 if(/35°/.test(event.title))return '35.6575,139.658694';
 const place=getPlaces(event)[0];return place?`${place.lat},${place.lng}`:event.title.replace(/\([^)]*\)/g,'').replace(/^[^:]*交通規劃:/,'').slice(0,250)+' 日本';
}
function ratingEligible(food){return food.provider==='Google'&&Number.isFinite(food.rating)&&food.rating>=3.5&&food.rating<=4.0&&!!safeUrl(food.source)&&!food.closed;}
const noteKey=value=>String(value||'').normalize('NFKC').toLowerCase().replace(/\s+/g,'');
function noteMatches(note,event){if(note.ambiguous)return false;const title=noteKey(event.title);return [note.name,...note.aliases].some(alias=>title.includes(noteKey(alias)));}
function mapNoteCard(note,compact=false){const source=MAP_NOTE_SOURCES[note.source];return `<article class="map-note-card" data-map-note="${h(note.id)}"><details${note.note.length<160?' open':''}><summary>${h(note.name)}${note.mappedByNote?' <span class="badge badge-note">依備註辨識</span>':''}</summary><p class="map-note-original">${richText(note.note)}</p></details>${note.context?`<p class="small muted">標記說明：${h(note.context)}</p>`:''}${!note.ambiguous&&!note.mappedByNote?`<div class="source-links">${ext(mapUrl(note.name),'景點地圖 ↗')}</div>`:''}<details class="note-source"><summary>筆記來源</summary><p class="map-note-credit">${h(source.name)} · ${h(source.checked||MAP_BUNDLE.checked)}</p>${ext(source.url,'開啟地圖清單 ↗')}</details>${compact?'':'<div class="map-note-matches">'+mapNoteMatchesHtml(note)+'</div>'}</article>`;}
function mapNoteMatchesHtml(note){const matches=[];for(const day of buildDays()){const event=day.events.find(e=>noteMatches(note,e));if(event)matches.push(`<button type="button" class="btn btn-small btn-quiet" data-theme-jump="${day.id}" data-event-id="${h(event.id)}">${h(day.date.slice(5).replace('-','/'))} 查看行程</button>`);}return matches.length?matches.join(''):`<span class="small muted">${note.ambiguous?'分店待核對，未自動配對':'口袋名單'}</span>`;}
function mapNotesHtml(event){const notes=MAP_NOTES.filter(n=>noteMatches(n,event));return notes.length?`<details class="event-map-notes"><summary>補充筆記</summary>${notes.map(n=>mapNoteCard(n,true)).join('')}</details>`:'';}
function renderMapNotes(){const q=noteKey($('map-notes-search').value),source=$('map-notes-source').value;const notes=MAP_NOTES.filter(n=>(source==='all'||String(n.source)===source)&&(!q||noteKey(n.name+' '+n.note+' '+(n.context||'')).includes(q)));$('map-notes-count').textContent=`顯示 ${notes.length} / ${MAP_NOTES.length} 筆備註`;$('map-notes-description').textContent=`${MAP_BUNDLE.checked} 最近檢查 · ${MAP_NOTE_SOURCES.map(x=>x.name+' '+x.count+' 筆地點').join('；')}。夜間整理地圖內容，再由同步按鈕讀取最新版；無法讀取時保留前次筆記。`;$('map-notes-list').innerHTML=notes.length?notes.map(n=>mapNoteCard(n)).join(''):'<p class="empty">沒有符合的筆記，請調整關鍵字或清單。</p>';}
function foodCard(food){return `<article class="food-card"><h4>${h(food.name)}</h4><span class="badge badge-score" aria-label="Google 評分摘錄 ${food.rating} 星">★ ${food.rating.toFixed(1)} · Google 摘錄</span> <span class="badge${food.backup||food.restricted?' badge-note':''}">${h(food.kind)}</span><p>${richText(food.note)}</p><details class="food-proof"><summary>評分資料</summary><p>查閱 ${h(food.checked)} · ${h(food.sourceName)}<br>非即時評分；排隊與營業依現場。</p>${ext(food.source,'評分來源 ↗')}</details><div class="food-links">${ext(mapUrl(food.query),'餐廳地圖 ↗')}</div></article>`;}
function foodSection(day){const foodIds=new Set(day.events.flatMap(e=>getPlaces(e).flatMap(p=>p.food)));const foods=FOODS.filter(f=>ratingEligible(f)&&foodIds.has(f.id));return foods.length?`<section class="food-section"><h3>這一帶，吃點什麼？</h3><div class="food-grid">${foods.map(foodCard).join('')}</div></section>`:'';}
function legacyHtml(day){const old=LEGACY.find(d=>d.id===day.id);if(!old)return '';return `<details class="old-notes"><summary>舊版封存・${old.events.length} 筆（非目前行程）</summary><p class="small muted">僅保留舊景點索引，已不作為本日動線。請以上方 Sheet 行程為準。</p><ul>${old.events.map(e=>`<li>${richText(e.title)} ${e.map?ext(mapUrl(e.map),'舊地圖 ↗'):''}</li>`).join('')}</ul><details><summary>舊版交通參考</summary><p>${h(day.guide.route)}</p><p>${h(day.guide.note)}</p></details></details>`;}
function eventHtml(e,day){
 const places=getPlaces(e),checked=!familyMode&&!!localState.checks[e.id];
 const map=queryFor(e);
 const isSplit=/分流A/.test(e.title)&&/分流B/.test(e.title);
 const coord=/35°39/.test(e.title);
 const warnings=(e.edited?[]:e.alerts||[]).map(a=>a.text);
 const mentioned=(e.raw||'').match(/^12\/(\d{1,2})\s/);if(mentioned&&Number(mentioned[1])!==Number(day.date.slice(-2)))warnings.push('日期待確認：此筆位於 '+day.date.slice(5).replace('-','/')+' 欄，但原文標記 12/'+mentioned[1]+'，請核對預約。');
 if(/久昇/.test(e.raw||e.title))warnings.push('原筆記的久昇已有歇業紀錄，不建議直接前往。');
 if(coord)warnings.push('原表只提供座標，景點名稱尚未確認。');
 if(e.conflict)warnings.push(e.orphan?'這筆原始雲端資料已不在目前網格，本機修改仍保留。':'雲端原文已改變；這張卡仍保留你的本機修改，請對照原文。');
 return `<li class="event${checked?' checked':''}" id="event-${h(e.id)}" data-date="${h(day.date)}" data-time="${h(e.time)}"><div class="event-when">${dateStampHtml(day.date)}<time class="event-time"${e.time?` datetime="${day.date}T${e.time}:00+09:00"`:''}>${h(e.time||'時間未定')}</time></div><h3>${richText(e.title)}</h3>${e.note?`<p class="event-note">${richText(e.note)}</p>`:''}${isSplit?'<span class="badge badge-note">A／B 同時分流</span>':''}${places.length?`<p class="event-note">${h(places.map(p=>p.route).join(' '))}</p>`:''}${warnings.map(w=>`<p class="small itinerary-warning" style="color:#962d38">${h(w)}</p>`).join('')}<div class="event-tools">${isSplit?ext(mapUrl('teamLab Planets TOKYO'),'A 豐洲地圖','btn btn-small')+ext(mapUrl('柴又帝釈天'),'B 柴又地圖','btn btn-small'):ext(mapUrl(map),coord?'開啟此座標 ↗':'景點地圖 ↗','btn btn-small')}${ext(directionsUrl(map),'交通路線 ↗','btn btn-small btn-quiet')}<button type="button" class="btn btn-small btn-quiet" data-edit="${h(e.id)}" data-day="${day.id}">編輯</button><button type="button" class="btn btn-small check-btn" data-check="${h(e.id)}" aria-pressed="${checked}">${checked?'✓ 已打卡':'打卡'}</button></div>${usefulInfoHtml(e)}${mapNotesHtml(e)}</li>`;
}

const DAY_COVERS=TRIP.covers;
function meaningfulEvents(day){return day.events.filter(e=>!e.inherited&&!/(?:東橫INN|住宿據點)/.test(e.title));}
function dailyFeature(day){
 const cover=DAY_COVERS.find(c=>c.date===day.date),titles=meaningfulEvents(day).map(e=>noteKey(e.title)).join(' ');
 if(cover)return cover;
 const backdrop=DAY_COVERS[day.number<=6?2:6];
 return {...backdrop,title:dailyTitle(day),caption:day.number<=6?'湘南旅景':'東京旅景'};
}

// Reviewed geographic snapshots. Do not renew basis in nightly compilation.
const DAY_ROUTE_MAPS={"2026-12-20":{"file":"1220","basis":[["07:00","準時起床 早餐"],["08:00","飯店接駁時刻表 https://www.toyoko-inn.com/china/campaign/pickup/tokyo/"],["09:50","飯店接駁車 至 東京車站"],["12:00","漫步往銀座"],["12:30","站前合照 KITTE 丸之內 (根室花丸 迴轉壽司)"],["13:50","銀座周邊 OS DRUG"],["14:20","MARRONNIER GATE GINZA 2(好逛UNIQLO / GU)"],["16:30","無印良品旗艦店"],["18:00","新橋宮崎駿時針"],["19:00","丸善 丸之內本店\n買Nia英文漫畫"],["20:00","薩莉亞 Saizeriya 日本橋濱町店"],["22:00","浜町住宿據點"]],"height":1870,"caption":"東京站 → 銀座 → 汐留；晚上再往北回丸之內。","warning":"時間待確認：表內12:00往銀座、12:30又在KITTE。圖示依今日主線呈現，未更動原行程。"},"2026-12-21":{"file":"1221","basis":[["07:00","準時起床 早餐"],["08:30","分流A: 柴又老街 (高木屋)"],["09:30","分流 B: teamLab 豐洲 (壽司大)"],["13:30","神谷町站2號出口匯流"],["13:50","東京鐵塔 (周邊外看內)"],["14:00","永井坂坡道小巷"],["15:00","綠地草坪 35.6558, 139.7490"],["16:00","往三田路"],["17:30","龍翔軒 中華料理"],["18:00","聖誕市集(為了聖誕杯線上購票)"],["20:00","薩莉亞 Saizeriya 日本橋濱町店"],["22:00","浜町住宿據點"]],"height":1930,"caption":"A 柴又／B 豐洲 → 神谷町會合 → 東京塔與草坪 → 芝公園市集。","warning":"13:30 在神谷町站2號出口會合。永井坂、龍翔軒分店尚未定位；先確認再導航。"},"2026-12-22":{"file":"1222","basis":[["07:00","準時起床 早餐"],["09:30","八十八淺草(9點營業)"],["10:10","淺草寺參拜 & 雷門 \n10:50合羽橋買濾紙"],["11:00","漫步往上野"],["12:30","12/22\n12:30 敘敘苑 上野丸井店 03-3833-8989 預約待確認"],["14:30","domremy outlet Ueno Station"],["15:00","上野周邊 OS DRUG"],["16:30","上野阿美橫町採買 (名代宇奈тото / 二木菓子)"],["20:00","薩莉亞 Saizeriya 日本橋濱町店"],["22:00","浜町住宿據點"]],"height":1930,"caption":"八十八淺草 → 淺草寺／雷門 → 合羽橋 → 上野午餐、甜點與採買。","warning":"八十八的當日開門時間、敘敘苑訂位仍需確認；合羽橋濾紙店未指定，圖上只標街區。"},"2026-12-23":{"file":"1223","basis":[["07:00","準時起床 早餐"],["11:30","12/23 11:30 叙叙苑 涩谷店 03-5459-8989 預約待確認"],["14:30","LOFT 最大店( 創始總店「澀谷 LoFt」（Shibuya Loft）)"],["16:30","3COINS 旗艦店"],["18:00","青之洞窟"],["19:00","千代田站回"],["20:00","薩莉亞 Saizeriya 日本橋濱町店"],["22:00","浜町住宿據點"]],"height":1930,"caption":"澀谷敘敘苑 → 澀谷 Loft；3COINS 分店、青之洞窟與返程車站待確認。","warning":"3COINS「旗艦店」若指原宿本店，需往東北移動；尚未替你選店。青之洞窟2026會場與「千代田站回」仍待確認。"},"2026-12-24":{"file":"1224","basis":[["07:00","準時起床 早餐"],["10:00","出發 越谷 AEON Mall LakeTown OUTLET (美食街)"],["11:30","一汁五穀"],["20:00","薩莉亞 Saizeriya 日本橋濱町店"],["22:00","浜町住宿據點"]],"height":1930,"caption":"10:00 浜町出發 → 越谷 LakeTown → Outlet；11:30 午餐在 mori，需跨館。","warning":"一汁五穀在mori，不在Outlet。圖上標mori館區，實際餐廳入口請看當日樓層圖；10:00是出發時間。"}};
function dayRouteMapHtml(day){
 const map=DAY_ROUTE_MAPS[day.date];if(!map)return '';
 if(JSON.stringify(day.events.map(e=>[e.time,e.title]))!==JSON.stringify(map.basis))return '<p class="day-note">今日行程已更新，路線圖待重新核對。</p>';
 const image='images/routes/'+map.file+'-route.svg';
 return `<figure class="day-route-map"><h3>今天怎麼走</h3><a href="${image}" target="_blank" rel="noopener noreferrer" aria-label="${h(day.date.slice(5))} 路線圖另開分頁放大"><img src="${image}" alt="${h(map.caption)} 北朝上，附比例尺。連線為移動示意，待確認位置不標為確定行程。" width="1100" height="${map.height}" loading="lazy"></a><figcaption>${h(map.caption)}<br><a href="${image}" target="_blank" rel="noopener noreferrer" class="btn btn-small">點開放大路線圖 ↗</a></figcaption><p class="route-map-warning">${h(map.warning)}</p><details><summary>地圖來源與比例</summary><p>北朝上，位置依近似座標配置；主圖與放大框各有比例尺。線條為區域移動示意，實際走法請查各站交通路線。待確認分店、活動會場與回程車站，不代替你選定。</p><p>比對日期：2026/10/08。<a href="images/routes/${map.file}-sources.json" target="_blank" rel="noopener noreferrer">查看地圖依據</a></p></details></figure>`;
}

function dayCoverHtml(day){const cover=dailyFeature(day);return `<figure class="day-cover"><div class="day-cover-frame"><img src="${h(cover.image)}" alt="${h(cover.caption)}" width="${cover.width}" height="${cover.height}" loading="${day.id===activeDay?'eager':'lazy'}" decoding="async" referrerpolicy="no-referrer" style="object-position:${h(cover.position)}"><span class="photo-unavailable" hidden>照片暫時無法載入</span></div><figcaption>${h(cover.caption)}</figcaption></figure>`;}
function renderPhotoCredits(){$('photo-credits').innerHTML=buildDays().map(day=>{const c=dailyFeature(day);return `<li>${h(day.date.slice(5).replace('-','/'))} · ${h(c.author)} — ${ext(c.source,c.file+' ↗')} · ${ext(c.licenseUrl,c.license+' ↗')}</li>`;}).join('');}
document.addEventListener('error',event=>{if(event.target.matches?.('.day-cover img')){event.target.hidden=true;event.target.style.display='none';event.target.nextElementSibling.hidden=false;}},true);
function dailyTitle(day){
 const names=[];
 for(const e of day.events){
  if(e.inherited||/^東橫INN/.test(e.title)||/^(?:NEX|大眾交通|飯店接駁|千代田站)/.test(e.title))continue;
  let t=e.title.replace(/^12\/\d+\s*/,'').replace(/^\d{1,2}:\d{2}\s*/,'').replace(/https?:\/\/\S+/g,'').replace(/[（(][^）)]*[）)]/g,'').replace(/\d{2,4}-\d{2,4}-\d{3,4}/g,'').trim();
  const split=/分流A/.test(t)&&/分流B/.test(t);
  if(split)t='豐洲／柴又分流';
  else if(/家族班機抵達/.test(t))t='家族會合';
  else if(/退房前往東京/.test(t))t='移動東京';
  else if(/班機起飛|成田 Terminal|京成 Access|飯店集合/.test(t))t='成田返台';
  else t=t.split(/[\n&／]/)[0].replace(/\s*\/\s*.*/,'').replace(/(?:參拜|散策|漫步|採買|採購|全島徒步|晨間散策).*$/,'').trim();
  t=t.replace(/[()（）]/g,'').trim();
  const shortNames=[[/MARRONNIER GATE/i,'銀座 UNIQLO／GU'],[/LOFT 最大店/i,'澀谷 LOFT'],[/domremy/i,'上野甜點 Outlet'],[/LakeTown/i,'越谷 LakeTown'],[/站前合照/,'東京車站合照'],[/叙叙苑 涩谷/,'敘敘苑澀谷店'],[/BOOKOFF SUPER/i,'大船 BOOKOFF'],[/Mr Max/i,'湘南 Mr Max'],[/Odawara Museum/i,'小田原文學館']];
  t=shortNames.find(([pattern])=>pattern.test(t))?.[1]||t;
  if(t&&!names.includes(t))names.push(t);
 }
 if(!names.length)return '自由安排・景點待補';
 return names.slice(0,4).map(t=>Array.from(t).length>22?Array.from(t).slice(0,22).join('')+'…':t).join('・');
}
function selectPhase(value,scroll=false){
 if(!familyMode)viewMode='plan';filter=value;search='';allExpanded=false;$('trip-search').value='';$('trip-filter').value=value;
 const days=buildDays().filter(matchesDay);
 activeDay=(days.find(d=>d.date===todayJapan())||days[0])?.id||'d7';
 $('expand-button').textContent='全部展開';showSection('trip',{scroll:false});renderApp();
 if(scroll)requestAnimationFrame(()=>$('itinerary-list').scrollIntoView({behavior:'smooth',block:'start'}));
}

function matchesDay(day){if(filter==='solo'&&day.number>6)return false;if(filter==='family'&&day.number<7)return false;if(!search)return true;return JSON.stringify(day.events).toLowerCase().includes(search.toLowerCase());}
function renderNav(){const today=todayJapan();$('day-nav').innerHTML=buildDays().filter(d=>filter==='all'||(filter==='family'?d.number>=7:d.number<=6)).map(d=>`<button type="button" class="day-chip${d.id===activeDay?' active':''}" data-date="${d.date}" data-journey="${d.number<=6?'solo':'family'}" data-day-jump="${d.id}"><span>${d.date.slice(5).replace('-','/')}</span><span>${h(dailyTitle(d))}<small>${d.number>=7?'家族 '+(d.number-6)+'/8':'獨旅 '+d.number+'/6'} · DAY ${String(d.number).padStart(2,'0')}</small></span></button>`).join('');}
function renderGrid(rows,target){const head=rows.findIndex(r=>r.slice(1).filter(x=>/12\/\d+/.test(toText(x))).length===14);$(target).innerHTML=`<table class="grid-table"><caption>06:00–22:00 網格 · 左右捲動查看全部日期</caption><thead><tr>${rows[head].slice(0,15).map((x,i)=>`<th scope="col">${h(i===0?'時間':x)}</th>`).join('')}</tr></thead><tbody>${rows.slice(head+1).map(r=>`<tr>${Array.from({length:15},(_,i)=>i===0?`<th scope="row">${h(r[i])}</th>`:`<td>${richText(r[i]||'')}</td>`).join('')}</tr>`).join('')}</tbody></table>`;}
function renderApp(){
 renderExperience();
 document.body.dataset.journey=filter==='solo'?'solo':'family';
 const days=buildDays().filter(matchesDay).filter(d=>viewMode!=='today'||d.id===activeDay);renderNav();$('trip-filter').value=filter;document.querySelectorAll('[data-phase]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.phase===filter)));
 $('result-summary').textContent=`${filter==='family'?'家族篇':filter==='solo'?'獨旅篇':'完整旅程'} · ${days.length} 天`;renderPhotoCredits();
 $('itinerary-list').innerHTML=days.length?days.map(day=>{
  const open=allExpanded||day.id===activeDay;
  return `<article class="accordion-item" id="${day.id}" data-date="${day.date}" data-journey="${day.number<=6?'solo':'family'}"><h2 class="accordion-header" id="heading-${day.id}"><button type="button" class="accordion-button${open?'':' collapsed'}" data-bs-toggle="collapse" data-bs-target="#collapse-${day.id}" aria-expanded="${open}" aria-controls="collapse-${day.id}"><span class="day-heading"><span class="day-date-line">${dateStampHtml(day.date)}</span><strong>${h(dailyFeature(day).title).replace('：','：<br>')}</strong></span></button></h2><div class="accordion-collapse collapse${open?' show':''}" id="collapse-${day.id}" role="region" aria-labelledby="heading-${day.id}"><div class="accordion-body">${dayCoverHtml(day)}${dayRouteMapHtml(day)}${currentRouteHtml(day)}<ol class="timeline">${day.events.map(e=>eventHtml(e,day)).join('')}</ol>${foodSection(day)}<details class="day-options"><summary>這天的其他選項</summary><button type="button" class="btn btn-small btn-quiet" data-add-day="${day.id}">+ 這天加一站</button></details></div></div></article>`;
 }).join(''):'<div class="empty">沒有符合的日期。清除關鍵字或切換「全部 14 天」即可查看完整行程。</div>';
 $('check-count').textContent=`${Object.keys(localState.checks).length} 個景點已打卡`;
 $('sync-status').textContent=navigator.onLine?'行程已載入 · 可儲存離線':'離線 · 使用已保存行程';
 refreshNow();renderMapNotes();
}
function showSection(section,{scroll=true}={}) {
 if(!['trip','theme','account','trans'].includes(section))return;
 document.querySelectorAll('.section').forEach(e=>e.classList.toggle('active',e.id==='sec-'+section));
 document.querySelectorAll('[data-section]').forEach(e=>{if(e.dataset.section===section)e.setAttribute('aria-current','page');else e.removeAttribute('aria-current');});
 if(section==='theme')renderThemes();
 if(section==='account'&&!shoppingLoaded){shoppingLoaded=true;loadBuyGallery();syncCloudData();}
 if(scroll)$('sec-'+section).scrollIntoView({behavior:'instant',block:'start'});
}
let shoppingLoaded=false;
function jumpToDay(id,eventId){if(viewMode!=='journal')viewMode='today';activeDay=id;search='';if(filter==='family'&&Number(id.slice(1))<7||filter==='solo'&&Number(id.slice(1))>=7)filter='all';$('trip-search').value='';$('trip-filter').value=filter;showSection('trip',{scroll:false});renderApp();requestAnimationFrame(()=>$(eventId?'event-'+eventId:id)?.scrollIntoView({behavior:'smooth',block:'start'}));}
function refreshNow(){
 const today=todayJapan(),minute=japanMinutes();
 document.querySelectorAll('.is-now').forEach(e=>{e.classList.remove('is-now');e.removeAttribute('aria-current');});
 document.querySelectorAll('.now-label,.today-label').forEach(e=>e.remove());
 document.querySelectorAll('.accordion-item,.day-chip').forEach(e=>{const current=e.dataset.date===today;e.classList.toggle('is-today',current);if(current){const label=document.createElement('span');label.className='badge today-label';label.textContent='今天';(e.querySelector('.day-heading')||e).append(label);}});
 const d=buildDays().find(d=>d.date===today);if(!d)return;
 const started=d.events.filter(e=>isTime(e.time)&&timeMinutes(e.time)<=minute);
 const latest=started.at(-1)?.time;
 for(const current of started.filter(e=>e.time===latest)){const el=$('event-'+current.id);if(!el)continue;el.classList.add('is-now');el.setAttribute('aria-current','step');const label=document.createElement('span');label.className='badge now-label';label.textContent='現在時段 · 依行程表';el.querySelector('h3').before(label);}
}
function refreshClock(){$('japan-clock').textContent=new Intl.DateTimeFormat('zh-TW',{timeZone:'Asia/Tokyo',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date());refreshNow();}
function toast(message,title='旅行手帳'){
 const div=document.createElement('div');div.className='toast';div.setAttribute('role','status');div.innerHTML=`<div class="toast-header"><strong>${h(title)}</strong><button class="close-toast" type="button" aria-label="關閉提醒">×</button></div><div class="toast-body">${h(message)}</div>`;
 $('toast-stack').append(div);while($('toast-stack').children.length>4)$('toast-stack').firstElementChild.remove();
 const close=()=>{if(window.bootstrap)bootstrap.Toast.getInstance(div)?.dispose();div.remove();};div.querySelector('button').addEventListener('click',close);
 if(window.bootstrap){new bootstrap.Toast(div,{delay:10000}).show();div.addEventListener('hidden.bs.toast',close,{once:true});}else{div.classList.add('show');setTimeout(close,10000);}
}
async function fetchWithTimeout(url,options={},ms=15000){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),ms);try{return await fetch(url,{...options,signal:controller.signal});}finally{clearTimeout(timer);}}
let syncing=false;
async function syncItinerary(manual=false){
 if(syncing)return;if(!navigator.onLine){toast('目前離線，使用已儲存的行程。');return;}
 syncing=true;$('sync-button').disabled=true;
 try{const r=await fetchWithTimeout('trip.json',{cache:'no-cache'},12000);if(!r.ok)throw new Error('HTTP '+r.status);const next=await r.json();validateTrip(next);PLACES.splice(0,PLACES.length,...next.places);FOODS.splice(0,FOODS.length,...next.foods);DAY_COVERS.splice(0,DAY_COVERS.length,...next.covers);Object.assign(TRIP,next);parsed={days:next.days};MAP_BUNDLE=next.map;MAP_NOTES=next.map.notes;MAP_NOTE_SOURCES=next.map.sources;TRAVEL_BUNDLE=next.travel;sourceLabel='整合行程 · '+next.updatedAt;renderApp();if(manual)toast('已讀取最新整合行程。');}
 catch{if(manual)toast('更新失敗，保留目前行程。');}finally{syncing=false;$('sync-button').disabled=false;}
}
// Great-circle Haversine distance in metres. Clamp for floating-point boundary safety.
function haversineMeters(lat1,lng1,lat2,lng2){const coords=[lat1,lng1,lat2,lng2];if(coords.some(v=>!Number.isFinite(v))||Math.abs(lat1)>90||Math.abs(lat2)>90||Math.abs(lng1)>180||Math.abs(lng2)>180)return Infinity;const rad=n=>n*Math.PI/180,dLat=rad(lat2-lat1),dLon=rad(lng2-lng1);const a=Math.sin(dLat/2)**2+Math.cos(rad(lat1))*Math.cos(rad(lat2))*Math.sin(dLon/2)**2;return 6371000*2*Math.atan2(Math.sqrt(Math.min(1,Math.max(0,a))),Math.sqrt(Math.max(0,1-a)));}
function nearbyPlaces(lat,lng){return PLACES.map(p=>({...p,distance:haversineMeters(lat,lng,p.lat,p.lng)})).filter(p=>p.distance<MATCH_RADIUS_METERS).sort((a,b)=>a.distance-b.distance);}
function suitableFood(place){return place.food.map(id=>FOODS.find(f=>f.id===id)).find(f=>f&&ratingEligible(f)&&!f.restricted);}
let gpsBusy=false;
function detectNearby(){
 if(gpsBusy)return;
 if(!navigator.geolocation){$('gps-result').textContent='此瀏覽器不支援定位，仍可使用上方地圖按鈕。';return;}
 if(!window.isSecureContext){$('gps-result').textContent='定位需要安全連線，請改用 HTTPS 網址開啟此頁。';return;}
 gpsBusy=true;$('gps-button').disabled=true;$('gps-result').textContent='正在取得定位，請允許瀏覽器使用位置…';
 const done=()=>{gpsBusy=false;$('gps-button').disabled=false;};
 navigator.geolocation.getCurrentPosition(position=>{done();const{latitude,longitude,accuracy}=position.coords;
  if(!Number.isFinite(latitude)||!Number.isFinite(longitude)||!Number.isFinite(accuracy)){ $('gps-result').textContent='定位回傳不完整，請重新定位。';return;}
  if(accuracy>500){$('gps-result').textContent=`目前定位誤差約 ${Math.round(accuracy)} 公尺，超過提醒範圍。請移至戶外或開啟精確位置後重試。`;return;}
  const nearby=nearbyPlaces(latitude,longitude);
  if(!nearby.length){const nearest=PLACES.map(p=>({...p,distance:haversineMeters(latitude,longitude,p.lat,p.lng)})).sort((a,b)=>a.distance-b.distance)[0];$('gps-result').textContent=`500 公尺內沒有內建景點。最近是${nearest.name}，直線距離約 ${(nearest.distance/1000).toFixed(1)} 公里；定位誤差約 ${Math.round(accuracy)} 公尺。`;return;}
  $('gps-result').innerHTML=`<p>找到 ${nearby.length} 個景點 · 定位誤差約 ${Math.round(accuracy)} 公尺</p>${nearby.map(p=>`<p>${ext(mapUrl(`${p.lat},${p.lng}`),p.name+' ↗')} <small>約 ${Math.round(p.distance)} m</small> <button type="button" class="btn btn-small" data-geo-check="${p.id}">${localState.checks['place-'+p.id]?'✓ 已打卡':'打卡'}</button></p>`).join('')}<p class="small muted">距離依近似座標估計，並非步行路程；打卡由你按下確認。</p>`;
  nearby.slice(0,3).forEach(p=>{const food=suitableFood(p);toast(food?`您已在 ${p.name} 附近！建議可前往周邊的 ${food.name} 享用美食！出發前請確認營業、步行路程與最新評分。`:`您已在 ${p.name} 附近！目前尚無符合星級查核條件的周邊美食候選，可先開啟景點地圖。`,'附近有行程景點');});
 },error=>{done();const messages={1:'未取得定位權限。可在瀏覽器網站設定開啟位置權限後重試。',2:'暫時無法取得位置，請移到訊號較佳處再試。',3:'定位逾時，請確認裝置的位置服務後重試。'};$('gps-result').textContent=messages[error.code]||'定位失敗，請稍後重試。';},{enableHighAccuracy:true,timeout:12000,maximumAge:0});
}
const WEATHER={tokyo:{name:'東京',lat:35.6762,lng:139.6503,temp:11,icon:'🌤',text:'冬日晴朗（示範）',tip:'防風外套、圍巾，室內外以多層穿搭調整。'},fujisawa:{name:'湘南',lat:35.3391,lng:139.4901,temp:12,icon:'☀️',text:'海風微涼（示範）',tip:'海岸風勢可能較強，防風外套比只加厚毛衣實用。'},odawara:{name:'小田原',lat:35.2647,lng:139.1523,temp:9,icon:'🌤',text:'冬日微涼（示範）',tip:'靠海早晚較涼，建議以洋蔥式穿搭並備輕便防風外套。'}};
let weatherCity='tokyo',weatherRequest=0,weatherCache=readStore('tokyo_weather_v2',{});
function renderWeather(){const d=WEATHER[weatherCity],live=weatherCache[weatherCity];$('weather-temp').textContent=(live?live.icon:d.icon)+' '+(live?live.temp:d.temp)+'°C';$('weather-condition').textContent=live?live.text:d.text;$('weather-tip').textContent=d.tip;$('weather-mode').textContent=live?'目前觀測':'示範資料';$('weather-status').innerHTML=live?`${h(d.name)} · ${h(live.time)} 日本時間 · ${ext('https://open-meteo.com/','Open-Meteo')}`:'示範溫度不是 12 月預報；可查所選地區的目前天氣。';document.querySelectorAll('[data-weather]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.weather===weatherCity)));}
function weatherCode(code){if(code===0)return ['☀️','晴朗'];if([1,2,3].includes(code))return ['⛅','多雲'];if([45,48].includes(code))return ['🌫','有霧'];if([71,73,75,77,85,86].includes(code))return ['❄️','降雪'];if(code>=95)return ['⛈','雷雨'];return ['🌧','降雨'];}
async function fetchWeather(){const city=weatherCity,d=WEATHER[city],request=++weatherRequest;$('weather-live').disabled=true;$('weather-status').textContent=`正在查詢${d.name}目前天氣…`;try{const res=await fetchWithTimeout(`https://api.open-meteo.com/v1/forecast?latitude=${d.lat}&longitude=${d.lng}&current=temperature_2m,weather_code&timezone=Asia%2FTokyo`,{},12000);if(!res.ok)throw new Error('weather');const body=await res.json(),c=body.current;if(!Number.isFinite(c?.temperature_2m)||!Number.isFinite(c?.weather_code)||typeof c?.time!=='string')throw new Error('weather format');const[icon,text]=weatherCode(c.weather_code);weatherCache[city]={temp:Math.round(c.temperature_2m),icon,text,time:c.time.replace('T',' ')};if(request===weatherRequest&&city===weatherCity)renderWeather();}catch{if(request===weatherRequest&&city===weatherCity){renderWeather();$('weather-status').textContent=weatherCache[city]?'查詢失敗，保留上次觀測時間。':'目前天氣查詢失敗；畫面保留清楚標示的示範資料。';}}finally{if(request===weatherRequest)$('weather-live').disabled=false;}}
function dayFromId(id){return buildDays().find(d=>d.id===id);}
function fillEventChoices(selected='new'){const day=dayFromId($('edit-day').value);$('edit-event').innerHTML='<option value="new">+ 新增行程</option>'+day.events.map(e=>`<option value="${h(e.id)}">${h(e.time)} ${h(e.title.slice(0,55))}</option>`).join('');$('edit-event').value=selected;fillEditorFields();}
function fillEditorFields(){const day=dayFromId($('edit-day').value),event=day.events.find(e=>e.id===$('edit-event').value);$('edit-time').value=event?.time||'12:00';$('edit-title').value=event?.title||'';$('edit-note').value=event?.note||'';$('edit-map').value=event?.map||'';$('edit-error').textContent='';$('reset-edit').hidden=!event?.edited;}
const WRITEBACK_URL_KEY='tokyo_sheet_writeback_url_v1',WRITEBACK_KEY_KEY='tokyo_sheet_writeback_key_v1';
function sessionGet(key){try{return sessionStorage.getItem(key)||'';}catch{return '';}}
function sessionSet(key,value){try{if(value)sessionStorage.setItem(key,value);else sessionStorage.removeItem(key);}catch{}}
function loadWritebackSettings(){const url=safeStorage.getItem(WRITEBACK_URL_KEY)||'';const key=sessionGet(WRITEBACK_KEY_KEY)||'';$('writeback-url').value=url;$('writeback-key').value=key;$('writeback-status').textContent=url&&key?'本分頁已就緒；密碼關閉分頁後會清除。':'尚未設定；新增仍可存在本機。';}
function saveWritebackSettings(){const value=$('writeback-url').value.trim(),secret=$('writeback-key').value.trim();try{const u=new URL(value);if(u.protocol!=='https:'||u.hostname!=='script.google.com'||!u.pathname.startsWith('/macros/s/')||!u.pathname.endsWith('/exec'))throw new Error();if(secret.length<20)throw new Error();safeStorage.setItem(WRITEBACK_URL_KEY,u.href);sessionSet(WRITEBACK_KEY_KEY,secret);$('writeback-status').textContent='本分頁已完成設定；關閉分頁後需重新輸入密碼。';toast('Google Sheet 寫入設定已套用。');}catch{$('writeback-status').textContent='請貼上 Apps Script 網頁應用程式網址，並輸入有效寫入密碼。';}}
function clearWritebackSettings(){safeStorage.setItem(WRITEBACK_URL_KEY,'');sessionSet(WRITEBACK_KEY_KEY,'');$('writeback-url').value='';$('writeback-key').value='';$('writeback-status').textContent='本分頁的寫入設定已清除。';}
function submitCustomToSheet(item){const endpoint=safeStorage.getItem(WRITEBACK_URL_KEY),secret=sessionGet(WRITEBACK_KEY_KEY);if(!endpoint||!secret)throw new Error('請先在「備份與資料設定」完成 Google 寫入設定');const parsedUrl=new URL(endpoint);if(parsedUrl.protocol!=='https:'||parsedUrl.hostname!=='script.google.com')throw new Error('寫入網址無效');const target='sheetWrite'+Date.now(),popup=window.open('',target);if(!popup)throw new Error('瀏覽器封鎖新分頁，請允許此網站開啟新分頁後重試');const form=document.createElement('form');form.method='POST';form.action=endpoint;form.target=target;form.hidden=true;const values={key:secret,requestId:item.id,date:item.date,time:item.time,title:item.title,note:item.note||'',map:item.map||'',website:''};for(const[name,value]of Object.entries(values)){const input=document.createElement('input');input.type='hidden';input.name=name;input.value=String(value);form.appendChild(input);}document.body.appendChild(form);form.submit();setTimeout(()=>form.remove(),15000);}function openEditor(dayId=activeDay,eventId='new'){$('edit-day').innerHTML=buildDays().map(d=>`<option value="${d.id}">${h(d.header)}</option>`).join('');$('edit-day').value=dayId;fillEventChoices(eventId);$('editor-dialog').showModal();$('edit-title').focus();}
function saveEditor(event){event.preventDefault();const day=dayFromId($('edit-day').value),id=$('edit-event').value,time=$('edit-time').value,title=$('edit-title').value.trim(),note=$('edit-note').value.trim(),map=$('edit-map').value.trim();if(!day||!isTime(time)||!title){$('edit-error').textContent='請填入有效時間與行程名稱。';return;}const fields={time,title,note,map};let added=null;if(id==='new'){added={id:'custom-'+(crypto.randomUUID?crypto.randomUUID():Date.now()+'-'+Math.random().toString(16).slice(2)),date:day.date,...fields,origin:'custom'};localState.custom.push(added);}else{const original=day.events.find(e=>e.id===id);if(!original)return;if(original.origin==='custom'){localState.custom=localState.custom.map(e=>e.id===id?{...e,...fields}:e);}else{localState.overrides[id]={...fields,sourceRaw:original.raw||'',date:day.date};}}saveState();$('editor-dialog').close();jumpToDay(day.id);if(added){try{submitCustomToSheet(added);toast('已儲存在此裝置，並送出至 Google Sheet；請查看新開分頁的結果。','新增站點');}catch(err){toast(storageAvailable?'已存於此裝置；雲端尚未寫入：'+err.message:'目前無法持久儲存或寫入雲端，請下載備份。','新增站點');}}else toast(storageAvailable?'遊程已儲存在這台裝置。':'遊程已更新；目前無法持久儲存，請下載備份。');}
function exportBackup(){const data={format:'tokyo-trip-backup',version:3,exportedAt:new Date().toISOString(),state:localState,grid:activeGrid};const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='tokyo-trip-2026-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
async function importBackup(event){const file=event.target.files?.[0];if(!file)return;try{if(file.size>3000000)throw new Error('檔案過大');const b=JSON.parse(await file.text());if(b.format!=='tokyo-trip-backup'||b.version!==3||!b.state||!Array.isArray(b.state.custom))throw new Error('備份格式不符');const restored=sanitizeState(b.state);if(restored.custom.length!==b.state.custom.length)throw new Error('備份含無效行程');const incoming=b.grid?parseGrid(b.grid):null;const custom=new Map(localState.custom.map(e=>[e.id,e]));restored.custom.forEach(e=>custom.set(e.id,e));localState={version:3,custom:[...custom.values()],overrides:{...localState.overrides,...restored.overrides},checks:{...localState.checks,...restored.checks},migrated:true};if(incoming){parsed=incoming;activeGrid=b.grid;sourceLabel='匯入備份 · '+formatTimestamp(b.exportedAt);writeStore(CACHE_KEY,{rows:activeGrid,syncedAt:b.exportedAt});}saveState();renderApp();toast('已合併匯入本機備份，原有其他項目保留。');}catch(e){toast('無法匯入：'+e.message,'備份未變更');}finally{event.target.value='';}}
function renderThemes(){const q=$('theme-search').value.trim().toLowerCase(),seen=new Set(),items=[];for(const day of buildDays()){for(const e of day.events){if(e.inherited)continue;const key=day.id+e.title;if(!seen.has(key)){seen.add(key);items.push({name:e.title,day:day.id,date:day.date,query:queryFor(e),eventId:e.id});}}}
 const results=items.filter(x=>!q||x.name.toLowerCase().includes(q));$('theme-spots-list').innerHTML=results.length?results.map(x=>`<article class="tour-card" data-journey="${Number(x.day.slice(1))<=6?'solo':'family'}"><div class="tour-date">${dateStampHtml(x.date)}<span class="badge">${Number(x.day.slice(1))<=6?'獨旅篇':'家族篇'}</span></div><h3>${richText(x.name)}</h3><div class="event-tools"><button type="button" class="btn btn-small" data-theme-jump="${x.day}" data-event-id="${h(x.eventId||'')}">查看這一天</button>${ext(mapUrl(x.query),'地圖 ↗','btn btn-small btn-quiet')}</div></article>`).join(''):'<p class="empty">找不到符合的景點或筆記。</p>';
 renderFoodContexts();
}

function setReading(value){const mode=value==='huge'?'huge':'large';document.documentElement.dataset.reading=mode;document.querySelectorAll('button[data-reading]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.reading===mode)));safeStorage.setItem('tokyo_reading_size_v1',mode);}
function currentRouteHtml(day){return meaningfulEvents(day).length?`<div class="day-highlights"><strong>今日亮點</strong>${h(dailyTitle(day))}</div>`:'<p class="day-note">行程待補，今天自由安排。</p>';}
function usefulInfoHtml(event){const items=TRAVEL_BUNDLE.items.filter(x=>x.keys.some(k=>noteKey(event.title).includes(noteKey(k))));return items.map(x=>`<aside class="route-extra"><h4>${h(x.title)}</h4><p>${richText(x.text)}</p><div class="source-links">${ext(x.source,'查詢官方資訊 ↗')}<span>查閱 ${h(x.checked)}</span></div></aside>`).join('');}
function updateNavigationMetrics() {
 const root=document.documentElement;
 root.style.setProperty('--topbar-height',Math.ceil(document.querySelector('.topbar').getBoundingClientRect().height)+'px');
 root.style.setProperty('--bottom-nav-height',Math.ceil(document.querySelector('.bottom-nav').getBoundingClientRect().height)+'px');
}
window.addEventListener('resize',updateNavigationMetrics,{passive:true});
if(window.ResizeObserver){const observer=new ResizeObserver(updateNavigationMetrics);observer.observe(document.querySelector('.topbar'));observer.observe(document.querySelector('.bottom-nav'));}

// Public compatibility hooks for the preserved utility sections.
function switchTabById(id){showSection(id);}
function openImageModal(src){const safe=safeUrl(src);if(!safe)return;$('modalImg').src=safe;$('imageModal').style.display='flex';$('imageModal').focus();}
function closeImageModal(){$('imageModal').style.display='none';}
document.addEventListener('click',event=>{
 const target=event.target.closest('button,a');if(!target)return;
 if(target.dataset.reading){setReading(target.dataset.reading);return;}
 if(target.dataset.phase){selectPhase(target.dataset.phase,true);return;}
 if(target.dataset.section){showSection(target.dataset.section);return;}
 if(target.tagName==='A'&&!target.getAttribute('href')?.startsWith('#')&&!target.hasAttribute('download')&&safeUrl(target.href)){target.target='_blank';target.rel='noopener noreferrer';}
 if(target.dataset.openSection){event.preventDefault();showSection(target.dataset.openSection,{scroll:false});const id=target.getAttribute('href')?.slice(1);if(id)$(id)?.scrollIntoView({behavior:'instant',block:'start'});return;}
 if(target.dataset.dayJump){jumpToDay(target.dataset.dayJump);return;}
 if(target.dataset.themeJump){jumpToDay(target.dataset.themeJump,target.dataset.eventId);return;}
 if(target.dataset.edit){openEditor(target.dataset.day,target.dataset.edit);return;}
 if(target.dataset.addDay){openEditor(target.dataset.addDay);return;}
 if(target.dataset.check){const id=target.dataset.check;if(localState.checks[id])delete localState.checks[id];else localState.checks[id]=new Date().toISOString();saveState();target.setAttribute('aria-pressed',String(!!localState.checks[id]));target.textContent=localState.checks[id]?'✓ 已打卡':'打卡';target.closest('.event').classList.toggle('checked',!!localState.checks[id]);$('check-count').textContent=`${Object.keys(localState.checks).length} 個景點已打卡`;return;}
 if(target.dataset.geoCheck){localState.checks['place-'+target.dataset.geoCheck]=new Date().toISOString();saveState();target.textContent='✓ 已打卡';$('check-count').textContent=`${Object.keys(localState.checks).length} 個景點已打卡`;return;}
 if(target.dataset.weather){weatherRequest++;weatherCity=target.dataset.weather;$('weather-live').disabled=false;renderWeather();return;}
 if(target.matches('[data-bs-toggle="collapse"]')&&!window.bootstrap){const el=document.querySelector(target.dataset.bsTarget);const open=!el.classList.contains('show');el.classList.toggle('show',open);target.classList.toggle('collapsed',!open);target.setAttribute('aria-expanded',String(open));}
});
$('sync-button').addEventListener('click',()=>syncItinerary(true));$('gps-button').addEventListener('click',()=>detectNearby());$('weather-live').addEventListener('click',()=>fetchWeather());
$('add-button').addEventListener('click',()=>openEditor());$('writeback-save').addEventListener('click',saveWritebackSettings);$('writeback-clear').addEventListener('click',clearWritebackSettings);loadWritebackSettings();$('editor-close').addEventListener('click',()=>$('editor-dialog').close());$('editor-form').addEventListener('submit',saveEditor);$('edit-day').addEventListener('change',()=>fillEventChoices());$('edit-event').addEventListener('change',fillEditorFields);
$('reset-edit').addEventListener('click',()=>{const id=$('edit-event').value;delete localState.overrides[id];saveState();$('editor-dialog').close();renderApp();toast('已還原目前的雲端原文。');});
$('trip-filter').addEventListener('change',e=>selectPhase(e.target.value));$('trip-search').addEventListener('input',e=>{search=e.target.value.trim();renderApp();});
$('expand-button').addEventListener('click',()=>{allExpanded=!allExpanded;$('expand-button').textContent=allExpanded?'收合其他日期':'全部展開';renderApp();});
$('now-button').addEventListener('click',()=>{const day=parsed.days.find(d=>d.date===todayJapan());if(day){const current=buildDays().find(d=>d.id===day.id).events.filter(e=>isTime(e.time)&&timeMinutes(e.time)<=japanMinutes()).at(-1);jumpToDay(day.id,current?.id);}else toast('日本今天不在 12/13–12/26 的旅程期間，可從日期索引選擇想查看的一天。');});
$('export-button').addEventListener('click',()=>exportBackup());$('import-input').addEventListener('change',e=>importBackup(e));$('theme-search').addEventListener('input',renderThemes);
$('map-notes-search').addEventListener('input',renderMapNotes);$('map-notes-source').addEventListener('change',renderMapNotes);
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeImageModal();});
document.addEventListener('shown.bs.collapse',e=>{if(e.target.classList.contains('accordion-collapse')){activeDay=e.target.id.replace('collapse-','');renderNav();refreshNow();}});

let currentExchangeRate = Number(readStore('tokyo_exchange_v1',{}).rate)||0.215;
    const BUY_IMAGE_DIR = 'https://travel.itigre.com/2026/tokyo/images/buy/';
    const BUY_IMAGE_MANIFEST = BUY_IMAGE_DIR + 'buy-images.json';
    const BUY_GOOGLE_SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRD3xLNcLpXzjHmJ1G76pIIuOcpOthPl58JJ5sACgQdLyUoYhvFQtd1Ym8IjSRgKwOzflgp2kGB_Put/pub?gid=318927826&single=true&output=csv';
    const BUY_GOOGLE_FORM_URL = '';
    const BUY_IMAGE_EXT_RE = /\.(jpe?g|png|webp)(\?.*)?$/i;
    const BUY_GALLERY_CHECK_STORAGE_KEY = 'tokyo_2026_buy_gallery_checked';

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function encodeBuyImagePath(fileName) {
        return String(fileName || '').trim().replace(/^\/+/, '').split('/').map(part => encodeURIComponent(part)).join('/');
    }

    function normalizeBuyImageUrl(file) {
        const raw = String(file || '').trim();
        if (!raw) return '';
        const driveImageUrl = normalizeGoogleDriveImageUrl(raw);
        if (driveImageUrl) return driveImageUrl;
        if (/^https?:\/\//i.test(raw)) return raw;
        return BUY_IMAGE_DIR + encodeBuyImagePath(raw);
    }

    function normalizeGoogleDriveImageUrl(url) {
        const raw = String(url || '').trim();
        if (!/drive\.google\.com/i.test(raw)) return '';
        const patterns = [/\/file\/d\/([^/]+)/i, /[?&]id=([^&]+)/i, /\/open\?id=([^&]+)/i];
        for (const pattern of patterns) {
            const match = raw.match(pattern);
            if (match && match[1]) {
                return `https://drive.google.com/thumbnail?id=${encodeURIComponent(match[1])}&sz=w1000`;
            }
        }
        return raw;
    }

    function isSupportedBuyImageUrl(url) {
        if (!safeUrl(url)) return false;
        const raw = String(url || '');
        return BUY_IMAGE_EXT_RE.test(raw) || /drive\.google\.com\/thumbnail/i.test(raw) || /googleusercontent\.com/i.test(raw);
    }

    function getBuyImageNameFromFile(file) {
        try {
            const raw = String(file || '').trim();
            const fileOnly = raw.split('/').pop().split('?')[0];
            const decoded = decodeURIComponent(fileOnly);
            return decoded.replace(/\.(jpe?g|png|webp)$/i, '');
        } catch (e) {
            return String(file || '').replace(/\.(jpe?g|png|webp)$/i, '');
        }
    }

    function normalizeBuyImageItem(item, index) {
        if (typeof item === 'string') {
            return { id: item, file: item, url: normalizeBuyImageUrl(item), name: getBuyImageNameFromFile(item) || `代購品項 ${index + 1}` };
        }
        if (item && typeof item === 'object') {
            const file = item.file || item.filename || item.src || item.url || '';
            const name = item.name || item.title || item.label || getBuyImageNameFromFile(file) || `代購品項 ${index + 1}`;
            const id = item.id || file || name;
            return { id, file, url: normalizeBuyImageUrl(file), name };
        }
        return { id: `buy-item-${index + 1}`, file: '', url: '', name: `代購品項 ${index + 1}` };
    }

    function normalizeBuyImageList(data) {
        const rawList = Array.isArray(data) ? data : (data && Array.isArray(data.images) ? data.images : []);
        const seen = new Set();
        return rawList.map(normalizeBuyImageItem).filter(item => item.url && isSupportedBuyImageUrl(item.url)).filter(item => {
            if (seen.has(item.url)) return false;
            seen.add(item.url);
            return true;
        });
    }

    function getCsvValue(row, headers, aliases, fallbackIndex) {
        const normalizedAliases = aliases.map(alias => String(alias).trim().toLowerCase());
        for (let i = 0; i < headers.length; i++) {
            const header = String(headers[i] || '').trim().toLowerCase();
            if (normalizedAliases.some(alias => header === alias || header.includes(alias))) return row[i] || '';
        }
        return row[fallbackIndex] || '';
    }

    function normalizeBuySheetList(csvText) {
        const rows = parseCSV(String(csvText || ''));
        if (rows.length <= 1) return [];
        const headers = rows[0];
        return rows.slice(1).flatMap((row, index) => {
            const name = getCsvValue(row, headers, ['品項名稱', '品項', '商品名稱', '商品', 'name', 'title'], 1);
            const image = getCsvValue(row, headers, ['Cloudinary照片網址', 'Cloudinary 照片網址', 'cloudinary url', 'cloudinary_url', '照片網址', '圖片網址', '照片', '圖片', 'image url', 'image_url', 'photo url', 'photo_url', 'url', 'file'], 2);
            const note = getCsvValue(row, headers, ['備註', '說明', 'note', 'memo'], 3);
            const imageList = String(image || '').split(/[\n,]+/).map(url => url.trim()).filter(Boolean);
            return imageList.map((imageUrl, imageIndex) => {
                const id = `${name || 'buy-item'}-${imageUrl || index}-${imageIndex}`;
                return { id, file: imageUrl, url: normalizeBuyImageUrl(imageUrl), name: note ? `${name}｜${note}` : (name || getBuyImageNameFromFile(imageUrl) || `代購品項 ${index + 1}`) };
            });
        }).filter(item => item.url);
    }

    function getBuyCheckedMap() {
        try { return JSON.parse(safeStorage.getItem(BUY_GALLERY_CHECK_STORAGE_KEY)) || {}; } catch (e) { return {}; }
    }

    function saveBuyCheckedMap(map) {
        safeStorage.setItem(BUY_GALLERY_CHECK_STORAGE_KEY, JSON.stringify(map));
    }

    function toggleBuyGalleryChecked(id, checkbox) {
        const checkedMap = getBuyCheckedMap();
        checkedMap[id] = checkbox.checked;
        saveBuyCheckedMap(checkedMap);
        const card = checkbox.closest('.buy-gallery-item');
        if (card) card.classList.toggle('is-checked', checkbox.checked);
    }

    async function fetchBuyImageManifest() {
        const cacheBuster = BUY_IMAGE_MANIFEST.includes('?') ? '&' : '?';
        const res = await fetchWithTimeout(BUY_IMAGE_MANIFEST + cacheBuster + 'v=' + Date.now(), { cache: 'no-store' });
        if (!res.ok) throw new Error('buy-images.json 讀取失敗');
        const data = await res.json();
        return normalizeBuyImageList(data);
    }

    async function fetchBuyGoogleSheetItems() {
        const url = String(BUY_GOOGLE_SHEET_CSV_URL || '').trim();
        if (!url) return [];
        const cacheBuster = url.includes('?') ? '&' : '?';
        const res = await fetchWithTimeout(url + cacheBuster + 'v=' + Date.now(), { cache: 'no-store' });
        if (!res.ok) throw new Error('Google 表單回覆試算表讀取失敗');
        const csvText = await res.text();
        return normalizeBuySheetList(csvText);
    }

    function renderBuyGallery(items) {
        const container = document.getElementById('buy-gallery-list');
        if (!container) return;
        if (!items || items.length === 0) {
            container.innerHTML = '<div class="buy-gallery-status">目前尚未設定代購照片</div>';
            return;
        }
        const checkedMap = getBuyCheckedMap();
        const formLink = BUY_GOOGLE_FORM_URL ? `<a href="${escapeHtml(BUY_GOOGLE_FORM_URL)}" target="_blank" rel="noopener noreferrer" class="buy-gallery-refresh" style="display:inline-block; text-decoration:none; margin-bottom:12px;">➕ 新增代購品項</a>` : '';
        const html = items.map((item, index) => {
            const safeImageUrl = escapeHtml(safeUrl(item.url));
            const safeName = escapeHtml(item.name);
            const safeId = escapeHtml(String(item.id || item.url));
            const isChecked = !!checkedMap[String(item.id || item.url)];
            return `
                <div class="buy-gallery-item ${isChecked ? 'is-checked' : ''}">
                    <div class="buy-gallery-img-wrap">
                        <label class="buy-gallery-check" onclick="event.stopPropagation();">
                            <input type="checkbox" ${isChecked ? 'checked' : ''} data-buy-id="${safeId}">
                            <span>已買</span>
                        </label>
                        <img src="${safeImageUrl}" alt="代購品項照片：${safeName}" class="buy-gallery-img" loading="lazy" onclick="openImageModal(this.src)" onerror="this.hidden=true">
                    </div>
                    <div class="buy-gallery-name">${index + 1}. ${safeName}</div>
                </div>`;
        }).join('');
        container.innerHTML = `${formLink}<div style="font-size:0.95rem; font-weight:bold; color:#555; margin-bottom:8px;">已讀取 ${items.length} 項代購照片，勾選「已買」可保留紀錄。</div><div class="buy-gallery-grid">${html}</div>`;
    }

    async function loadBuyGallery() {
        const container = document.getElementById('buy-gallery-list');
        if (!container) return;
        container.innerHTML = '<div class="buy-gallery-status">🧳 正在讀取代購品項照片...</div>';
        try {
            const sheetItems = await fetchBuyGoogleSheetItems();
            const items = sheetItems.length > 0 ? sheetItems : await fetchBuyImageManifest();
            writeStore('tokyo_buy_gallery_cache',items);renderBuyGallery(items);
        } catch (e) {
            renderBuyGallery(readStore('tokyo_buy_gallery_cache',[]));
        }
    }

    const GOOGLE_SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRD3xLNcLpXzjHmJ1G76pIIuOcpOthPl58JJ5sACgQdLyUoYhvFQtd1Ym8IjSRgKwOzflgp2kGB_Put/pub?gid=230096183&single=true&output=csv';

    function parseCSVRow(str) {
        let result = []; let cell = ''; let inQuotes = false;
        for (let i = 0; i < str.length; i++) {
            let char = str[i];
            if (char === '"' && str[i+1] === '"') { cell += '"'; i++; }
            else if (char === '"') { inQuotes = !inQuotes; }
            else if (char === ',' && !inQuotes) { result.push(cell); cell = ''; }
            else { cell += char; }
        }
        result.push(cell);
        return result.map(s => s.replace(/\r/g, '').trim());
    }

    async function syncCloudData() {
        const container = document.getElementById('tobuy-list');
        container.innerHTML = '<div style="text-align:center; padding:30px; font-weight:900; color:#1A1A1A; font-size:1.2rem;">☁️ 正在同步家族最新比價...</div>';
        try {
            const response = await fetchWithTimeout(GOOGLE_SHEET_CSV_URL);
            if (!response.ok) throw new Error('網路讀取失敗');
            const data = await response.text();
            const rows = parseCSV(data).slice(1);
            const items = {};
            rows.forEach(row => {
                const cols = row;
                if (cols.length < 4) return;
                const name = cols[1]; const store = cols[2]; const priceStr = String(cols[3] || '').replace(/[^0-9]/g, ''); const price = parseInt(priceStr);
                if (!name || isNaN(price)) return;
                if (!items[name]) items[name] = [];
                items[name].push({ store, price });
            });

            let html = '';
            for (const [name, prices] of Object.entries(items)) {
                prices.sort((a, b) => a.price - b.price);
                let storesHtml = prices.map((p, index) => {
                    const isCheapest = index === 0 && prices.length > 1;
                    const badge = isCheapest ? `<span style="font-size:1.2rem; margin-right:4px;">👍</span>` : '';
                    const priceColor = isCheapest ? '#B71C1C' : '#1B5E20';
                    return `<div style="display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:2px dotted #BCAAA4;">
                        <span style="font-weight:900; color:var(--theme-blue); font-size:1.1rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 55%;">📍 ${escapeHtml(p.store)}</span>
                        <div style="display:flex; align-items:center; flex-shrink: 0;">${badge}<span style="font-weight:900; color:${priceColor}; font-size:1.3rem;">¥${p.price.toLocaleString()}</span></div>
                    </div>`;
                }).join('');

                html += `<div class="buy-item-card" style="padding: 12px; margin-bottom: 12px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                        <span style="font-weight:900; font-size:1.4rem; color:#1A1A1A; line-height: 1.2;">${escapeHtml(name)}</span>
                        <span style="background:#E3F2FD; font-size:0.9rem; font-weight:900; padding:4px 8px; border-radius:8px; color:var(--theme-blue); border: 2px solid var(--theme-blue); flex-shrink: 0; margin-left: 10px;">已同步</span>
                    </div>
                    <div style="background:#FAF5EB; padding:8px 10px; border-radius:8px; border:2px solid #BCAAA4;">${storesHtml}</div>
                </div>`;
            }
            writeStore('tokyo_prices_cache',html);container.innerHTML = html || '<div style="text-align:center; padding:20px; font-weight:900; color:#444; font-size:1.2rem;">尚未有家族回報資料</div>';
        } catch (e) {
            container.innerHTML = readStore('tokyo_prices_cache','<p>尚無價格快取，連網後更新。</p>');
        }
    }

    let expenses = readStore('trip_acc_2026', []);
    if (!Array.isArray(expenses)) expenses = [];
    expenses = expenses.filter(e => e && Number.isFinite(e.cost) && e.cost > 0 && typeof e.item === 'string');
    function addExpense() {
        const item = document.getElementById('acc-item').value;
        const cost = parseInt(document.getElementById('acc-cost').value);
        if(!item.trim() || !Number.isFinite(cost) || cost <= 0 || cost > 99999999) return;
        expenses.unshift({ id: Date.now(), item, cost, date: new Date().toLocaleDateString('zh-TW', {month:'numeric', day:'numeric'}) });
        safeStorage.setItem('trip_acc_2026', JSON.stringify(expenses));
        document.getElementById('acc-item').value = ''; document.getElementById('acc-cost').value = '';
        renderExpenses();
    }
    function removeExpense(id) {
        expenses = expenses.filter(e => e.id !== id);
        safeStorage.setItem('trip_acc_2026', JSON.stringify(expenses));
        renderExpenses();
    }
    function renderExpenses() {
        const list = document.getElementById('expense-list'); list.innerHTML = ''; let total = 0;
        expenses.forEach(e => {
            total += e.cost;
            list.innerHTML += `<li style="display:flex; justify-content:space-between; align-items:center; padding:18px 0; border-bottom:3px dashed #BCAAA4;">
                <div style="flex:1;"><div style="font-weight:900; font-size:1.4rem; color:#1A1A1A;">${escapeHtml(e.item)}</div><div style="color:#444; font-size:1.1rem; font-weight:bold;">${escapeHtml(e.date)}</div></div>
                <div style="font-weight:900; color:var(--theme-green); font-size:1.5rem; margin-right:15px;">¥${e.cost.toLocaleString()}</div>
                <button style="background:#FFEBEE; border:3px solid var(--theme-red); color:var(--theme-red); width:45px; height:45px; border-radius:50%; font-weight:900; font-size:1.5rem; cursor:pointer;" data-expense-remove="${escapeHtml(String(e.id))}">×</button>
            </li>`;
        });
        document.getElementById('acc-total').innerText = `¥${total.toLocaleString()}`;
        document.getElementById('acc-total-twd').innerText = `約 NT$${Math.round(total * currentExchangeRate).toLocaleString()}`;
    }

    function goTranslate(sl, tl, inputId) {
        const text = document.getElementById(inputId).value;
        if (!text) return toast('請先輸入要翻譯的文字喔！');
        window.open(`https://translate.google.com/?sl=${sl}&tl=${tl}&text=${encodeURIComponent(text)}&op=translate`, '_blank', 'noopener,noreferrer');
    }

    function goKakaku() {
        const text = document.getElementById('input-kakaku').value;
        if (!text) return toast('請輸入要搜尋的商品名稱或型號！');
        window.open(`https://kakaku.com/search_results/${encodeURIComponent(text)}/`, '_blank', 'noopener,noreferrer');
    }



