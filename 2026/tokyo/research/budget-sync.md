# 交通與 Nippon SIM 預算

Google Sheet 的「交通與網路費用預估」是預算編輯來源。網站只讀取公開 `trip.json` 的 `budget`，不在執行期存取 Sheet；實際個人支出維持在裝置內。

## 更新

1. 透過已授權的 Google Sheets 連接器讀取該分頁 `A1:N20`，以 `UNFORMATTED_VALUE` 取得數值，將 `values` 陣列暫存為 JSON（不要提交原始 Sheet 檔或識別碼）。
2. 執行 `python scripts/build_tokyo_budget.py --rows /absolute/path/budget-rows.json`。
3. 執行 `node scripts/check_tokyo.cjs` 與現有 DOM 檢查，檢視 P1/P2 合計與手機版，再提交公開 bundle 與必要的程式修改。公開 bundle 會保留本次估算日期，不使用行程同步時間冒充價格查核日期。
4. 更新離線快取版本 `sw.js`，驗證部署的 `trip.json` 與畫面。

定時編譯器保留既有預算。如果設定 GitHub Actions secret `GOOGLE_BUDGET_CSV_URL`（僅該預算分頁的已授權 CSV 匯出 URL），現有工作流程可一併更新；未設定時保留已驗證版本。本次透過連接器同步，沒有新增或更改 Sheet 的分享權限。

## 分頁欄位契約

- B2：JPY→TWD 估算匯率。
- A4:H18：欄名與14日資料；D/E為P1每日成人交通上下限。12/20已含一次地鐵券，後續僅記追加交通。
- K11/M11：P2在12/19成田→東京交通上下限；12/20後與共同路線相同。
- A19:H20：P1全程與P2會合後的交通合計。編譯器會重新計算並對照 Sheet，避免混算。
- J3:N4：每張SIM方案與報價。M3為官方頁面起價JPY，M4為原行程8日方案估價TWD；二者規格不同。P1僅暫抓換算後向上取整至NT$10的額度，15日實價尚未核實。
- K6/M6：SIM來源網址；K13：本次資料估算日。

啟用地鐵券的時間仍未知，不固定宣稱12/23 19:00到期。SIM每日攤提只供比較，不會加入每日交通，也不會自動寫入實際記帳。人數、SIM張數未知時僅顯示每人／每張。
