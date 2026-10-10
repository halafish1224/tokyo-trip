#!/usr/bin/env python3
"""Compile validated Sheet rows into the sole public trip.json. No model rewrites HTML."""
import argparse,csv,datetime,hashlib,io,json,re,urllib.request,os
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]/'2026/tokyo'
DATES=[f'2026-12-{n}' for n in range(13,27)]
def normalize_time(value):
 m=re.match(r'^(\d{1,2}):(\d{2})',str(value or '').strip())
 if m and int(m[1])<24 and int(m[2])<60:return f'{int(m[1]):02}:{m[2]}'
 return ''
def event_time(value):
 # A reservation may start with a date on the same line or the preceding line.
 # Keep that date in the public original so a column/date mismatch stays visible.
 return normalize_time(re.sub(r'^12/\d{1,2}\s+', '', str(value or '').strip()))
def public_text(text):
 text=re.sub(r'https://docs\.google\.com/\S+','',text)
 text=re.sub(r'[\u4e00-\u9fff]{2,4}(?:已)?訂位','預約待確認',text)
 text=re.sub(r'(訂位碼|訂房碼|預約番号|房號|保險單號)\s*[:：]?\s*[^\s，。\n]+',r'\1：請見私人筆記',text)
 text=re.sub(r'東橫INN藤澤站北口','藤澤住宿據點',text)
 text=re.sub(r'東橫INN東京站新大橋前','浜町住宿據點',text)
 text=re.sub(r'\s*[（(]CI10[45][）)]','',text)
 text=re.sub(r'[（(][^）)]*久昇[^）)]*[）)]','',text)
 text=re.sub(r'\b[A-Z][a-z]{1,29}(?=英文漫畫)','',text)
 return text.strip()
def note_key(s):return re.sub(r'\s','',s).lower()
def route_basis(events):
 # Time corrections do not count as destination changes.
 titles=[re.sub(r'^(?:12/\d{1,2}\s+)?(?:\d{1,2}:\d{2}\s*)?', '', e['title']) for e in events if not e['inherited']]
 return hashlib.sha256('\n'.join(titles).encode()).hexdigest()[:16]
def apply_enrichment(trip,patch):
 # Only public, researched metadata. The private row snapshot is a separate input.
 allowed={'venues','travel','decisions','sources','foods','places','guides','covers','seniorStops','optionalEvents'}
 if not isinstance(patch,dict) or set(patch)-allowed:raise ValueError('Unexpected enrichment keys')
 guides=patch.get('guides',{})
 if set(guides)-set(DATES):raise ValueError('Unexpected guide date')
 covers=patch.get('covers')
 if covers is not None:
  if not isinstance(covers,list) or len(covers)!=len(DATES):raise ValueError('Expected 14 covers')
  for date,cover in zip(DATES,covers):
   expected=f'images/covers/{date[5:7]}{date[8:]}.webp'
   if not isinstance(cover,dict) or cover.get('date')!=date or cover.get('image')!=expected:raise ValueError('Cover date/path mismatch')
   if not (ROOT/expected).is_file() or not str(cover.get('source','')).startswith('https://commons.wikimedia.org/'):raise ValueError('Cover must be local with a Commons source')
   if not all(str(cover.get(k,'')).strip() for k in ('title','caption','author','license','licenseUrl')):raise ValueError('Incomplete cover credit')
 for key,value in patch.items():
  if key!='guides':trip[key]=value
 for day in trip['days']:
  if day['date'] in guides:day['guide']={**day['guide'],**guides[day['date']]}
 return set(guides)
def validate_senior_stops(trip):
 events={e['id']:e for d in trip['days'] for e in d['events']}
 stops=trip.get('seniorStops',[])
 if not isinstance(stops,list):raise ValueError('Expected seniorStops list')
 seen=set()
 for stop in stops:
  if not isinstance(stop,dict) or not all(str(stop.get(k,'')).strip() for k in ('eventId','anchor','for','name','ja','address','hours','why','source','checked','status')):raise ValueError('Incomplete senior stop')
  event=events.get(stop['eventId'])
  if not event or not '2026-12-20'<=stop['eventId'][6:16]<='2026-12-25' or stop['anchor'] not in event['title']:raise ValueError('Senior stop route anchor no longer matches Sheet: '+stop['eventId'])
  if not stop['source'].startswith('https://') or not re.fullmatch(r'\d{4}-\d{2}-\d{2}',stop['checked']):raise ValueError('Senior stop source/date missing')
  if stop['status'] not in ('官方已核實','待核對'):raise ValueError('Unexpected senior stop status')
  key=(stop['eventId'],stop['for'])
  if key in seen:raise ValueError('Duplicate senior stop: '+stop['eventId'])
  seen.add(key)
def validate_optional_events(trip):
 dates=set(DATES);seen=set()
 for item in trip.get('optionalEvents',[]):
  if not isinstance(item,dict) or not all(str(item.get(k,'')).strip() for k in ('id','date','title','ja','address','hours','route','caution','source','checked','status')):raise ValueError('Incomplete optional event')
  if item['id'] in seen or item['date'] not in dates or item['status']!='官方已核實' or not item['source'].startswith('https://') or not re.fullmatch(r'\d{4}-\d{2}-\d{2}',item['checked']):raise ValueError('Invalid optional event')
  seen.add(item['id'])
def check_availability(day,event,venues):
 alerts=[]
 for v in venues:
  rule=v.get('availability',{})
  if not rule or not rule.get('from','0000')<=day['date']<=rule.get('through','9999'):continue
  weekday=datetime.date.fromisoformat(day['date']).weekday()
  if weekday in rule.get('closedWeekdays',[]):text=f'{v["ja"]}：此日為官網列示的固定休息日；請調整安排。'
  elif event['time'] and event['time']<rule.get('open','00:00'):text=f'{v["ja"]}：表內{event["time"]}早於開門{rule["open"]}；外觀散步不表示可入館。'
  elif event['time'] and event['time']>=rule.get('lastEntry',rule.get('close','24:00')):text=f'{v["ja"]}：表內{event["time"]}已超過入內時段（{rule.get("lastEntry",rule.get("close"))}）；請調整安排。'
  else:continue
  alerts.append({'venueId':v['id'],'text':text,'source':v['official'],'checked':v['checked']})
 return alerts
def authorized_rows(rows,config=None):
 config=config if config is not None else json.loads((ROOT/'research/user-schedule.json').read_text())
 head=next((i for i,r in enumerate(rows) if sum(bool(re.search(r'12/\d+',str(x or ''))) for x in r[1:])==14),None)
 if head is None:raise ValueError('Must include complete date header')
 cols=[DATES.index(date)+1 for date in config['dates']]
 def basis(col):return hashlib.sha256(json.dumps([[i+1,public_text(str(r[col] or '').strip())] for i,r in enumerate(rows[head+1:],head+1) if len(r)>col and r[col]],ensure_ascii=False).encode()).hexdigest()
 actual=[basis(col) for col in cols];expected=config['sourceBasis']
 if actual==expected:
  rows=[list(r) for r in rows]
  for r in rows[head+1:]:
   r.extend(['']*(15-len(r)))
   r[cols[0]],r[cols[1]]=r[cols[1]],r[cols[0]]
 elif actual!=expected[::-1]:raise ValueError('Authorized day swap source changed; review new Sheet before publishing')
 return rows,config

def compile_rows(rows,trip,enriched_guides=(),schedule=None):
 head=next((i for i,r in enumerate(rows) if sum(bool(re.search(r'12/\d+',str(x or ''))) for x in r[1:])==14),None)
 if head is None:raise ValueError('Must include all 14 date columns')
 actual=[f'2026-{int(m[1]):02}-{int(m[2]):02}' if (m:=re.search(r'(\d+)/(\d+)',str(x))) else '' for x in rows[head][1:15]]
 if actual!=DATES:raise ValueError('Unexpected dates; preserving previous bundle')
 areas=['藤澤','江之島・藤澤','大船','小田原','藤澤','鎌倉・腰越','東京・浜町','丸之內・銀座・新橋','豐洲・柴又・芝公園','築地','澀谷・代代木','越谷','淺草・上野','浜町・成田']
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
   explicit=event_time(text);matched=[v for v in trip['venues'] if any(note_key(k) in note_key(title) for k in v['keys'])];ids=[v['id'] for v in matched]
   venue=next((v for v in matched if v.get('address') and not v.get('candidate')),None) or next((v for v in matched if not v.get('candidate')),None)
   nav=(venue['ja']+' '+venue['address']).strip() if venue else title
   if '住宿據點' in title:nav='藤沢駅' if '藤澤' in title else '浜町駅'
   if '成田 Terminal' in title or '京成 Access' in title or '班機起飛' in title:nav='成田空港第2ターミナル'
   if title.startswith('成田空港') or '成田機場>' in title:nav='藤沢駅' if '藤澤' in title else '浜町駅'
   event={'id':f'sheet-{day["date"]}-r{ri+1}','time':explicit or time,'title':title,'note':'','map':'','raw':text,'cell':chr(65+ci)+str(ri+1),'inherited':inherited,'slot':time,'explicit':bool(explicit),'origin':'sheet','venueIds':ids,'navigation':nav,'area':areas[ci-1]}
   alerts=check_availability(day,event,matched)
   if alerts:event['alerts']=alerts
   day['events'].append(event)
 if count==0:raise ValueError('Empty grid')
 for item in (schedule or {}).get('additions',[]):
  day=next(d for d in days if d['date']==schedule['dates'][0])
  day['events'].append({**item,'note':'使用者追加的手冊規劃；時間為建議，可依體力調整。','map':'','raw':item['title'],'cell':'','inherited':False,'slot':item['time'],'explicit':True,'origin':'user-plan','venueIds':[],'area':'築地'})
 for i,d in enumerate(days):
  d['events'].sort(key=lambda e:int(e['time'][:2])*60+int(e['time'][3:]) if e['time'] else 1440)
  if not d['events'] and i!=12:raise ValueError('A populated day was removed; review manually')
  d['guide']['area']=areas[i]
  basis=route_basis(d['events']);previous=d['guide'].get('routeBasis')
  if previous and previous!=basis and d['date'] not in enriched_guides:
   names=list(dict.fromkeys(v['ja'] for e in d['events'] for v in trip['venues'] if v['id'] in e['venueIds']))
   d['guide'].update(title=areas[i]+'・路線已變更',route=' → '.join(names) or areas[i],text='路線已依最新表更新；跨區交通與營業時段待重新核對。',note='上次路線說明已停用，請逐站核對。',sources=[])
  d['guide']['routeBasis']=basis
 trip['days']=days
 # Surface date conflicts rather than silently correcting a reservation.
 trip['decisions']=[x for x in trip['decisions'] if not x['id'].startswith(('date-conflict-','availability-'))]
 for d in days:
  for e in d['events']:
   m=re.match(r'^12/(\d+)\s',e['raw'])
   if m and int(m[1])!=int(d['date'][-2:]):trip['decisions'].append({'id':'date-conflict-'+e['id'],'title':d['date'][5:]+' 預約日期錯置','text':f'原文標記12/{m[1]}，卻放在{d["date"][5:]}欄。請核對分店、預約日期與時間。','level':'risk','day':d['id']})
   for a in e.get('alerts',[]):trip['decisions'].append({'id':'availability-'+e['id']+'-'+a['venueId'],'title':d['date'][5:]+' 開放時段衝突','text':a['text'],'source':a['source'],'checked':a['checked'],'level':'risk','day':d['id']})
 trip['sourceCellCount']=count
 return trip

def main():
 ap=argparse.ArgumentParser();ap.add_argument('--rows',type=Path);ap.add_argument('--enrichment',type=Path);ap.add_argument('--check',action='store_true');args=ap.parse_args()
 trip=json.loads((ROOT/'trip.json').read_text())
 if args.rows:rows=json.loads(args.rows.read_text())
 else:
  url=os.environ.get('GOOGLE_SHEET_CSV_URL')
  if not url:raise SystemExit('GOOGLE_SHEET_CSV_URL missing; previous data preserved')
  request=urllib.request.Request(url,headers={'User-Agent':'TokyoTrip compiler'})
  with urllib.request.urlopen(request,timeout=30) as r:text=r.read(2000000).decode('utf-8-sig')
  if text.lstrip().startswith('<'):raise SystemExit('Received login/HTML instead of CSV')
  rows=list(csv.reader(io.StringIO(text)))
 previous=json.dumps(trip,ensure_ascii=False,separators=(',',':'))
 enriched=apply_enrichment(trip,json.loads(args.enrichment.read_text())) if args.enrichment else set()
 rows,schedule=authorized_rows(rows)
 trip=compile_rows(rows,trip,enriched,schedule)
 validate_senior_stops(trip)
 validate_optional_events(trip)
 # A no-change sync does not manufacture new source verification dates.
 content=json.dumps(trip,ensure_ascii=False,separators=(',',':'))
 if not args.check and content!=previous:
  trip['updatedAt']=datetime.datetime.now(datetime.timezone.utc).isoformat();target=ROOT/'trip.json';temp=target.with_suffix('.tmp');temp.write_text(json.dumps(trip,ensure_ascii=False,separators=(',',':')));temp.replace(target)
 print(f'Validated 14 days and {trip["sourceCellCount"]} non-empty cells')
if __name__=='__main__':main()
