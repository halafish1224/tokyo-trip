/* One validated public bundle. No Sheet identifiers or remote runtime libraries. */
window.validateTrip=function(data){
 if(data?.version!==2||!Array.isArray(data.days)||data.days.length!==14||!Array.isArray(data.venues)||!Array.isArray(data.map?.notes)||!Array.isArray(data.covers))throw new Error('整合資料格式不符');
 const ids=new Set();data.days.forEach((day,i)=>{if(day.date!==`2026-12-${i+13}`||day.id!==`d${i+1}`||!Array.isArray(day.events)||!day.guide)throw new Error('日期資料不符');day.events.forEach(e=>{if(typeof e.id!=='string'||ids.has(e.id)||typeof e.title!=='string'||e.title.length>12000||!Array.isArray(e.venueIds))throw new Error('行程資料不符');ids.add(e.id);});});
 return data;
};
(async()=>{
 try {
  const r=await fetch('trip.json',{cache:'no-cache'});if(!r.ok)throw new Error('HTTP '+r.status);window.TRIP=validateTrip(await r.json());
  for(const src of ['app.js','extra.js','illustrations.js','picturebook.js'])await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=src;script.onload=resolve;script.onerror=reject;document.body.append(script);});
 }catch(error){document.getElementById('experience-status').textContent='手冊未能載入。若尚未儲存離線，請連網重新開啟。';console.error(error);}
})();
