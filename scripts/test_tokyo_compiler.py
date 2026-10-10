#!/usr/bin/env python3
"""Regression checks with synthetic rows; never store a private Sheet fixture."""
import copy
import json
import unittest
import build_tokyo as b


class CompilerRegression(unittest.TestCase):
    def setUp(self):
        self.trip = json.loads((b.ROOT / 'trip.json').read_text())
        self.rows = [
            ['時間'] + [f'12/{n}' for n in range(13, 27)],
            ['09:00'] + [f'當日行程 {n}' for n in range(13, 27)],
        ]

    def compile(self, rows=None):
        return b.compile_rows(copy.deepcopy(rows or self.rows), copy.deepcopy(self.trip))

    def test_authorized_swap_and_changed_source_guard(self):
        import hashlib
        rows=copy.deepcopy(self.rows)
        def basis(col):
            return hashlib.sha256(json.dumps([[i+1,b.public_text(str(r[col]))] for i,r in enumerate(rows[1:],1) if r[col]],ensure_ascii=False).encode()).hexdigest()
        config={'dates':['2026-12-22','2026-12-25'],'sourceBasis':[basis(10),basis(13)],'additions':[]}
        swapped,_=b.authorized_rows(rows,config)
        self.assertEqual(swapped[1][10],rows[1][13])
        self.assertEqual(swapped[1][13],rows[1][10])
        again,_=b.authorized_rows(swapped,config)
        self.assertEqual(again,swapped)
        self.assertEqual(rows,self.rows)
        changed=copy.deepcopy(rows);changed[1][10]='changed new route'
        with self.assertRaises(ValueError):b.authorized_rows(changed,config)

    def test_all_dates_and_stable_row_ids(self):
        first = self.compile()
        rows = copy.deepcopy(self.rows)
        rows[1][1] = '10:30 當日行程 13'
        second = self.compile(rows)
        self.assertEqual([d['date'] for d in second['days']], b.DATES)
        self.assertEqual(first['sourceCellCount'], 14)
        self.assertEqual([d['events'][0]['id'] for d in first['days']],
                         [d['events'][0]['id'] for d in second['days']])
        self.assertEqual(second['days'][0]['events'][0]['time'], '10:30')

    def test_reservation_time_keeps_date_conflict(self):
        self.rows[1][10] = '12/23\n12:30 叙叙苑 上野丸井店 測試人已訂位 訂位碼：SECRET123'
        trip = self.compile()
        event = trip['days'][9]['events'][0]
        self.assertEqual(event['time'], '12:30')
        self.assertTrue(event['raw'].startswith('12/23'))
        self.assertNotIn('測試人', event['raw'])
        self.assertNotIn('SECRET123', event['raw'])
        self.assertTrue(any(d['id'] == 'date-conflict-' + event['id'] and d['level'] == 'risk'
                            for d in trip['decisions']))

    def test_closed_day_and_after_closing_are_flagged(self):
        self.rows[1][1] = '16:30 清淨光寺 (遊行寺)'
        self.rows[1][4] = 'UIROU Main Store'
        trip = self.compile()
        for index in (0, 3):
            alerts = trip['days'][index]['events'][0]['alerts']
            self.assertTrue(alerts)
            self.assertTrue(all(a['source'].startswith('https://') and a['checked'] for a in alerts))

    def test_route_explanation_invalidates_without_changing_state_ids(self):
        trip = self.compile()
        guide = trip['days'][0]['guide']
        self.assertIn('路線已變更', guide['title'])
        self.assertEqual(guide['sources'], [])
        self.assertEqual(trip['days'][0]['events'][0]['id'], 'sheet-2026-12-13-r2')
        self.assertEqual(b.compile_rows(copy.deepcopy(self.rows), copy.deepcopy(trip)), trip)

    def test_bad_snapshots_and_private_patch_keys_fail(self):
        bad = copy.deepcopy(self.rows)
        bad[0][5] = '12/16'
        with self.assertRaises(ValueError):
            self.compile(bad)
        with self.assertRaises(ValueError):
            b.compile_rows([self.rows[0]], copy.deepcopy(self.trip))
        with self.assertRaises(ValueError):
            b.apply_enrichment(copy.deepcopy(self.trip), {'rawRows': self.rows})
        with self.assertRaises(ValueError):
            b.apply_enrichment(copy.deepcopy(self.trip), {'guides': {'2026-12-27': {}}})
        bad_covers = copy.deepcopy(self.trip['covers'])
        bad_covers[0]['image'] = 'https://example.invalid/cover.webp'
        with self.assertRaises(ValueError):
            b.apply_enrichment(copy.deepcopy(self.trip), {'covers': bad_covers})


if __name__ == '__main__':
    unittest.main()
