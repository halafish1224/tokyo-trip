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
assert(trip.decisions.filter(x=>x.id.startsWith('date-conflict-')).length>=2);
const loft=trip.venues.find(v=>v.id==='loft-shibuya');assert(loft.address.endsWith('18-2'));
assert.equal(trip.map.notes.filter(n=>n.venueId==='ntv-clock').length,1);
for(const c of trip.covers){assert(c.image.startsWith('images/covers/'));assert(fs.existsSync(path.join(root,c.image)));assert(c.source.startsWith('https://commons.wikimedia.org/'));}
for(const f of ['boot.js','app.js','extra.js','sw.js'])new vm.Script(fs.readFileSync(path.join(root,f),'utf8'),{filename:f});
for(const f of ['experience.css','manifest.webmanifest','images/icon-192.png','images/icon-512.png','images/share.jpg'])assert(fs.existsSync(path.join(root,f)));
assert(!html.includes('experience.js'));assert(fs.readFileSync(path.join(root,'boot.js'),'utf8').includes("'extra.js'"));
console.log('PASS: 14 days, unique event IDs, local licensed covers, privacy, corrected addresses, date-conflict dashboard, scripts and PWA assets');
