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
for(const id of ['sheet-2026-12-20-r7','sheet-2026-12-20-r12','sheet-2026-12-21-r4','sheet-2026-12-21-r5','sheet-2026-12-21-r9','sheet-2026-12-21-r14','sheet-2026-12-22-r5','sheet-2026-12-22-r6','sheet-2026-12-22-r10','sheet-2026-12-22-r12','sheet-2026-12-23-r10','sheet-2026-12-23-r12','sheet-2026-12-23-r14','sheet-2026-12-24-r6'])assert(restEvents.has(id),`missing rest option: ${id}`);
assert(rest.every(x=>ids.includes(x.eventId)&&x.source.startsWith('https://')&&/^\d{4}-\d{2}-\d{2}$/.test(x.checked)));
const forest=(trip.optionalEvents||[]).find(x=>x.id==='yoyogi-forest-of-lights-2026');assert(forest&&forest.date==='2026-12-23'&&forest.seniorStop&&forest.ticketSource.startsWith('https://'));
assert(trip.days[10].events.some(x=>x.id==='sheet-2026-12-23-r14'&&x.title.includes('青之洞窟'))); // The optional event never replaces the Sheet.
for(const [i,c] of trip.covers.entries()){assert.equal(c.date,dates[i]);assert(c.image.startsWith('images/covers/'));assert(fs.existsSync(path.join(root,c.image)));assert(c.source.startsWith('https://commons.wikimedia.org/'));const route=JSON.stringify({events:trip.days[i].events,guide:trip.days[i].guide});assert(c.keys.length===0||c.keys.some(k=>route.includes(k)),c.date+' cover does not match its route');}
for(const f of ['boot.js','app.js','extra.js','sw.js'])new vm.Script(fs.readFileSync(path.join(root,f),'utf8'),{filename:f});
for(const f of ['experience.css','manifest.webmanifest','images/icon-192.png','images/icon-512.png','images/share.jpg'])assert(fs.existsSync(path.join(root,f)));
assert(!html.includes('experience.js'));assert(fs.readFileSync(path.join(root,'boot.js'),'utf8').includes("'extra.js'"));
console.log('PASS: 14 days, unique event IDs, local licensed covers, route-anchored rest options, dated optional event, privacy, corrected addresses, source-aligned date-conflict dashboard, scripts and PWA assets');
