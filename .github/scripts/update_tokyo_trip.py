import os
import sys
import time
import pandas as pd

def main():
    sys.stdout.reconfigure(line_buffering=True)
    print("🚀 [Step 1/5] 開始讀取 Google Sheet 網格功課表 CSV...", flush=True)

    # 1. 檢查 GEMINI_API_KEY
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("❌ [錯誤] 未找到 GEMINI_API_KEY！", flush=True)
        sys.exit(1)

    # 2. 讀取網格 CSV 檔案
    csv_file = "2026/tokyo/itinerary_grid.csv"
    target_html = "2026/tokyo/index.html"

    if not os.path.exists(csv_file):
        print(f"❌ [錯誤] 找不到網格功課表 CSV 檔案：{csv_file}", flush=True)
        sys.exit(1)

    try:
        # 將網格 CSV 轉為 Markdown 表格字串提供給 Gemini
        df = pd.read_csv(csv_file)
        grid_markdown = df.to_markdown(index=False)
        print(f"✅ [Step 2/5] 成功讀取網格功課表（包含 {df.shape[1]-1} 天行程，{df.shape[0]} 個時間段）。", flush=True)
    except Exception as e:
        print(f"❌ [錯誤] 讀取 CSV 失敗：{e}", flush=True)
        sys.exit(1)

    # 3. 初始化 SDK
    try:
        from google import genai
        client = genai.Client(api_key=api_key)
        print("✅ [Step 3/5] Gemini Client 初始化完成。", flush=True)
    except Exception as e:
        print(f"❌ [錯誤] SDK 初始化失敗：{e}", flush=True)
        sys.exit(1)

    # 4. 設定解析網格 CSV 並渲染至 HTML 的 Prompt
    prompt = f"""
你是一位專業的前端工程師與日本旅遊專家。請將下方這份「網格功課表」格式的東京行程表轉換並更新為 Bootstrap 5 的 HTML 網頁：

【網格功課表資料】：
{grid_markdown}

【更新與網頁製作要求】：
1. **依據網格時間段重構每日行程卡片**：
   - 橫軸（欄）代表每一天的日期（例如 12/13 獨旅, 12/14 獨旅 ... 12/26 家族）。
   - 縱軸（列）代表時間區段（06:00 ~ 22:00）。
   - 請將網格中的內容整合為美觀的 Accordion 或卡片流，呈現每日從早到晚的完整流暢行程。
2. **交通規劃與 Google 評分 3.5~4.0 隱藏版美食**：
   - 保持並補全交通轉乘細節。
   - 美食請醒目標示（例如使用 Bootstrap Badge 標籤呈現 Google 星級評分）。
3. **保留互動元件**：
   - 保留頁面頂部的動態氣象模組與「+ 增添/更新每日遊程」按鈕及前端 JS 腳本。
4. **格式規定**：
   - 直接輸出純 HTML 內容，切勿加上任何 Markdown 程式碼區塊標記（如 ```html 或 ```）。

如果專案中已存在原 HTML，請確保維持完整的 HTML5 結構、Bootstrap CSS 與 Bootstrap Icons 引用。
"""

    # 5. 呼叫 Gemini API 進行內容生成
    updated_html = None
    max_retries = 5
    wait_time = 15

    print("🤖 [Step 4/5] 正在呼叫 Gemini API 解析功課表並生成最新 HTML...", flush=True)
    for attempt in range(1, max_retries + 1):
        try:
            response = client.models.generate_content(
                model="gemini-3.8-flash",
                contents=prompt
            )
            updated_html = response.text.strip()
            print(f"✅ [Step 4/5] 成功收到 API 回覆（長度：{len(updated_html)} 字元）。", flush=True)
            break
        except Exception as e:
            print(f"⚠️ 請求失敗 (原因: {e})，等待 {wait_time} 秒後重試...", flush=True)
            time.sleep(wait_time)
            wait_time += 15

    if not updated_html:
        print("❌ [錯誤] API 伺服器忙碌，請稍後重試。", flush=True)
        sys.exit(1)

    # 6. 清理格式並寫回 index.html
    try:
        if updated_html.startswith("```"):
            lines = updated_html.split("\n")
            if lines[0].startswith("```"):
                lines = lines[1:]
            if lines and lines[-1].startswith("```"):
                lines = lines[:-1]
            updated_html = "\n".join(lines)

        with open(target_html, "w", encoding="utf-8") as f:
            f.write(updated_html)
        print(f"🎉 [Step 5/5] {target_html} 已成功依據網格功課表更新完成！", flush=True)
    except Exception as e:
        print(f"❌ [錯誤] 寫入 HTML 失敗：{e}", flush=True)
        sys.exit(1)

if __name__ == "__main__":
    main()
