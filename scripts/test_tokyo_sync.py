import unittest
from plan_tokyo_sync import baseline,plan,protect_web_edits
class Sync(unittest.TestCase):
 def test_sheet_only(self):self.assertEqual(plan(baseline({'K5':'old'}),{'K5':'new'},{'K5':'old'})['actions'][0]['to'],'website')
 def test_web_only(self):self.assertEqual(plan(baseline({'K5':'old'}),{'K5':'old'},{'K5':'new'})['actions'][0]['to'],'sheet')
 def test_independent_merge(self):self.assertEqual(len(plan(baseline({'K5':'a','N5':'b'}),{'K5':'a2','N5':'b'},{'K5':'a','N5':'b2'})['actions']),2)
 def test_latest_cell_wins(self):self.assertEqual(plan(baseline({'K5':'old'}),{'K5':'sheet'},{'K5':'web'},{'K5':{'sheet':'2026-10-10T04:00:00Z','website':'2026-10-10T05:00:00+00:00'}})['actions'][0]['from'],'website')
 def test_no_guess_without_cell_time(self):self.assertEqual(len(plan(baseline({'K5':'old'}),{'K5':'sheet'},{'K5':'web'})['conflicts']),1)
 def test_csv_guard_preserves_unsynced_web_change(self):
  rows=[['時間']+[f'12/{n}' for n in range(13,27)],['09:00']+['']*14];rows[1][10]='old'
  trip={'days':[{'events':[{'cell':'K2','raw':'new','time':'09:00','slot':'09:00','inherited':False}]}]}
  with self.assertRaisesRegex(ValueError,'K2'):protect_web_edits(rows,trip,{'cells':baseline({'K2':'old'})},lambda x:x)
  rows[1][10]='new';protect_web_edits(rows,trip,{'cells':baseline({'K2':'old'})},lambda x:x)
 def test_delete_and_idempotent(self):
  self.assertEqual(plan(baseline({'K5':'old'}),{}, {'K5':'old'})['actions'][0]['value'],'')
  self.assertEqual(plan(baseline({'K5':'new'}),{'K5':'new'},{'K5':'new'}),{'actions':[],'conflicts':[]})
if __name__=='__main__':unittest.main()
