/** @OnlyCurrentDoc
 * Tokyo trip website add-stop receiver.
 * The shared write key lives in Script Properties, never in GitHub.
 */
const SPREADSHEET_ID = '156UgwNFMgtzfKZjPQSCtm1svb6Mk6LTPNtOwE0EI0Gw';
const DESTINATION_TAB = '網站新增站點';

function setupWriteKey() {
  const key = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  PropertiesService.getScriptProperties().setProperty('WRITE_KEY', key);
  Logger.log('Copy this key into the Tokyo trip page settings now. Keep it private: ' + key);
}

function doGet() {
  return HtmlService.createHtmlOutput('<!doctype html><meta charset="utf-8"><title>Tokyo trip write endpoint</title><p>東京行程寫入服務已啟動。請由旅遊頁新增站點。</p>');
}

function doPost(e) {
  const p = e && e.parameter ? e.parameter : {};
  try {
    const expected = PropertiesService.getScriptProperties().getProperty('WRITE_KEY') || '';
    if (!expected || !constantTimeEquals_(String(p.key || ''), expected)) {
      return receipt_(false, '寫入驗證失敗，請回旅遊頁確認設定。', '');
    }
    if (String(p.website || '').trim()) return receipt_(false, '送出資料未通過檢查。', '');
    const row = validate_(p);
    const lock = LockService.getScriptLock();
    if (!lock.tryLock(10000)) return receipt_(false, '系統忙碌，請稍後再試。', '');
    try {
      const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(DESTINATION_TAB);
      if (!sheet) return receipt_(false, '找不到「網站新增站點」分頁，請確認試算表設定。', '');
      if (sheet.getLastRow() < 1) {
        sheet.appendRow(['ID', '日期', '時間', '景點名稱', '備註', '地圖連結', '新增時間', '狀態']);
      }
      const lastRow = sheet.getLastRow();
      if (lastRow > 1) {
        const found = sheet.getRange(2, 1, lastRow - 1, 1).createTextFinder(row.id).matchEntireCell(true).findNext();
        if (found) return receipt_(true, '這筆站點已經寫入過，沒有重複新增。', row.title);
      }
      const createdAt = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
      sheet.appendRow([
        row.id, row.date, row.time, safeCell_(row.title), safeCell_(row.note),
        safeCell_(row.map), createdAt, '待併入行程'
      ]);
      return receipt_(true, '已新增至 Google Sheet「網站新增站點」分頁。', row.title);
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    return receipt_(false, '資料格式不符或寫入失敗。請回旅遊頁確認欄位後再試。', '');
  }
}

function validate_(p) {
  const row = {
    id: String(p.requestId || '').trim(),
    date: String(p.date || '').trim(),
    time: String(p.time || '').trim(),
    title: String(p.title || '').trim(),
    note: String(p.note || '').trim(),
    map: String(p.map || '').trim()
  };
  if (!/^[A-Za-z0-9_-]{8,100}$/.test(row.id)) throw new Error('id');
  if (!/^2026-12-(1[3-9]|2[0-6])$/.test(row.date)) throw new Error('date');
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(row.time)) throw new Error('time');
  if (!row.title || row.title.length > 300 || row.note.length > 4000 || row.map.length > 300) throw new Error('length');
  return row;
}

function safeCell_(value) {
  return /^[=+\-@]/.test(value) ? "'" + value : value;
}

function constantTimeEquals_(a, b) {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

function receipt_(ok, message, title) {
  const color = ok ? '#1f5a43' : '#9b2f39';
  return HtmlService.createHtmlOutput(
    '<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>新增站點結果</title><body style="font:20px/1.7 system-ui,sans-serif;background:#fbf8ef;color:#19382f;padding:24px;max-width:680px;margin:8vh auto">' +
    '<main style="background:white;border:2px solid ' + color + ';border-radius:14px;padding:24px">' +
    '<h1 style="color:' + color + ';font-size:1.5em">' + (ok ? '完成' : '尚未完成') + '</h1>' +
    '<p>' + escapeHtml_(message) + '</p>' + (title ? '<p><strong>' + escapeHtml_(title) + '</strong></p>' : '') +
    '<p>可以回到原本的旅遊頁繼續安排行程。</p></main></body></html>'
  ).setTitle('新增站點結果');
}

function escapeHtml_(value) {
  return String(value).replace(/[&<>"']/g, function(ch) {
    return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[ch];
  });
}
