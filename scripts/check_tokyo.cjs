/* Dependency-free structural checks, also run by the scheduled compiler. */
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict'),vm=require('vm');
const root=path.join(__dirname,'../2026/tokyo'),trip=JSON.parse(fs.readFileSync(path.join(root,'trip.json')));
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const dates=Array.from({length:14},(_,i)=>`2026-12-${i+13}`);
assert.deepEqual(trip.days.map(d=>d.date),dates);assert.equal(trip.covers.length,14);
const ids=trip.days.flatMap(d=>d.events.map(e=>e.id));assert.equal(new Set(ids).size,ids.length);
assert(!/docs\.google\.com\/spreadsheets|bootstrap.*cdn|示範 11/.test(html));
assert(/name="robots" content="noindex,nofollow,noarchive"/.test(html));assert(/og:image/.test(html)&&/twitter:card/.test(html)&&/canonical/.test(html));
assert(!JSON.stringify(trip.days).includes('阿芳'));assert(!trip.days.some(d=>d.events.some(e=>e.title.includes('久昇'))));
const sourceDateConflicts=trip.days.flatMap(d=>d.events.filter(e=>{const m=e.raw.match(/^12\/(\d+)\s/);return m&&Number(m[1])!==Number(d.date.slice(-2));}));
assert.equal(trip.decisions.filter(x=>x.id.startsWith('date-conflict-')).length,sourceDateConflicts.length);
const loft=trip.venues.find(v=>v.id==='loft-shibuya');assert(loft.address.endsWith('18-2'));
assert.equal(trip.map.notes.filter(n=>n.venueId==='ntv-clock').length,1);
const rest=trip.seniorStops||[];const restEvents=new Set(rest.map(x=>x.eventId));
for(const id of ['sheet-2026-12-20-r6','sheet-2026-12-20-r7','sheet-2026-12-20-r12','sheet-2026-12-20-r14','sheet-2026-12-21-r4','sheet-2026-12-21-r5','sheet-2026-12-21-r11','sheet-2026-12-21-r14','sheet-2026-12-22-r5','sheet-2026-12-22-r6','sheet-2026-12-22-r7','sheet-2026-12-22-r10','sheet-2026-12-22-r12','sheet-2026-12-23-r10','sheet-2026-12-23-r12','sheet-2026-12-23-r14','sheet-2026-12-24-r6'])assert(restEvents.has(id),`missing rest option: ${id}`);
assert(rest.every(x=>ids.includes(x.eventId)&&x.source.startsWith('https://')&&/^\d{4}-\d{2}-\d{2}$/.test(x.checked)));
const forest=(trip.optionalEvents||[]).find(x=>x.id==='yoyogi-forest-of-lights-2026');assert(forest&&forest.date==='2026-12-23'&&forest.ticketSource.startsWith('https://'));
assert(trip.days[10].events.some(x=>x.id==='sheet-2026-12-23-r14'&&x.title.includes('Forest of Lights')));
assert(!trip.days[10].events.some(x=>/3COINS|青之洞窟/.test(x.title)));
assert(trip.days[7].events.find(x=>x.id==='sheet-2026-12-20-r14').title.includes('全員'));
assert(!trip.days[8].events.some(x=>/東京鐵塔|永井坂|龍翔軒/.test(x.title)));
for(const [i,c] of trip.covers.entries()){assert.equal(c.date,dates[i]);assert(c.image.startsWith('images/covers/'));assert(fs.existsSync(path.join(root,c.image)));assert(c.source.startsWith('https://commons.wikimedia.org/'));const route=JSON.stringify({events:trip.days[i].events,guide:trip.days[i].guide});assert(c.keys.length===0||c.keys.some(k=>route.includes(k)),c.date+' cover does not match its route');}
for(const f of ['boot.js','app.js','extra.js','illustrations.js','picturebook.js','date-bus.js','sw.js'])new vm.Script(fs.readFileSync(path.join(root,f),'utf8'),{filename:f});
for(const f of ['experience.css','picturebook.css','date-bus.css','images/date-bus.svg','fonts/Huninn-Regular.woff2','fonts/OFL.txt','manifest.webmanifest','images/icon-192.png','images/icon-512.png','images/share.jpg'])assert(fs.existsSync(path.join(root,f)));
assert(!html.includes('experience.js'));assert(fs.readFileSync(path.join(root,'boot.js'),'utf8').includes("'extra.js'"));
const app=fs.readFileSync(path.join(root,'app.js'),'utf8'),extra=fs.readFileSync(path.join(root,'extra.js'),'utf8'),sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');
const mapText=app.match(/const DAY_ROUTE_MAPS=(\{.*?\});\nfunction dayRouteMapHtml/s)?.[1];assert(mapText,'route map registry missing');
const routeMaps=JSON.parse(mapText);
for(let n=20;n<=24;n++){const date=`2026-12-${n}`,day=trip.days[n-13],map=routeMaps[date],stamp=`12${n}`;assert.equal(map.kind,'transit');assert.equal(map.visual,stamp);assert.deepEqual(map.basis,day.events.map(e=>[e.time,e.title]),date+' transit basis stale');assert(map.main.length>=3&&map.main[0][0].includes('東橫INN')&&map.home.some(x=>x[0].includes('東京站'))&&map.home.some(x=>x[0].includes('接駁')));assert(map.sources.some(x=>x[1].includes('toyoko-inn.com')));const svg=`images/routes/${stamp}-proportional.svg`,record=`images/routes/${stamp}-proportional-sources.json`;assert(sw.includes(`'${svg}'`)&&sw.includes(`'${record}'`));const graphic=fs.readFileSync(path.join(root,svg),'utf8'),meta=JSON.parse(fs.readFileSync(path.join(root,record),'utf8'));assert(graphic.startsWith('<svg')&&graphic.includes('viewBox="0 0 1100 1380"')&&graphic.includes('局部放大'));assert.deepEqual(meta.basis,map.basis);assert.equal(meta.labels[0][1],'hotel');assert.equal(meta.labels.at(-1)[1],'hotel');assert(meta.paths.some(([a,b])=>a==='tokyo'&&b==='hotel'));assert(meta.pixelsPerMeter>0&&meta.insetPixelsPerMeter>0&&meta.scaleBarMeters>0);assert.deepEqual(Object.keys(meta.pointSources).sort(),Object.keys(meta.points).sort());assert(Object.values(meta.pointSources).every(url=>url.startsWith('https://')));}
const routeFn=app.match(/function dayRouteMapHtml\(day\)\{[\s\S]*?\n\}\n\nfunction dayCoverHtml/)?.[0].replace(/\n\nfunction dayCoverHtml$/,'');assert(routeFn);
for(let n=20;n<=24;n++){const markup=vm.runInNewContext(`${'const DAY_ROUTE_MAPS='+mapText+';'}const h=x=>String(x);const ext=(url,label)=>'<a href="'+url+'">'+label+'</a>';${routeFn};dayRouteMapHtml(day)`,{day:trip.days[n-13]});assert(markup.includes(`images/routes/12${n}-proportional.svg`));assert(markup.includes('東橫INN')&&markup.includes('東京站')&&markup.includes('接駁'));}
assert(!sw.includes("'images/routes/1220-route.svg'"));
assert.equal((html.match(/id="day-picker"/g)||[]).length,1);assert(html.indexOf('id="decision-board"')>html.indexOf('id="sec-trans"'));assert(extra.includes("t.id==='day-picker'"));assert(extra.includes("section!=='trans'"));
assert(html.includes('data-reading="compact"'));assert(app.includes("['compact','large','huge'].includes(value)"));assert(fs.readFileSync(path.join(root,'experience.css'),'utf8').includes('html[data-reading=compact]'));assert(app.includes("tokyo_reading_size_v1"));
assert.equal(fs.readFileSync(path.join(root,'fonts/Huninn-Regular.woff2')).subarray(0,4).toString(),'wOF2');
assert(fs.readFileSync(path.join(root,'fonts/OFL.txt'),'utf8').includes('SIL OPEN FONT LICENSE'));
assert(html.includes('id="motion-toggle"')&&html.includes('id="departure-countdown"')&&html.includes('id="flight-cards"'));
assert(!/fonts\.googleapis\.com|fonts\.gstatic\.com/.test(html));
for(const asset of ['picturebook.css','illustrations.js','picturebook.js','date-bus.js','date-bus.css','images/date-bus.svg','fonts/Huninn-Regular.woff2'])assert(sw.includes("'"+asset+"'"),asset+' not in offline core');
const book=fs.readFileSync(path.join(root,'picturebook.js'),'utf8'),art=fs.readFileSync(path.join(root,'illustrations.js'),'utf8');
const sceneText=book.match(/const BOOK_SCENES=(\{[^;]+\});/)[1],rulesText=book.match(/const BOOK_SCENE_RULES=(\{[^;]+\});/)[1];
for(const day of trip.days){const kind=vm.runInNewContext('('+sceneText+')[date]',{date:day.date});const matches=vm.runInNewContext('('+rulesText+')[kind].every(r=>r.test(route))',{kind,route:day.events.filter(e=>!e.inherited).map(e=>e.title).join(' ')});assert(matches,day.date+' illustration scene does not match route');const local=fs.readFileSync(path.join(root,'images/covers/'+day.date.slice(5).replace('-','')+'-picturebook.svg'),'utf8').trim();const generated=vm.runInNewContext(art+';pictureIllustration(kind,"原創旅行氣氛插畫")',{kind,h:x=>String(x)});assert.equal(local,generated,day.date+' illustration snapshot stale');assert(!/<text|gradient/i.test(local));}
console.log('PASS: 14 days, unique event IDs, local licensed covers, route-anchored rest options, updated family routes, privacy, corrected addresses, source-aligned date-conflict dashboard, scripts and PWA assets');
