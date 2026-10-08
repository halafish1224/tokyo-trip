"""Author reviewed geographic snapshots; run only after reviewing the day's route.

Coordinates are approximate centers, not entrances. Connections are schematic.
The nightly trip compiler must not automatically renew these snapshots.
"""
import json, math, html, re, textwrap
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / '2026/tokyo'
TRIP = json.loads((ROOT / 'trip.json').read_text())
OUT = ROOT / 'images/routes'
OUT.mkdir(exist_ok=True)

HAM = [35.68737667, 139.78874815]
GSI = 'https://msearch.gsi.go.jp/address-search/AddressSearch'
SPECS = {
 '1221': dict(title='兩組出發，一起走進聖誕', week='MON / 月曜日',
  caption='A 柴又／B 豐洲 → 神谷町會合 → 東京塔與草坪 → 芝公園市集。',
  warning='13:30 在神谷町站2號出口會合。永井坂、龍翔軒分店尚未定位；先確認再導航。',
  notes=['A／B 是同時分流，不是先去柴又再去豐洲。','16:00 往三田、17:30 用餐；18:00 市集在御成門方向，須再往北。','永井坂與龍翔軒未定位，不畫出假店址。市集只標御成門駅前會場周邊。'],
  points={'ham':HAM,'shiba':[35.75899,139.878],'planets':[35.649075,139.789525],'kami':[35.6629335,139.7450324],'tower':[35.65858,139.74543],'grass':[35.6558,139.7490],'market':[35.660709,139.7513109]},
  sources=['https://www.taishakuten.com/visit-info','https://www.takagiya.co.jp/access2.html','https://teamlabplanets.dmm.com/zh_tw/help','https://mapfan.com/spots/SCH,J,6JT','https://zh.tokyotower.co.jp/','https://tokyochristmas.net/shiba/','https://mapfan.com/spots/SCH,J,KDT'],
  panels=[dict(title='上午：東北的柴又／南邊的豐洲',box=[55,235,990,650],bounds=[139.73,35.64,139.90,35.78],scale=5000,
   labels=[('ham','起',465,555,['浜町出發']),('shiba','A',650,300,['08:30 柴又老街','高木屋／帝釋天周邊']),('planets','B',590,770,['09:30 teamLab 豐洲','壽司大候位另確認']),('kami','合',90,735,['13:30 神谷町','兩組會合'])],
   paths=[('ham','shiba','a'),('ham','planets','b'),('shiba','kami','a'),('planets','kami','b')]),
   dict(title='午後放大：會合後一起走',box=[55,980,990,545],bounds=[139.741,35.653,139.756,35.665],scale=300,
   labels=[('kami','合',95,1085,['神谷町站・13:30','集合在2號出口']),('tower','1',90,1250,['東京塔・13:50','外觀欣賞']),('grass','2',650,1430,['草坪・15:00','依原表座標']),('market','3',650,1115,['市集・18:00','御成門駅前周邊'])],
   paths=[('kami','tower','walk'),('tower','grass','walk'),('grass','market','pending')])]),
 '1222': dict(title='淺草開場，上野滿載而歸',week='TUE / 火曜日',
  caption='八十八淺草 → 淺草寺／雷門 → 合羽橋 → 上野午餐、甜點與採買。',
  warning='八十八的當日開門時間、敘敘苑訂位仍需確認；合羽橋濾紙店未指定，圖上只標街區。',
  notes=['八十八地址以品牌官網為準；座標為國土地理院地址定位。','合羽橋→上野可步行或搭車；連線不是逐街導航。','16:30 阿美橫町：宇奈とと／二木菓子分店依各站資料確認。20:00 返回浜町用餐。'],
  points={'tea':[35.714535,139.801468],'temple':[35.71477,139.79666],'kapp':[35.7142343,139.7888806],'ueno':[35.7108511,139.7758221],'sweet':[35.711048,139.775635],'os':[35.710835,139.774551],'ame':[35.71012,139.77452]},
  sources=['https://www.8108kyoto.com/','https://www.senso-ji.jp/guide/guide01.html','https://www.kappabashi.or.jp/zh-TW/','https://mapfan.com/spots/SCC4Y,J,PE','https://mapfan.com/spots/S5QQC,01EE,6HBHD0','https://www.jojoen.co.jp/shop/jojoen/marui/','https://www.domremy.com/outlet/uenoshinobazu/','https://www.ameyoko.net/shop/307',GSI],
  panels=[dict(title='上午：從淺草往西走到上野',box=[55,235,990,660],bounds=[139.770,35.707,139.805,35.722],scale=500,
   labels=[('tea','1',715,665,['八十八淺草・09:30']),('temple','2',635,385,['淺草寺／雷門・10:10']),('kapp','3',320,600,['合羽橋・10:50','街區定位，店家另選']),('ueno','4',90,780,['上野午餐・12:30','敘敘苑 上野丸井店'])],
   paths=[('tea','temple','walk'),('temple','kapp','walk'),('kapp','ueno','pending')]),
   dict(title='上野放大：甜點與採買都在這一帶',box=[55,980,990,545],bounds=[139.7725,35.709,139.7775,35.7124],scale=100,
   labels=[('ueno','4',670,1180,['敘敘苑・12:30','丸井9F']),('sweet','5',450,1050,['甜點 Outlet・14:30','上野6-15-8 新址']),('os','6',90,1215,['OS DRUG・15:00']),('ame','7',390,1450,['阿美橫町・16:30','鰻魚飯／糖果採買'])],
   paths=[('ueno','sweet','walk'),('sweet','os','walk'),('os','ame','walk')])]),
 '1223': dict(title='澀谷買喜歡，夜色慢慢來',week='WED / 水曜日',
  caption='澀谷敘敘苑 → 澀谷 Loft；3COINS 分店、青之洞窟與返程車站待確認。',
  warning='3COINS「旗艦店」若指原宿本店，需往東北移動；尚未替你選店。青之洞窟2026會場與「千代田站回」仍待確認。',
  notes=['實線只連已定位的澀谷午餐與Loft；原宿本店是候選，不是已選行程。','青之洞窟未指定2026會場，不畫成已確認景點。','19:00「千代田站回」不代表某一座已確認車站。20:00 浜町晚餐另查交通。'],
  points={'jojo':[35.65993273,139.69903266],'loft':[35.6610315,139.6994567],'coins':[35.666954,139.704422]},
  sources=['https://www.jojoen.co.jp/shop/jojoen/shibuya/','https://mapfan.com/spots/S34QI,FJ66,M9S7W','https://www.loft.co.jp/shop_list/detail.php?shop_id=189','https://mapfan.com/spots/SCQ5Q,001,R','https://www.palcloset.jp/addons/pal/shoplist/detail/?brandshop_no=1505','https://www.palcloset.jp/display/article/detail/?acd=2203313co_you','https://shibuya-aonodokutsu.jp/',GSI],
  panels=[dict(title='澀谷 → 原宿方向：候選分店先看方位',box=[55,235,990,960],bounds=[139.694,35.657,139.709,35.670],scale=300,
   labels=[('jojo','1',105,980,['敘敘苑澀谷店・11:30','訂位待確認']),('loft','2',455,820,['澀谷 Loft・14:30','宇田川町18-2']),('coins','?',625,350,['3COINS 原宿本店','16:30 候選，分店待確認'])],
   paths=[('jojo','loft','walk'),('loft','coins','pending')])]),
 '1224': dict(title='平安夜，逛一座購物小鎮',week='THU / 木曜日',
  caption='10:00 浜町出發 → 越谷 LakeTown → Outlet；11:30 午餐在 mori，需跨館。',
  warning='一汁五穀在mori，不在Outlet。圖上標mori館區，實際餐廳入口請看當日樓層圖；10:00是出發時間。',
  notes=['上圖看東京／越谷遠近，下圖看商場；兩個比例尺不可混用。','mori標示館區中心；餐廳門口另看樓層圖。','20:00 浜町晚餐；回程交通與時間請另查。'],
  points={'ham':HAM,'station':[35.8762726,139.8220868],'outlet':[35.8807814,139.8248974],'mori':[35.882484,139.828323]},
  sources=['https://mapfan.com/spots/SCH,J,CI2','https://mapfan.com/spots/SCQ53,J,70','https://laketown.aeonmall.jp/access','https://laketown.aeonmall.jp/','https://www.aeon-laketown.jp/mori/shop/store/food-foo_116.html',GSI],
  panels=[dict(title='跨區總覽：東京往北到埼玉越谷',box=[55,235,990,650],bounds=[139.70,35.66,139.91,35.91],scale=5000,
   labels=[('ham','起',150,790,['浜町・10:00 出發','東京']),('station','1',610,340,['越谷 LakeTown','埼玉・JR武藏野線'])],
   paths=[('ham','station','ride')]),
   dict(title='商場放大：Outlet和mori是不同館',box=[55,980,990,545],bounds=[139.819,35.874,139.832,35.885],scale=200,
   labels=[('station','1',90,1450,['越谷レイクタウン站']),('outlet','2',120,1160,['OUTLET','購物館區']),('mori','3',670,1050,['mori・11:30 午餐','一汁五穀 1F'])],
   paths=[('station','outlet','walk'),('outlet','mori','walk')])]),
}

def text(x,y,t,cls='label',size=None):
 return f'<text x="{x}" y="{y}" class="{cls}"'+(f' font-size="{size}"' if size else '')+'>'+html.escape(t)+'</text>'

def illustration(date,spec):
 s=['<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="1930" viewBox="0 0 1100 1930" role="img" aria-labelledby="title desc">',
  f'<title id="title">12/{date[2:]} {html.escape(spec["title"])}</title><desc id="desc">{html.escape(spec["caption"])} 北朝上，各圖獨立比例尺，連線為移動示意。待確認地點不標為確定行程。</desc>',
  '''<defs><pattern id="paper" width="24" height="24" patternUnits="userSpaceOnUse"><rect width="24" height="24" fill="#fff9ed"/><path d="M0 5h24M0 18h24" stroke="#d4c8b0" stroke-opacity=".16"/></pattern>''']
 colors={'walk':'#a52d3c','ride':'#245844','a':'#993b39','b':'#246f91','pending':'#967039'}
 for k,c in colors.items():s.append(f'<marker id="{k}" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0L8 4L0 8" fill="none" stroke="{c}" stroke-width="2"/></marker>')
 s+=['</defs>', '''<style>text{font-family:'Noto Sans CJK TC','Noto Sans TC',system-ui,sans-serif;fill:#234537}.label{font-size:34px;font-weight:800;paint-order:stroke;stroke:#fff9ed;stroke-width:9;stroke-linejoin:round}.sub{font-size:28px;paint-order:stroke;stroke:#fff9ed;stroke-width:7}.tiny{font-size:23px}.lead{stroke:#7a816a;stroke-width:2;fill:none}.num{fill:white;font-size:25px;font-weight:900;text-anchor:middle}</style>''',
  '<rect width="1100" height="1930" fill="url(#paper)"/><path d="M23 30L1073 25L1079 1898L27 1906Z" fill="none" stroke="#214f3f" stroke-width="3"/>',
  text(55,80,f'12/{date[2:]} · {spec["week"]}','date',30),text(55,140,spec['title'],'title',46)]
 # Small evergreen, drawn as independent pencil strokes.
 s+=['<path d="M1009 57l-23 35h13l-24 32h70l-24-32h12Z M1009 124v20" fill="#dbe4cd" stroke="#41634b" stroke-width="3"/>']
 panel_meta=[]
 for panel in spec['panels']:
  bx,by,bw,bh=panel['box'];lo,la,hi,ha=panel['bounds'];mid=(la+ha)/2
  mx=111320*math.cos(math.radians(mid));my=111320
  scale=min((bw-70)/((hi-lo)*mx),(bh-90)/((ha-la)*my))
  width,height=(hi-lo)*mx*scale,(ha-la)*my*scale
  ox,oy=bx+(bw-width)/2,by+(bh-height)/2
  def xy(k):lat,lon=spec['points'][k];return ox+(lon-lo)*mx*scale,oy+(ha-lat)*my*scale
  s+=[text(bx,by-27,panel['title'],'panel-title',34),f'<path d="M{bx} {by+2}L{bx+bw} {by}L{bx+bw-2} {by+bh}L{bx+2} {by+bh+2}Z" fill="#f0f0df" stroke="#b9bea6" stroke-width="2"/>']
  # A subtle ruled paper grid, deliberately not a made-up road network.
  for gy in range(by+70,by+bh,90):s.append(f'<path d="M{bx+8} {gy}H{bx+bw-8}" stroke="#bdc7b1" stroke-opacity=".18" stroke-width="1"/>')
  for f,t,k in panel['paths']:
   x1,y1=xy(f);x2,y2=xy(t);dist=math.hypot(x2-x1,y2-y1)
   if dist>48:
    dx,dy=(x2-x1)/dist,(y2-y1)/dist;x1+=dx*26;y1+=dy*26;x2-=dx*30;y2-=dy*30
   dash='' if k=='walk' else ' stroke-dasharray="11 11"'
   s.append(f'<path d="M{x1:.2f} {y1:.2f}L{x2:.2f} {y2:.2f}" fill="none" stroke="{colors[k]}" stroke-width="6" stroke-linecap="round"{dash} marker-end="url(#{k})"/>')
  for k,n,tx,ty,lines in panel['labels']:
   xx,yy=xy(k);color=colors['pending'] if n in ['?','参'] else colors.get(n.lower(),colors['walk'])
   s+=[f'<path d="M{xx:.2f} {yy:.2f}L{tx} {ty-12}" class="lead"/>',f'<circle cx="{xx:.2f}" cy="{yy:.2f}" r="19" fill="{color}" stroke="#fff9ed" stroke-width="5"/>',text(round(xx,2),round(yy+9,2),n,'num')]
   for i,line in enumerate(lines):s.append(text(tx,ty+i*39,line,'sub' if i else 'label'))
  sx,sy=bx+25,by+bh-35;length=panel['scale']*scale
  s+=[f'<path d="M{sx} {sy}h{length:.2f}m-{length:.2f}-7v14m{length:.2f}-14v14" stroke="#234537" stroke-width="3" fill="none"/>',text(sx+length+15,sy+10,f'{panel["scale"]//1000} km' if panel['scale']>=1000 else f'{panel["scale"]} m','tiny'),f'<path d="M{bx+bw-42} {by+60}v-32l-8 12m8-12l8 12" stroke="#234537" stroke-width="3" fill="none"/>',text(bx+bw-72,by+90,'北 N','tiny')]
  panel_meta.append({'title':panel['title'],'bounds':panel['bounds'],'pixelsPerMeter':scale,'scaleBarMeters':panel['scale']})
 if date=='1223':
  s+=['<rect x="55" y="1260" width="990" height="245" rx="12" fill="#f5ebd8" stroke="#a78d58" stroke-width="2"/>',text(85,1310,'18:00 夜景候選：青之洞窟','label'),text(85,1360,'2026會場／開放時段待公告，先不畫出確定點位。','sub'),text(85,1420,'19:00「千代田站回」：車站尚未指明。','sub'),text(85,1470,'確認之後再補路線；晚餐20:00回浜町。','sub')]
 s += [text(65,1590,'實線：步行區段　／　虛線：跨區或候選移動','sub'),text(65,1640,'位置等比例・各圖另附比例尺・非逐街導航','sub')]
 lines=[part for note in spec['notes'][:3] for part in textwrap.wrap(note,width=40)]
 for i,line in enumerate(lines):s.append(text(65,1690+i*30,line,'tiny'))
 s+=['</svg>']
 return ''.join(s),panel_meta

registry={}
old=json.loads((OUT/'1220-sources.json').read_text())
registry['2026-12-20']={'file':'1220','basis':old['basis'],'height':1870,'caption':'東京站 → 銀座 → 汐留；晚上再往北回丸之內。','warning':'時間待確認：表內12:00往銀座、12:30又在KITTE。圖示依今日主線呈現，未更動原行程。'}
for date,spec in SPECS.items():
 day=next(d for d in TRIP['days'] if d['date']==f'2026-12-{date[2:]}')
 svg,panels=illustration(date,spec)
 (OUT/f'{date}-route.svg').write_text(svg)
 basis=[[e['time'],e['title']] for e in day['events']]
 sources={'checked':'2026-10-08','day':day['date'],'basis':basis,'sources':spec['sources'],'points':spec['points'],'panels':panels,'coordinateKind':'Approximate venue/address/area centers, not entrances. Route lines are schematic. kaze is orientation only; mori marks the building area, not the restaurant door.','notes':spec['notes']}
 (OUT/f'{date}-sources.json').write_text(json.dumps(sources,ensure_ascii=False,indent=2)+'\n')
 registry[day['date']]={'file':date,'basis':basis,'height':1930,'caption':spec['caption'],'warning':spec['warning']}

app=ROOT/'app.js';src=app.read_text()
function='''// Reviewed geographic snapshots. Do not renew basis in nightly compilation.
const DAY_ROUTE_MAPS=REGISTRY;
function dayRouteMapHtml(day){
 const map=DAY_ROUTE_MAPS[day.date];if(!map)return '';
 if(JSON.stringify(day.events.map(e=>[e.time,e.title]))!==JSON.stringify(map.basis))return '<p class="day-note">今日行程已更新，路線圖待重新核對。</p>';
 const image='images/routes/'+map.file+'-route.svg';
 return `<figure class="day-route-map"><h3>今天怎麼走</h3><a href="${image}" target="_blank" rel="noopener noreferrer" aria-label="${h(day.date.slice(5))} 路線圖另開分頁放大"><img src="${image}" alt="${h(map.caption)} 北朝上，附比例尺。連線為移動示意，待確認位置不標為確定行程。" width="1100" height="${map.height}" loading="lazy"></a><figcaption>${h(map.caption)}<br><a href="${image}" target="_blank" rel="noopener noreferrer" class="btn btn-small">點開放大路線圖 ↗</a></figcaption><p class="route-map-warning">${h(map.warning)}</p><details><summary>地圖來源與比例</summary><p>北朝上，位置依近似座標配置；主圖與放大框各有比例尺。線條為區域移動示意，實際走法請查各站交通路線。待確認分店、活動會場與回程車站，不代替你選定。</p><p>比對日期：2026/10/08。<a href="images/routes/${map.file}-sources.json" target="_blank" rel="noopener noreferrer">查看地圖依據</a></p></details></figure>`;
}
'''.replace('REGISTRY',json.dumps(registry,ensure_ascii=False,separators=(',',':')))
start=src.find('// Reviewed geographic snapshots.')
if start<0:start=src.index('function dayRouteMapHtml(day)')
end=src.index('function dayCoverHtml(day)',start)
app.write_text(src[:start]+function+'\n'+src[end:])
sw=ROOT/'sw.js';content=sw.read_text()
content=re.sub(r"const VERSION='[^']+'", "const VERSION='tokyo-v2-20261008-routes5'",content)
for date in SPECS:
 if f'images/routes/{date}-route.svg' not in content:
  content=content.replace("'images/routes/1220-sources.json'];",f"'images/routes/{date}-route.svg','images/routes/{date}-sources.json','images/routes/1220-sources.json'];")
sw.write_text(content)
print('Built 12/21–12/24 maps and registered five guarded, offline day maps')
