/* Public estimates only. Rendering never writes to the personal expense ledger. */
const BUDGET_LABELS={p1:'P1｜全程14日',p2:'P2｜會合後8日'};
function budgetRange(low,high,currency='JPY'){
 const symbol=currency==='TWD'?'NT$':'¥',format=n=>Math.round(n).toLocaleString('zh-TW');
 return symbol+format(low)+(low===high?'':'–'+format(high));
}
function budgetEstimateHtml(estimate){
 const rate=TRIP.budget.exchangeRate;
 return `<strong>${h(budgetRange(estimate.minJPY,estimate.maxJPY))}</strong><span class="small">約 ${h(budgetRange(estimate.minJPY*rate,estimate.maxJPY*rate,'TWD'))}／成人</span>`;
}
function dayBudgetHtml(day){
 const budget=TRIP.budget,item=budget?.daily.find(d=>d.date===day.date);
 if(!item)return '';
 const estimates=item.estimates.filter((e,i,a)=>i===0||e.minJPY!==a[0].minJPY||e.maxJPY!==a[0].maxJPY);
 const shared=item.estimates.length>1&&estimates.length===1;
 const sims=budget.sims.filter(s=>s.start===day.date);
 return `<section class="day-budget" aria-label="當日交通費預估"><div class="budget-heading"><h3>今日交通預估</h3><span class="badge badge-note">一般推估</span></div><dl class="budget-daily-costs">${estimates.map(e=>`<div><dt>${h(shared?'每位成人':BUDGET_LABELS[e.traveler])}</dt><dd>${budgetEstimateHtml(e)}</dd></div>`).join('')}</dl>${day.date==='2026-12-19'?'<p class="small">P1：藤澤→東京；P2：成田→東京（Access Express）。</p>':''}<p class="small">${h(item.note)}</p>${sims.map(s=>`<p class="budget-sim-note">${h(s.traveler.toUpperCase())} 上網方案一次暫估 NT$${h(s.allowanceTWD)}／張・${h(s.days)}日。<span class="small">${h(s.status)}；另列於上網預算。</span></p>`).join('')}<a class="small" href="#budget-summary" data-open-section="account">查看交通與上網預算總覽 →</a></section>`;
}
function renderBudgetSummary(){
 const target=document.getElementById('budget-summary'),b=TRIP.budget;
 if(!target||!b)return;
 target.innerHTML=`<h2>行前預算｜交通與上網</h2><p class="small">每位成人／每張 SIM・估算 ${h(b.checked)}。預算供行前準備，實際付款請記在下方「旅途個人支出」。</p><div class="budget-profile-grid">${b.summaries.map(total=>{
  const sim=b.sims.find(s=>s.traveler===total.traveler);
  return `<article class="budget-profile"><h3>${h(BUDGET_LABELS[total.traveler])}</h3><p class="small">${total.traveler==='p1'?'12/13–12/26':'12/19–12/26'}</p><dl><dt>交通合計</dt><dd>${budgetEstimateHtml(total)}</dd><dt>Nippon SIM・${h(sim.days)}日</dt><dd><strong>暫估 NT$${h(sim.allowanceTWD)}／張</strong><span class="small">${h(sim.status)}</span></dd></dl><details><summary>上網規格與估價說明</summary><p>${h(sim.spec)}</p><p class="small">${h(sim.note)}</p>${sim.startingJPY?`<p class="small">官方頁面列 ${h(budgetRange(sim.startingJPY,sim.startingJPY))} 起，無法據此確認15日選項的實際價格。</p>`:''}${ext(sim.source,'方案來源 ↗')}</details></article>`;
 }).join('')}</div><p class="small">SIM 每張一次計費；每日攤提僅供比較：P1 約 NT$${Math.round(b.sims[0].allowanceTWD/14)}／日，P2 約 NT$${Math.round(b.sims[1].allowanceTWD/8)}／日。總額依實際成人數與使用張數計算。</p><details class="budget-assumptions"><summary>地鐵券、匯率與估算範圍</summary><p>${h(b.pass.note)}成人券 ${h(budgetRange(b.pass.priceJPY,b.pass.priceJPY))}／人。</p><p>${h(b.note)}</p><p class="small">本區固定以估算日匯率 ¥1 ≈ NT$${h(b.exchangeRate)} 換算。下方實際記帳可另設匯率或使用連線更新值。</p><div class="source-links">${ext(b.pass.source,'地鐵券官方票價 ↗')}${b.sources.map(s=>ext(s.url,s.label+' ↗')).join('')}</div></details>`;
}
