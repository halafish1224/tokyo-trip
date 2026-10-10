/* Dated forecast regressions; NODE_PATH must contain jsdom. No network/browser required. */
const {JSDOM,VirtualConsole,ResourceLoader}=require('jsdom');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../2026/tokyo');
const dates=Array.from({length:7},(_,i)=>`2026-12-${i+13}`);
function fixtures(){
 return Object.fromEntries(['tokyo','fujisawa','odawara'].map(city=>[city,{updatedAt:'2026-12-13T03:00:00Z',daily:dates.map((date,i)=>({date,min:1,max:city==='tokyo'?28:city==='odawara'?12:[4.9,5,11.9,12,19.9,20,27.9][i],code:city==='tokyo'?95:city==='odawara'?65:[61,0,73,0,3,45,0][i],rain:city==='tokyo'?90:city==='odawara'?80:i===0?80:0}))}]));
}
async function open({now='2026-12-13T12:00:00+09:00',cache=fixtures(),online=true,query=''}={}){
 const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));vc.on('error',e=>errors.push(String(e)));
 const dom=new JSDOM(fs.readFileSync(root+'/index.html','utf8'),{
  url:'http://localhost/2026/tokyo/'+query,runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,
  resources:new class extends ResourceLoader{fetch(url){return Promise.resolve(fs.readFileSync(root+'/'+new URL(url).pathname.replace('/2026/tokyo/','')));}}(),
  beforeParse(w){
   const NativeDate=Date;w.Date=class extends NativeDate{constructor(...args){super(...(args.length?args:[now]));}static now(){return new NativeDate(now).getTime();}};
   Object.defineProperty(w.navigator,'onLine',{get:()=>online,configurable:true});
   w.localStorage.setItem('tokyo_weather_v2',JSON.stringify(cache));
   w.fetch=async url=>{const u=new URL(url,w.location.href);return u.hostname==='localhost'?new Response(fs.readFileSync(root+'/'+u.pathname.replace('/2026/tokyo/',''))):new Response('{}',{status:503});};
   w.matchMedia=()=>({matches:false,addEventListener(){}});w.ResizeObserver=class{observe(){}};
   w.HTMLElement.prototype.scrollIntoView=function(){};w.scrollTo=function(){};
   w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
   w.URL.createObjectURL=()=>'';w.URL.revokeObjectURL=()=>{};
  }
 });
 const w=dom.window;
 for(let i=0;i<100&&!w.document.querySelector('#date-bus-vehicle .date-bus-direction svg');i++)await new Promise(r=>setTimeout(r,20));
 assert(w.TokyoTrip,'handbook did not initialize');assert.deepEqual(errors,[]);
 return {w,dom,errors};
}
function inspect(w){
 const bus=w.document.getElementById('date-bus-vehicle'),label=w.document.getElementById('date-bus-weather-status');
 return {sky:bus.dataset.sky,band:bus.dataset.temperature,color:bus.style.getPropertyValue('--bus-body-color'),text:label.textContent,detail:w.document.getElementById('date-bus-weather-detail').textContent};
}
(async()=>{
 let t=await open({now:'2026-10-10T12:00:00+09:00'});
 assert.equal(inspect(t.w).sky,'default');assert.equal(inspect(t.w).band,'unknown');assert(inspect(t.w).text.includes('太陽為預設插畫'));assert(!inspect(t.w).text.includes('°C'));
 assert.equal(t.w.getComputedStyle(t.w.document.querySelector('.bus-sky-sun')).display,'block');
 assert.equal(t.w.getComputedStyle(t.w.document.querySelector('.bus-sky-rain')).display,'none');
 t.dom.window.close();console.log('PASS unavailable future date: no invented temperature or rain, visible default sun');

 t=await open({online:false});
 const expected=[['d1','rain','cold','#9DC6E0'],['d2','sun','cool','#B9DAA5'],['d3','snow','cool','#B9DAA5'],['d4','rain','mild','#F6D27A'],['d5','cloud','mild','#F6D27A'],['d6','fog','warm','#F2B287'],['d7','rain','hot','#ECA19B']];
 for(const [day,sky,band,color]of expected){
  t.w.jumpToDay(day);const actual=inspect(t.w);assert.equal(actual.sky,sky,day);assert.equal(actual.band,band,day);assert.equal(actual.color,color,day);assert(actual.text.includes('離線快取預報'));
 }
 assert(inspect(t.w).text.includes('雷雨預報'));t.w.jumpToDay('d4');assert(inspect(t.w).text.includes('小田原'));assert(inspect(t.w).text.includes('最高12°C'));
 assert.equal(t.w.getComputedStyle(t.w.document.querySelector('.bus-sky-rain')).display,'block');assert.equal(t.w.getComputedStyle(t.w.document.querySelector('.bus-sky-sun')).display,'none');
 t.w.eval('weatherCache.odawara.daily[3].code=2;renderDateBusWeather(selectedDay())');assert.equal(inspect(t.w).sky,'partly');assert(inspect(t.w).text.includes('晴時多雲'));
 assert.equal(t.w.getComputedStyle(t.w.document.querySelector('.bus-sky-sun')).display,'block');assert.equal(t.w.getComputedStyle(t.w.document.querySelector('.bus-sky-cloud')).display,'block');
 t.w.eval("weatherCache.tokyo.daily[6].max=27.9;renderDateBusWeather(selectedDay())");t.w.jumpToDay('d7');assert.equal(inspect(t.w).band,'warm');
 t.w.jumpToDay('d14');assert.equal(inspect(t.w).band,'unknown');assert(!inspect(t.w).text.includes('°C'));
 assert.deepEqual(t.errors,[]);t.dom.window.close();console.log('PASS route regions, temperature boundaries, rain/snow/cloud/fog, offline timestamps and forecast horizon');

 const stale=fixtures();stale.fujisawa.updatedAt='2026-12-11T02:00:00Z';t=await open({cache:stale,online:false});
 assert(inspect(t.w).text.includes('已過期'));assert(inspect(t.w).detail.includes('12/11'));
 for(const bad of [{date:dates[0],min:null,max:9,code:61,rain:70},{date:dates[0],min:15,max:9,code:61,rain:70},{date:dates[0],min:1,max:9,code:7,rain:70},{date:dates[0],min:1,max:9,code:61,rain:101}]){
  t.w.eval(`weatherCache.fujisawa.daily=[${JSON.stringify(bad)}];renderDateBusWeather(selectedDay())`);assert.equal(inspect(t.w).band,'unknown');
 }
 t.w.eval('weatherCache.fujisawa.daily={};renderDateBusWeather(selectedDay())');assert.equal(inspect(t.w).band,'unknown');
 assert.deepEqual(t.errors,[]);t.dom.window.close();console.log('PASS stale cache is labelled; malformed values never become weather facts');

 t=await open();const w=t.w;
 const before=w.eval('JSON.stringify(weatherCache.fujisawa)');
 w.fetch=async()=>new Response(JSON.stringify({daily:{time:dates,temperature_2m_min:[1],temperature_2m_max:[9],weather_code:[61],precipitation_probability_max:[90]}}));
 await w.fetchWeather('fujisawa');assert.equal(w.eval('JSON.stringify(weatherCache.fujisawa)'),before);assert(inspect(w).text.includes('更新失敗'));
 const raw={time:dates,temperature_2m_min:Array(7).fill(2),temperature_2m_max:Array(7).fill(8),weather_code:Array(7).fill(61),precipitation_probability_max:Array(7).fill(85)};
 w.fetch=async()=>new Response(JSON.stringify({daily:raw}));await w.fetchWeather('fujisawa');
 assert(inspect(w).text.includes('最高8°C'));assert(inspect(w).text.includes('7日預報'));assert.equal(inspect(w).sky,'rain');assert.equal(inspect(w).band,'cool');
 assert.equal(JSON.parse(w.localStorage.getItem('tokyo_weather_v2')).fujisawa.daily.length,7);
 w.fetch=async()=>{throw new Error('offline');};await w.fetchWeather('fujisawa');assert(inspect(w).text.includes('更新失敗'));assert(inspect(w).text.includes('最高8°C'));
 assert.deepEqual(t.errors,[]);t.dom.window.close();console.log('PASS incomplete/failed refresh preserves previous forecast; successful refresh updates rain and color');

 t=await open({cache:null});assert.equal(inspect(t.w).band,'unknown');assert.deepEqual(t.errors,[]);t.dom.window.close();console.log('PASS malformed saved cache recovers without changing device/backup keys');
})().catch(e=>{console.error(e);process.exitCode=1;});
