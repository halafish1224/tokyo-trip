name: Gemini Tokyo Trip Auto Updater

on:
  schedule:
    - cron: '0 19 * * *' # 每日台灣時間凌晨 03:00 (離峰時段) 自動執行
  workflow_dispatch: # 支援在 GitHub 頁面手動按鈕觸發

jobs:
  update-tokyo-trip:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write

    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.10'

      - name: Install Dependencies
        run: |
          python -m pip install --upgrade pip
          pip install google-genai pandas tabulate

      - name: Run Gemini Update Script
        env:
          GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
          GOOGLE_SHEET_CSV_URL: ${{ secrets.GOOGLE_SHEET_CSV_URL }}
        run: |
          python .github/scripts/update_tokyo_trip.py

      - name: Create Pull Request
        uses: peter-evans/create-pull-request@v6
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          commit-message: "style/update: 自動同步 Google Sheet 最新網格功課表行程"
          title: "🤖 [Gemini Auto-Update] 同步 Google Sheet 最新功課表行程"
          body: |
            ## 🤖 Gemini 網格功課表同步報告
            本 PR 已成功從 Google Sheet 線上同步最新網格功課表，並經由 Gemini API 自動升級 `2026/tokyo/index.html`：
            - 🗓️ 06:00~22:00 逐時段行程精準轉換
            - 🚆 景點最佳交通規劃與轉乘細節
            - 🍱 周邊 Google 評分 3.5~4.0 星隱藏版在地美食
            
            請審閱變更後點擊 Merge 合併！
          branch: gemini-tokyo-daily-update
          base: main
          delete-branch: true
