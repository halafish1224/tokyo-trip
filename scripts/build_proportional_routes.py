"""Manually reviewed 12/20–24 geographic transit schematics; never run in nightly build.

Point spacing and scale bars share a local metric projection. Straight arrows show
stop order, not railway alignments, track length, walking distances or timetables.
"""
import html
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / '2026/tokyo'
TRIP = json.loads((ROOT / 'trip.json').read_text())
OUT = ROOT / 'images/routes'
CHECKED = '2026-10-08'
HOTEL = (35.68737667, 139.78874815)  # previously reviewed address center
TOKYO = (35.68124, 139.76712)
SHUTTLE = 'https://www.toyoko-inn.com/eng/campaign/pickup/tokyo/'
HOTEL_SOURCE = 'https://www.toyoko-inn.com/china/search/detail/00176/'
HOTEL_COORD = 'https://mapfan.com/spots/A,35.6873766704,139.7887481534'
JR = 'https://www.jreast.co.jp/e/downloads/pdf/majorrailsub_e.pdf'

# Points are existing reviewed area/address centers or independently sourced centers.
# Deliberately avoid asserting an exact gate for the still-candidate Forest event.
SPECS = {
 '1220': {
  'title':'丸之內 → 銀座 → 新橋', 'scale':1000,
  'points':{'hotel':HOTEL,'tokyo':TOKYO,'ginza':(35.6737227,139.7651379),'clock':(35.66377,139.75976)},
  'labels':[('0','hotel','東橫INN 新大橋','飯店出發 → 接駁'),('1','tokyo','東京站／丸善／KITTE','上午書店、合照及午餐'),('2','ginza','銀座商場','長輩休息／年輕人無印'),('3','clock','新橋・汐留大時計','全員前往；晚餐二選一'),('4','tokyo','東京站','晚間返站搭接駁'),('終','hotel','東橫INN 新大橋','回到同一飯店')],
  'paths':[('hotel','tokyo','out'),('tokyo','ginza','out'),('ginza','clock','out'),('clock','tokyo','home'),('tokyo','hotel','home')],
  'sources':[HOTEL_SOURCE,HOTEL_COORD,SHUTTLE,JR,'https://www.marronniergate.com/access','https://www.ntv.co.jp/oo-dokei/','https://mapfan.com/spots/SCQQA,J,3Y0'],
  'note':'銀座內分組同區；圖點為區域中心，並非無印或休息座位門口。'},
 '1221': {
  'title':'柴又／豐洲分流 → 芝公園', 'scale':5000,
  'points':{'hotel':HOTEL,'shibamata':(35.75899,139.878),'toyosu':(35.649075,139.789525),'meeting':(35.654953,139.7453036),'grass':(35.6558,139.749),'market':(35.660709,139.7513109),'tokyo':TOKYO},
  'labels':[('0','hotel','東橫INN 新大橋','兩組從飯店分流'),('A','shibamata','A 柴又','帝釋天／高木屋一帶'),('B','toyosu','B 豐洲','teamLab 一帶'),('3','meeting','赤羽橋站','兩組會合'),('4','grass','芝公園草坪','只留草坪休息點'),('5','market','御成門市集','市集入口依票券核對'),('6','tokyo','東京站','接駁替代回程'),('終','hotel','東橫INN 新大橋','回到同一飯店')],
  'paths':[('hotel','shibamata','a'),('hotel','toyosu','b'),('shibamata','meeting','a'),('toyosu','meeting','b'),('meeting','grass','out'),('grass','market','out'),('market','tokyo','home'),('tokyo','hotel','home')],
  'sources':[HOTEL_SOURCE,HOTEL_COORD,SHUTTLE,JR,'https://www.taishakuten.com/visit-info','https://teamlabplanets.dmm.com/zh_tw/help','https://mapfan.com/spots/SCC%2CJ%2C2ND0','https://www.city.minato.tokyo.jp/shisetsu/koen/shiba/09.html','https://tokyochristmas.net/shiba/'],
  'note':'A／B 同時分流，草坪與市集在同區但非同一點；東京站線是接駁替代回程，原表亦有御成門→神保町→浜町。'},
 '1222': {
  'title':'淺草 → 上野', 'scale':1000,
  'points':{'hotel':HOTEL,'asakusa':(35.714535,139.801468),'rox':(35.712914,139.7927659),'ueno':(35.7108511,139.7758221),'tokyo':TOKYO},
  'labels':[('0','hotel','東橫INN 新大橋','飯店出發'),('1','asakusa','淺草寺周邊','八十八、雷門／淺草寺'),('2','rox','淺草 ROX','坐下休息，田原町轉銀座線'),('3','ueno','上野／阿美橫','午餐、甜點與採買'),('4','tokyo','東京站','JR 回站接駁'),('終','hotel','東橫INN 新大橋','回到同一飯店')],
  'paths':[('hotel','asakusa','out'),('asakusa','rox','out'),('rox','ueno','out'),('ueno','tokyo','home'),('tokyo','hotel','home')],
  'sources':[HOTEL_SOURCE,HOTEL_COORD,SHUTTLE,JR,'https://www.rox.co.jp/access/','https://mapfan.com/spots/SCQQA%2CJ%2CG','https://www.senso-ji.jp/guide/guide01.html','https://www.jojoen.co.jp/shop/jojoen/marui/'],
  'note':'ROX 在淺草寺西南，上野更往西；田原町→上野為銀座線，圖線並非鐵道形狀。'},
 '1223': {
  'title':'澀谷 → 原宿／代代木公園', 'scale':2000,
  'points':{'hotel':HOTEL,'shibuya':(35.65993273,139.69903266),'loft':(35.6610315,139.6994567),'109':(35.6595928,139.6986745),'harajuku':(35.6713755,139.7027016),'tokyo':TOKYO},
  'labels':[('0','hotel','東橫INN 新大橋','飯店出發'),('1','shibuya','澀谷午餐','敘敘苑分店待確認預約'),('2','loft','澀谷 Loft','宇田川町18-2'),('3','109','SHIBUYA109','館前合照／館內坐下'),('?','harajuku','原宿／代代木公園','Forest 候選，入口待核'),('5','tokyo','東京站','若接駁仍有車才返站'),('終','hotel','東橫INN 新大橋','回到同一飯店')],
  'paths':[('hotel','shibuya','out'),('shibuya','loft','out'),('loft','109','out'),('109','harajuku','candidate'),('harajuku','tokyo','home'),('tokyo','hotel','home')],
  'sources':[HOTEL_SOURCE,HOTEL_COORD,SHUTTLE,JR,'https://www.loft.co.jp/shop_list/detail.php?shop_id=189','https://shibuya109.jp/access/','https://mapfan.com/spots/SCQQA%2CJ%2CD2','https://mapfan.com/spots/SCH%2CJ%2C800','https://tickets.tbs.co.jp/yoyogiforestoflights2026/','https://www.tokyo-park.or.jp/park/yoyogi/news/2026/7_1_11_31.html'],
  'note':'問號是原宿進入代代木公園的方向，不是 Forest 確定入口；票券、入口及步行1.8公里仍需核對。'},
 '1224': {
  'title':'東京 → 越谷 LakeTown', 'scale':5000,
  'points':{'hotel':HOTEL,'tokyo':TOKYO,'station':(35.8762726,139.8220868),'outlet':(35.8807814,139.8248974),'mori':(35.882484,139.828323)},
  'labels':[('0','hotel','東橫INN 新大橋','飯店出發 → 東京站'),('1','tokyo','東京站','京濱東北→南浦和→武藏野'),('2','station','越谷 LakeTown 站','先到 OUTLET'),('3','outlet','OUTLET','逛街館區'),('4','mori','mori','一汁五穀在 mori 館'),('5','tokyo','東京站','原路返站，核對接駁'),('終','hotel','東橫INN 新大橋','回到同一飯店')],
  'paths':[('hotel','tokyo','out'),('tokyo','station','out'),('station','outlet','out'),('outlet','mori','out'),('mori','tokyo','home'),('tokyo','hotel','home')],
  'sources':[HOTEL_SOURCE,HOTEL_COORD,SHUTTLE,JR,'https://laketown.aeonmall.jp/access','https://www.aeon-laketown.jp/mori/shop/store/food-foo_116.html','https://mapfan.com/spots/SCH,J,CI2'],
  'note':'主圖為跨區比例；OUTLET／mori 在主圖幾乎重疊，下方放大框使用獨立比例尺。'
 }
}

def esc(s): return html.escape(str(s), quote=True)

ZOOMS={'1220':['tokyo','ginza','clock'],'1221':['meeting','grass','market'],
       '1222':['asakusa','rox','ueno'],'1223':['shibuya','loft','109'],
       '1224':['station','outlet','mori']}
POINT_SOURCES={
 '1220':{'hotel':HOTEL_COORD,'tokyo':JR,'ginza':'https://www.marronniergate.com/access','clock':'https://www.ntv.co.jp/oo-dokei/'},
 '1221':{'hotel':HOTEL_COORD,'shibamata':'https://www.taishakuten.com/visit-info','toyosu':'https://teamlabplanets.dmm.com/zh_tw/help','meeting':'https://mapfan.com/spots/SCC%2CJ%2C2ND0','grass':'https://www.city.minato.tokyo.jp/shisetsu/koen/shiba/09.html','market':'https://tokyochristmas.net/shiba/','tokyo':JR},
 '1222':{'hotel':HOTEL_COORD,'asakusa':'https://www.senso-ji.jp/guide/guide01.html','rox':'https://mapfan.com/spots/SCQQA%2CJ%2CG','ueno':'https://www.jojoen.co.jp/shop/jojoen/marui/','tokyo':JR},
 '1223':{'hotel':HOTEL_COORD,'shibuya':'https://www.jojoen.co.jp/shop/jojoen/shibuya/','loft':'https://www.loft.co.jp/shop_list/detail.php?shop_id=189','109':'https://mapfan.com/spots/SCQQA%2CJ%2CD2','harajuku':'https://mapfan.com/spots/SCH%2CJ%2C800','tokyo':JR},
 '1224':{'hotel':HOTEL_COORD,'tokyo':JR,'station':'https://mapfan.com/spots/SCH%2CJ%2CCI2','outlet':'https://laketown.aeonmall.jp/access','mori':'https://laketown.aeonmall.jp/access'}
}

def project(points, box, minspan=500, padding=(120,130)):
    vals=list(points.values()); lat0=sum(p[0] for p in vals)/len(vals)
    mx=111320*math.cos(math.radians(lat0));my=111320
    xy={k:(p[1]*mx,-p[0]*my) for k,p in points.items()}
    xs=[p[0] for p in xy.values()];ys=[p[1] for p in xy.values()]
    x0,x1=min(xs),max(xs);y0,y1=min(ys),max(ys)
    bx,by,bw,bh=box;spanx=max(x1-x0,minspan);spany=max(y1-y0,minspan)
    scale=min((bw-padding[0])/spanx,(bh-padding[1])/spany)
    ox=bx+(bw-spanx*scale)/2;oy=by+(bh-spany*scale)/2
    result={k:(ox+(x-x0)*scale,oy+(y-y0)*scale) for k,(x,y) in xy.items()}
    return result,scale

def text(x,y,value,size=23,fill='#183c36',weight=600):
    return f'<text x="{x}" y="{y}" font-size="{size}" fill="{fill}" font-weight="{weight}">{esc(value)}</text>'

def svg(day,spec):
    xy,scale=project(spec['points'],(55,160,635,725))
    out=['<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="1380" viewBox="0 0 1100 1380" role="img" aria-labelledby="title desc">',
         f'<title id="title">12/{day[-2:]} {esc(spec["title"])}，東橫INN新大橋出發與返回</title>',
         f'<desc id="desc">北朝上，地點按相對位置與比例繪製；右側按當日次序列出停留點。直線箭頭是交通關係示意，不是鐵道路線或步行導航。{esc(spec["note"])}</desc>',
         '<defs><marker id="arrow" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto"><path d="M1 1L8 4.5L1 8" fill="none" stroke="context-stroke" stroke-width="2"/></marker></defs>',
         '<style>text{font-family:system-ui,"Noto Sans TC",sans-serif} .node{font-size:18px;font-weight:800;text-anchor:middle;dominant-baseline:middle;fill:white} .track{fill:none;stroke-width:5;stroke-linecap:round;stroke-linejoin:round;marker-end:url(#arrow)} .out{stroke:#145b53}.home{stroke:#b45a21;stroke-dasharray:11 9}.a{stroke:#714095}.b{stroke:#18729a}.candidate{stroke:#8d6a22;stroke-dasharray:4 9}</style>',
         '<rect width="1100" height="1380" fill="#fffaf0"/><rect x="25" y="20" width="1050" height="1340" rx="20" fill="#fffaf0" stroke="#7e9b8b" stroke-width="3"/>',
         text(58,75,f'12/{day[-2:]}  路徑與相對位置 · {spec["title"]}',34,weight=800),
         text(58,120,'北朝上 · 位置等比例 · 箭頭表示先後與方向',19),
         '<rect x="55" y="160" width="635" height="725" rx="14" fill="#eff4eb" stroke="#a8b8a7" stroke-width="2"/>',
         '<rect x="724" y="160" width="320" height="725" rx="14" fill="#fff" stroke="#a8b8a7" stroke-width="2"/>',
         text(750,200,'當日順序／搭車方向',23,weight=800)]
    # Grid represents projected distance, not a street network.
    for y in range(250,850,100):out.append(f'<path d="M58 {y}H687" stroke="#d4dfd3" stroke-width="1"/>')
    # Arrow spacing prevents overprinting the stop circles; bends only separate
    # out/return arrows, without pretending that the bend follows a real track.
    for start,end,kind in spec['paths']:
        x1,y1=xy[start];x2,y2=xy[end];dx,dy=x2-x1,y2-y1;length=math.hypot(dx,dy)
        if length<25:continue
        ux,uy=dx/length,dy/length
        off=5 if kind=='home' else 0
        x1,y1=x1+ux*24-uy*off,y1+uy*24+ux*off
        x2,y2=x2-ux*30-uy*off,y2-uy*30+ux*off
        out.append(f'<path d="M{x1:.1f} {y1:.1f}L{x2:.1f} {y2:.1f}" class="track {kind}"/>')
    # Local clusters can overlap visually at metropolitan scale. Only one
    # geographic dot per distinct area is drawn; the numbered list preserves order.
    placed=[]
    for marker,key,*_ in spec['labels']:
        if key in placed:continue
        placed.append(key);x,y=xy[key]
        name='宿' if key=='hotel' else ('1/5' if key=='tokyo' and day.endswith('24') else marker)
        if key=='tokyo' and day.endswith(('20','21','22','23')):name='東京'
        if key=='hotel':color='#763c19'
        elif marker=='A':color='#714095'
        elif marker=='B':color='#18729a'
        elif marker=='?':color='#8d6a22'
        else:color='#145b53'
        out.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="24" fill="{color}" stroke="#fff" stroke-width="4"/>')
        out.append(f'<text x="{x:.1f}" y="{y+1:.1f}" class="node" font-size="{13 if len(name)>2 else 18}">{esc(name)}</text>')
    bar=spec['scale']*scale
    if bar>260:raise ValueError('scale bar too wide')
    out += [f'<path d="M82 845h{bar:.1f}m-{bar:.1f}-9v18m{bar:.1f}-18v18" stroke="#163f37" stroke-width="4" fill="none"/>',text(round(93+bar),852,f'{spec["scale"]//1000} km',18),
            '<path d="M650 230v-40l-10 16m10-16l10 16" stroke="#163f37" stroke-width="3" fill="none"/>',text(628,255,'北 N',18)]
    for i,(marker,key,label,detail) in enumerate(spec['labels']):
        y=247+i*80
        out.append(f'<rect x="746" y="{y-30}" width="277" height="70" rx="8" fill="{("#fff2e7" if marker=="終" else "#f4f7f2")}"/>')
        out.append(f'<circle cx="768" cy="{y-6}" r="17" fill="{("#b45a21" if marker=="終" else "#145b53")}"/>')
        out.append(f'<text x="768" y="{y-6}" class="node" font-size="15">{esc(marker)}</text>')
        out.append(text(793,y-8,label,19,weight=800))
        out.append(text(793,y+20,detail,15,fill='#40534b',weight=500))
    stamp=day[-5:].replace('-','')
    zoomkeys=ZOOMS[stamp];loc={k:spec['points'][k] for k in zoomkeys}
    inset,local_scale=project(loc,(68,994,610,250),minspan=90,padding=(80,65))
    out += ['<rect x="55" y="935" width="990" height="348" rx="14" fill="#f1f5ee" stroke="#a8b8a7" stroke-width="2"/>',
            text(78,975,'局部放大 · 本框另有比例尺',23,weight=800)]
    for a,b in zip(zoomkeys,zoomkeys[1:]):
        x1,y1=inset[a];x2,y2=inset[b]
        out.append(f'<path d="M{x1:.1f} {y1:.1f}L{x2:.1f} {y2:.1f}" stroke="#145b53" stroke-width="3" fill="none" stroke-dasharray="5 5"/>')
    zoomnames={key:next((marker+' '+label for marker,k,label,_ in spec['labels'] if k==key),key) for key in zoomkeys}
    for i,key in enumerate(zoomkeys):
        x,y=inset[key]
        out.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="14" fill="#145b53" stroke="#fff" stroke-width="3"/>')
        out.append(f'<text x="{x:.1f}" y="{y+1:.1f}" class="node" font-size="13">{esc(zoomnames[key].split()[0])}</text>')
        out.append(text(704,1042+i*47,zoomnames[key],20,weight=800))
    zoom_bar=next(m for m in [50,100,200,500,1000] if m*local_scale>=36)
    if zoom_bar*local_scale>190:zoom_bar=50
    out.append(f'<path d="M88 1235h{zoom_bar*local_scale:.1f}m-{zoom_bar*local_scale:.1f}-6v12m{zoom_bar*local_scale:.1f}-12v12" stroke="#163f37" stroke-width="3" fill="none"/>')
    out.append(text(102+round(zoom_bar*local_scale),1242,f'{zoom_bar} m',17))
    out += [text(58,1305,'● 飯店：出發與終點　 ━ 去程／同日次序　 ┄ 橘色：東京站接駁回程',17),
            text(58,1330,'直線不是軌道／步行距離；車次、出口與活動入口須當日確認。',16),'</svg>']
    return ''.join(out),scale,local_scale,zoom_bar

for stamp,spec in SPECS.items():
    date=f'2026-12-{stamp[2:]}'
    day=next(d for d in TRIP['days'] if d['date']==date)
    svg_text,scale,local_scale,zoom_bar=svg(date,spec)
    (OUT/f'{stamp}-proportional.svg').write_text(svg_text,encoding='utf-8')
    meta={'day':date,'checked':CHECKED,'basis':[[e['time'],e['title']] for e in day['events']],
          'coordinateKind':'Reviewed approximate venue/address/area centers. North up; local equirectangular metric projection. Not station entrances.',
          'pixelsPerMeter':scale,'scaleBarMeters':spec['scale'],'insetPixelsPerMeter':local_scale,
          'insetScaleBarMeters':zoom_bar,'insetPoints':ZOOMS[stamp],
          'points':spec['points'],'labels':spec['labels'],
          'pointSources':POINT_SOURCES[stamp],
          'paths':spec['paths'],'sources':spec['sources'],'note':spec['note'],
          'limits':'Straight arrows indicate order and destination only; no railway alignment, walking length, journey duration, Forest entrance or guaranteed shuttle pickup.'}
    (OUT/f'{stamp}-proportional-sources.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('Generated five proportional schematics, each with hotel start/end and reviewed source record.')
