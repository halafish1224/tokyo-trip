import os
import sys
import time
import random
import pandas as pd

def main():
    sys.stdout.reconfigure(line_buffering=True)
    print("🚀 [Step 1/5] 開始從 Google Sheet 線上擷取網格功課表...", flush=True)

    # 1. 讀取環境變數
    api_key = os.environ.get("GEMINI_API_KEY")
    sheet_csv_url = os.environ.get("GOOGLE_SHEET_CSV_URL")

    if not api_key:
        print("❌ [錯誤] 未找到 GEMINI_API_KEY！", flush=True)
        sys.exit(1)
    if not sheet_csv_url:
        print("❌ [錯誤] 未找到 GOOGLE_SHEET_CSV_URL，請檢查 Secrets 設定！", flush=True)
        sys.exit(1)

    target_html = "2026/tokyo/index.html"

    # 2. 讀取 Google Sheet CSV
    try:
        df = pd.read_csv(sheet_csv_url)
        grid_markdown = df.to_markdown(index=False)
        print(f"✅ [Step 2/5] 成功連動 Google Sheet！擷取到 {df.shape[1]-1} 天行程與 {df.shape[0]} 個時間段數據。", flush=True)
    except Exception as e:
        print(f"❌ [錯誤] 連動 Google Sheet 失敗：{e}", flush=True)
        sys.exit(1)

    # 3. 初始化 Gemini Client
    try:
        from google import genai
        client = genai.Client(api_key=api_key)
        print("✅ [Step 3/5] Gemini Client 初始化完成。", flush=True)
    except Exception as e:
        print(f"❌ [錯誤] SDK 初始化失敗：{e}", flush=True)
        sys.exit(1)

    # 4. Prompt 提示詞
    prompt = f"""
你是一位專業的前端工程師與日本旅遊專家。請根據下方這份從 Google Sheet 即時同步的「網格功課表」，將其轉換並更新為最新版 Bootstrap 5 的 HTML 網頁：

【Google Sheet 即時網格功課表資料】：
{grid_markdown}

【更新與網頁製作要求】：
1. **依據網格時間段重構每日行程卡片**：
   - 橫軸代表日期（如 12/13 獨旅, 12/14 獨旅 ... 12/26 家族）。
   - 縱軸代表時間區段（06:00 ~ 22:00）。
   - 請將表格內容重構成排版精美的 Accordion 或每日時間軸卡片。
2. **交通規劃與 Google 評分 3.5~4.0 隱藏版美食**：
   - 保留並優化各時間點的交通轉乘與周邊在地美食建議。
3. **功能擴充與互動性**：
   - 確保包含動態東京氣象模組與「+ 增添/更新每日遊程」按鈕卡片。
4. **輸出格式**：
   - 請直接輸出純 HTML 內容，切勿加上任何 Markdown 程式碼區塊標記（如 ```html 或 ```）。
"""

    # 5. 多模型自動備援請求機制
    updated_html = None
    
    # 使用最新官方指定的模型清單
    models_to_try = ["gemini-3.8-flash", "gemini-3.1-pro-preview"]

    print("🤖 [Step 4/5] 正在呼叫 Gemini API 進行網頁生成與重構...", flush=True)
    
    for model_name in models_to_try:
        if updated_html:
            break
        print(f"🔄 嘗試呼叫模型：{model_name}", flush=True)
        
        max_retries = 4
        base_wait = 12

        for attempt in range(1, max_retries + 1):
            try:
                print(f"   👉 [{model_name}] 第 {attempt}/{max_retries} 次請求中...", flush=True)
                response = client.models.generate_content(
                    model=model_name,
                    contents=prompt
                )
                updated_html = response.text.strip()
                print(f"🎉 [Step 4/5] 成功由 {model_name} 收到 API 回覆（長度：{len(updated_html)} 字元）！", flush=True)
                break
            except Exception as e:
                err_str = str(e)
                print(f"⚠️ [{model_name}] 請求失敗 (原因: {err_str})", flush=True)
                
                if "404" in err_str:
                    print(f"⚠️ 模型 {model_name} 不可用，跳過...", flush=True)
                    break

                if attempt < max_retries:
                    sleep_time = base_wait + random.randint(5, 12)
                    print(f"⏳ 伺服器尖峰，等待 {sleep_time} 秒後重試...", flush=True)
                    time.sleep(sleep_time)
                    base_wait += 15
                else:
                    print(f"⚠️ 模型 {model_name} 嘗試完畢，準備切換備援...", flush=True)

    if not updated_html:
        print("❌ [錯誤] 所有 Gemini 備援模型均處於尖峰忙碌狀態，請稍後點擊 Run workflow 重試。", flush=True)
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
        print(f"🎉 [Step 5/5] {target_html} 已成功同步並更新完成！", flush=True)
    except Exception as e:
        print(f"❌ [錯誤] 寫入 HTML 檔案失敗：{e}", flush=True)
        sys.exit(1)

if __name__ == "__main__":
    main()
