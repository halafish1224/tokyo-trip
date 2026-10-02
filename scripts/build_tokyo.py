#!/usr/bin/env python3
"""Compile validated Sheet rows into the sole public trip.json. No model rewrites HTML."""
import argparse,csv,datetime,io,json,re,urllib.request,os
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]/'2026/tokyo'
DATES=[f'2026-12-{n}' for n in range(13,27)]
def normalize_time(value):
 m=re.match(r'^(\d{1,2}):(\d{2})',str(value or '').strip())
 if m and int(m[1])<24 and int(m[2])<60:return f'{int(m[1]):02}:{m[2]}'
 return ''
def public_text(text):
 text=re.sub(r'https://docs\.google\.com/\S+','',text)
 text=re.sub(r'(?:阿芳|[\u4e00-\u9fff]{2,4})(?:已)?訂位','預約待確認',text)
 text=re.sub(r'(訂位碼|訂房碼|預約番号|房號|保險單號)\s*[:：]?\s*[^\s，。\n]+',r'\1：請見私人筆記',text)
 text=re.sub(r'東橫INN藤澤站北口','藤澤住宿據點',text)
 text=re.sub(r'東橫INN東京站新大橋前','浜町住宿據點',text)
 text=re.sub(r'\s*[（(]CI10[45][）)]','',text)
 text=re.sub(r'[（(][^）)]*久昇[^）)]*[）)]','',text)
 return text.strip()
def note_key(s):return re.sub(r'\s','',s).lower()
def compile_rows(rows,trip):
 head=next((i for i,r in enumerate(rows) if sum(bool(re.search(r'12/\d+',str(x or ''))) for x in r[1:])==14),None)
 if head is None:raise ValueError('Must include all 14 date columns')
 actual=[f'2026-{int(m[1]):02}-{int(m[2]):02}' if (m:=re.search(r'(\d+)/(\d+)',str(x))) else '' for x in rows[head][1:15]]
 if actual!=DATES:raise ValueError('Unexpected dates; preserving previous bundle')
 areas=['藤澤','大船','江之島・藤澤','小田原','藤澤','鎌倉・腰越','東京・浜町','丸之內・芝','豐洲・柴又・銀座・新橋','淺草・上野','澀谷','越谷','自由安排','人形町・成田']
 old={d['date']:d for d in trip['days']};days=[{**old[date],'events':[]} for date in DATES];count=0
 for ri,row in enumerate(rows[head+1:],head+1):
  time=normalize_time(row[0] if row else '');lodging=''
  for ci,day in enumerate(days,1):
   raw=str(row[ci] or '').strip() if len(row)>ci else ''
   if time=='22:00' and ci in (7,14):lodging=''
   if time=='22:00' and raw.startswith('東橫INN'):lodging=raw
   inherited=bool(time=='22:00' and not raw and lodging and ci<14)
   if not raw and not inherited:continue
   if raw:count+=1
   text=public_text(raw or lodging);title=re.sub(r'^\d{1,2}:\d{2}\s*','',text);title=re.sub(r'★\s*[0-5](?:\.\d+)?\s*','',title).strip()
   if '久昇' in title:continue
   explicit=normalize_time(text);ids=[v['id'] for v in trip['venues'] if any(note_key(k) in note_key(title) for k in v['keys'])]
   venue=next((v for v in trip['venues'] if v['id'] in ids),None)
   nav=(venue['ja']+' '+venue['address']).strip() if venue else title
   if '住宿據點' in title:nav='藤沢駅' if '藤澤' in title else '浜町駅'
   if '成田 Terminal' in title or '京成 Access' in title or '班機起飛' in title:nav='成田空港第2ターミナル'
   if title.startswith('成田空港') or '成田機場>' in title:nav='藤沢駅' if '藤澤' in title else '浜町駅'
   day['events'].append({'id':f'sheet-{day["date"]}-r{ri+1}','time':explicit or time,'title':title,'note':'','map':'','raw':text,'cell':chr(65+ci)+str(ri+1),'inherited':inherited,'slot':time,'explicit':bool(explicit),'origin':'sheet','venueIds':ids,'navigation':nav,'area':areas[ci-1]})
 if count==0:raise ValueError('Empty grid')
 for i,d in enumerate(days):
  d['events'].sort(key=lambda e:int(e['time'][:2])*60+int(e['time'][3:]) if e['time'] else 1440)
  if not d['events'] and i!=12:raise ValueError('A populated day was removed; review manually')
  d['guide']['area']=areas[i]
 # Current route-specific guidance; do not resurrect baseline attractions.
 guidance={
  8:('A豐洲／B柴又 → 銀座 → 新橋','A組可由浜町經森下、月島轉有樂町線至豐洲，再步行或搭百合海鷗號至新豐洲；B組從東日本橋往京成高砂轉金町線至柴又。依最新表在銀座會合，晚間至新橋看大時計；KITTE在12/20，不混入今天。',['metro','toei','keisei']),
  9:('浅草 → 上野','淺草與上野之間可搭銀座線；淺草早間參拜後再前往上野。不同藥妝分店請確認店名，敘敘苑訂位日期與所在欄位不一致，先核對再出發。',['metro']),
  10:('澀谷 → 青之洞窟（如公告）','澀谷站依出口走往Loft；藍色點燈以2026主辦公告為準。原表餐廳標記12/22卻放在12/23欄，請核對實際預約。',['metro']),
  12:('自由安排','原表尚未安排景點。保留彈性、休息與採買，不自動塞入舊版豪德寺路線。',['metro'])}
 for i,(route,text,sources) in guidance.items():days[i]['guide'].update(route=route,text=text,sources=sources)
 trip['days']=days
 # Surface date conflicts rather than silently correcting a reservation.
 trip['decisions']=[x for x in trip['decisions'] if not x['id'].startswith('date-conflict-')]
 for d in days:
  for e in d['events']:
   m=re.match(r'^12/(\d+)\s',e['raw'])
   if m and int(m[1])!=int(d['date'][-2:]):trip['decisions'].append({'id':'date-conflict-'+e['id'],'title':d['date'][5:]+' 預約日期錯置','text':f'原文標記12/{m[1]}，卻放在{d["date"][5:]}欄。請核對分店、預約日期與時間。','level':'risk','day':d['id']})
 for c,d in zip(trip['covers'],days):
  if d['number']==13:c['title']='聖誕留白：今天，慢慢來';c['keys']=[]
 trip['sourceCellCount']=count
 return trip

def main():
 ap=argparse.ArgumentParser();ap.add_argument('--rows',type=Path);ap.add_argument('--check',action='store_true');args=ap.parse_args()
 trip=json.loads((ROOT/'trip.json').read_text())
 if args.rows:rows=json.loads(args.rows.read_text())
 else:
  url=os.environ.get('GOOGLE_SHEET_CSV_URL')
  if not url:raise SystemExit('GOOGLE_SHEET_CSV_URL missing; previous data preserved')
  request=urllib.request.Request(url,headers={'User-Agent':'TokyoTrip compiler'})
  with urllib.request.urlopen(request,timeout=30) as r:text=r.read(2000000).decode('utf-8-sig')
  if text.lstrip().startswith('<'):raise SystemExit('Received login/HTML instead of CSV')
  rows=list(csv.reader(io.StringIO(text)))
 previous=json.dumps(trip,ensure_ascii=False,separators=(',',':'));trip=compile_rows(rows,trip)
 # A no-change sync does not manufacture new source verification dates.
 content=json.dumps(trip,ensure_ascii=False,separators=(',',':'))
 if not args.check and content!=previous:
  trip['updatedAt']=datetime.datetime.now(datetime.timezone.utc).isoformat();target=ROOT/'trip.json';temp=target.with_suffix('.tmp');temp.write_text(json.dumps(trip,ensure_ascii=False,separators=(',',':')));temp.replace(target)
 print(f'Validated 14 days and {trip["sourceCellCount"]} non-empty cells')
if __name__=='__main__':main()
