/* Original vector snapshots. Regenerate only for an intentional art/route change. */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'../2026/tokyo');
const code=fs.readFileSync(path.join(root,'illustrations.js'),'utf8');
const scenes=JSON.parse(fs.readFileSync(path.join(root,'picturebook.js'),'utf8').match(/const BOOK_SCENES=(\{[^;]+\});/)[1].replaceAll("'",'"'));
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
for(const[date,kind]of Object.entries(scenes)){
 const svg=vm.runInNewContext(code+';pictureIllustration(kind,"原創旅行氣氛插畫")',{h:escape,kind});
 fs.writeFileSync(path.join(root,'images/covers/'+date.slice(5).replace('-','')+'-picturebook.svg'),svg+'\n');
}
console.log('Built 14 original local atmosphere SVGs (no labels or claimed map scale).');
