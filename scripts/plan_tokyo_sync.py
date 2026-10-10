#!/usr/bin/env python3
"""Plan a public, per-cell three-way sync. Connector performs verified writes."""
import argparse,datetime,hashlib,json,re
from pathlib import Path

def digest(value):return hashlib.sha256(value.encode()).hexdigest()
def sheet_cells(rows,public_text):
 head=next((i for i,r in enumerate(rows) if sum(bool(re.search(r'12/\d+',str(x or ''))) for x in r[1:])==14),None)
 if head is None:raise ValueError('Complete 14-day header required')
 dates=[re.search(r'12/(\d+)',str(x)).group(1) for x in rows[head][1:15]]
 if dates!=[str(n) for n in range(13,27)]:raise ValueError('Unexpected date columns')
 return {chr(65+ci)+str(ri+1):public_text(str(row[ci] or '').strip()) for ri,row in enumerate(rows[head+1:100],head+1) for ci in range(1,15) if len(row)>ci and str(row[ci] or '').strip()}
def website_cells(trip,public_text):
 cells={}
 for day in trip['days']:
  for e in day['events']:
   if e.get('inherited') or not e.get('cell'):continue
   cell=e['cell']
   if not re.fullmatch(r'[B-O](?:[2-9]|[1-9][0-9]|100)',cell):raise ValueError('Unsupported source cell')
   if cell in cells:raise ValueError('Duplicate source cell')
   raw=public_text(e['raw']);expected=re.sub(r'^(?:12/\d+\s+)?','',raw)
   m=re.match(r'^(\d{1,2}):(\d{2})',expected)
   time=f'{int(m[1]):02}:{m[2]}' if m else e.get('slot','')
   if e['time'] and e['time']!=time:
    raw=re.sub(r'^(12/\d+\s+)?(?:\d{1,2}:\d{2}\s*)?',lambda m:(m[1] or '')+e['time']+' ',raw,count=1)
   cells[cell]=raw
 return cells

def latest(a,b):
 try:
  a=datetime.datetime.fromisoformat(a.replace('Z','+00:00'));b=datetime.datetime.fromisoformat(b.replace('Z','+00:00'))
  if a.tzinfo is None or b.tzinfo is None:return None
  return 'sheet' if a>b else 'website' if b>a else None
 except (ValueError,AttributeError):return None

def plan(base,sheet,website,times=None):
 times=times or {};actions=[];conflicts=[]
 for cell in sorted(set(base)|set(sheet)|set(website)):
  s=sheet.get(cell,'');w=website.get(cell,'');sh=digest(s);wh=digest(w);original=base.get(cell,digest(''))
  if sh==wh:continue
  sc=sh!=original;wc=wh!=original
  source='sheet' if sc and not wc else 'website' if wc and not sc else latest(times.get(cell,{}).get('sheet'),times.get(cell,{}).get('website'))
  if source is None:conflicts.append({'cell':cell,'reason':'Both changed; verified cell-specific timestamps required'})
  else:actions.append({'cell':cell,'from':source,'to':'website' if source=='sheet' else 'sheet','value':s if source=='sheet' else w})
 return {'actions':actions,'conflicts':conflicts}

def baseline(cells):return {key:digest(value) for key,value in cells.items() if value}
def protect_web_edits(rows,trip,state,public_text):
 result=plan(state['cells'],sheet_cells(rows,public_text),website_cells(trip,public_text))
 blocked=[x['cell'] for x in result['actions'] if x['to']=='sheet']+[x['cell'] for x in result['conflicts']]
 if blocked:raise ValueError('Bidirectional sync required before CSV compilation: '+','.join(blocked))

def main():
 import build_tokyo as b
 ap=argparse.ArgumentParser();ap.add_argument('--rows',type=Path,required=True);ap.add_argument('--times',type=Path);args=ap.parse_args()
 rows=json.loads(args.rows.read_text());trip=json.loads((b.ROOT/'trip.json').read_text());state=json.loads((b.ROOT/'research/sync-state.json').read_text())
 print(json.dumps(plan(state['cells'],sheet_cells(rows,b.public_text),website_cells(trip,b.public_text),json.loads(args.times.read_text()) if args.times else None),ensure_ascii=False,indent=2))
if __name__=='__main__':main()
