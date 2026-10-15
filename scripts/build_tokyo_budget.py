#!/usr/bin/env python3
"""Compile the bounded budget tab into trip.json; never touch personal expenses."""
import argparse
import csv
import datetime
import io
import json
import math
import os
from pathlib import Path
import urllib.request

ROOT = Path(__file__).resolve().parents[1] / '2026/tokyo'
DATES = [f'2026-12-{n}' for n in range(13, 27)]

def compile_budget(rows):
    def cell(row, col):
        try:
            return rows[row-1][col-1]
        except IndexError:
            raise ValueError(f'Missing budget cell {row},{col}')
    def number(row, col):
        value = float(cell(row, col))
        if not math.isfinite(value) or value < 0:
            raise ValueError('Invalid budget amount')
        return int(value) if value.is_integer() else value
    if str(cell(4, 1)) != '日期' or str(cell(4, 4)) != '低估(JPY/人)' or str(cell(10, 10)) != 'P2機場交通｜12/19':
        raise ValueError('Budget tab layout changed; inspect before publishing')
    rate = number(2, 2)
    if not 0 < rate < 10:
        raise ValueError('Invalid JPY/TWD estimate')
    checked = str(cell(13, 11))
    datetime.date.fromisoformat(checked)
    daily = []
    for i, date in enumerate(DATES, 5):
        if str(cell(i, 1)) != date[5:].replace('-', '/'):
            raise ValueError('Budget date mismatch')
        low, high = number(i, 4), number(i, 5)
        if low > high:
            raise ValueError('Inverted budget range')
        estimates = [{'traveler': 'p1', 'minJPY': low, 'maxJPY': high}]
        if date >= '2026-12-19':
            estimates.append({'traveler': 'p2', 'minJPY': number(11, 11) if date.endswith('-19') else low,
                              'maxJPY': number(11, 13) if date.endswith('-19') else high})
        if any(e['minJPY'] > e['maxJPY'] for e in estimates):
            raise ValueError('Inverted traveler range')
        daily.append({'date': date, 'route': str(cell(i, 3)), 'note': str(cell(i, 8)), 'estimates': estimates})
    # A price marked "from" is retained as a provisional allowance, not a confirmed 15-day price.
    starting = number(3, 13)
    sims = [
        {'traveler': 'p1', 'start': DATES[0], 'days': 15, 'tripDays': 14,
         'allowanceTWD': math.ceil(starting * rate / 10) * 10, 'startingJPY': starting,
         'status': '暫估・15日實價待確認', 'spec': str(cell(3, 12)), 'note': str(cell(3, 14)),
         'source': str(cell(6, 11)), 'checked': checked},
        {'traveler': 'p2', 'start': '2026-12-19', 'days': 8, 'tripDays': 8,
         'allowanceTWD': number(4, 13), 'status': '沿用行程表估價・購買前核對',
         'spec': str(cell(4, 12)), 'note': str(cell(4, 14)), 'source': str(cell(6, 13)), 'checked': checked}
    ]
    # Existing tab places the P2 URL in M6; label/URL changes must be reviewed.
    for sim in sims:
        if not sim['source'].startswith('https://'):
            raise ValueError('SIM source URL missing')
    summaries = []
    for traveler, row in [('p1', 19), ('p2', 20)]:
        values = [e for d in daily for e in d['estimates'] if e['traveler'] == traveler]
        low, high = sum(e['minJPY'] for e in values), sum(e['maxJPY'] for e in values)
        if (low, high) != (number(row, 4), number(row, 5)):
            raise ValueError('Sheet summary does not match traveler-specific daily amounts')
        summaries.append({'traveler': traveler, 'minJPY': low, 'maxJPY': high})
    return {'version': 1, 'checked': checked, 'exchangeRate': rate,
            'unit': '每位成人／每張SIM', 'daily': daily, 'summaries': summaries, 'sims': sims,
            'pass': {'priceJPY': 2000, 'budgetDate': '2026-12-20', 'hours': 72,
                     'activation': None, 'note': '首次使用時間待確認；自啟用起72小時。票券費已於12/20估列一次；僅涵蓋Metro與都營地鐵。',
                     'source': 'https://www.tokyometro.jp/en/ticket/travel/index.html'},
            'sources': [
                {'label': '京成 Access Express 票價', 'url': 'https://www.keisei.co.jp/keisei/tetudou/skyliner/us/traffic/express_fares.php'},
                {'label': '匯率估算參考', 'url': 'https://www.xe.com/currencyconverter/convert/?Amount=1&From=JPY&To=TWD'}],
            'note': '一般交通預算，含地鐵券一次；不含SIM、門票、餐飲與計程車。N’EX套票須按實際購買方式調整，避免重複加總。'}

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--rows', type=Path, help='JSON values from the budget tab A1:N20')
    args = parser.parse_args()
    if args.rows:
        rows = json.loads(args.rows.read_text())
    else:
        url = os.environ.get('GOOGLE_BUDGET_CSV_URL')
        if not url:
            raise SystemExit('GOOGLE_BUDGET_CSV_URL missing; budget bundle preserved')
        with urllib.request.urlopen(url, timeout=30) as response:
            text = response.read(200000).decode('utf-8-sig')
        if text.lstrip().startswith('<'):
            raise SystemExit('Budget returned HTML; previous bundle preserved')
        rows = list(csv.reader(io.StringIO(text)))
    budget = compile_budget(rows)
    path = ROOT / 'trip.json'
    trip = json.loads(path.read_text())
    if trip.get('budget') != budget:
        trip['budget'] = budget
        temp = path.with_suffix('.tmp')
        temp.write_text(json.dumps(trip, ensure_ascii=False, separators=(',', ':')))
        temp.replace(path)
    print('Validated 14 budget dates, P1/P2 summaries, and per-line SIM allowances')

if __name__ == '__main__':
    main()
