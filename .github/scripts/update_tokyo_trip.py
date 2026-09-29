import os
import sys

def main():
    print("🚀 [Step 1/5] 開始執行 Gemini 自動更新程序...")

    # 1. 檢查 GEMINI_API_KEY
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("❌ [錯誤] 未找到 GEMINI_API_KEY！請檢查 GitHub Repository Secrets 設定。")
        sys.exit(1)
    print("✅ [Step 1/5] GEMINI_API_KEY 讀取成功。")

    # 2. 檢查目標 HTML 檔案
    target_file = "2026/tokyo/index.html"
    if not os.path.exists(target_file):
        print(f"❌ [錯誤] 找不到目標檔案：{target_file}")
        print(f"📂 當前工作目錄內容：{os.listdir('.')}")
        sys.exit(1)

    try:
        with open(target_file, "r", encoding="utf-8") as f:
            original_html = f.read()
        print(f"✅ [Step 2/5] 成功讀取 {target_file}（原長度：{len(original_html)} 字元）。")
    except Exception as e:
        print(f"❌ [錯誤] 讀取檔案失敗：{e}")
        sys.exit(1)

    # 3. 匯入 SDK 與初始化 Client
    try:
        from google import genai
        client = genai.Client(api_key=api_key)
        print("✅ [Step 3/5] Gemini Client 初始化完成。")
    except Exception as e:
        print(f"❌ [錯誤] SDK 初始化失敗：{e}")
        sys.exit(1)

    # 4. 呼叫 Gemini API
    prompt = f"""
你是一位專業的日本旅遊專家與前端工程師。請為這份東京旅遊 HTML 網頁進行內容優化與架構升級：

【修改需求】：
1. **景點最新資訊與交通重構**：
   - 保持並優化現有的景點資訊（包含淺草寺、晴空塔、上野、鎌倉等）。
   - 提供更順暢的交通規劃與轉乘建議（如成田/羽田機場至市區、都營地下鐵/JR山手線轉乘）。
2. **周邊在地美食推薦**：
   - 為各景點新增/更新周邊美食推薦。
   - 篩選標準：**Google 地圖商家評論分數介於 3.5 到 4.0 星之間** 的在地隱藏版美食（避開過度排隊的觀光名店）。
3. **功能擴充與頁面互動**：
   - 確保包含動態氣象模組與「+ 增添/更新每日遊程」互動卡片功能。
   - 確保所有 HTML 標籤、Bootstrap CSS 與 JavaScript 完整且無缺漏。

【格式規定】：
- 請只回傳修改後的完整 HTML 內容。
- 切勿在開頭或結尾加上任何 Markdown 標籤（例如請勿包含 ```html 或 ``` 符號）。

原 HTML 內容如下：
{original_html}
"""

    print("🤖 [Step 4/5] 正在呼叫 Gemini API 進行內容生成...")
    try:
        response = client.models.generate_content(
            model="gemini-3.8-flash",
            contents=prompt
        )
        updated_html = response.text.strip()
        print(f"✅ [Step 4/5] 成功收到 API 回覆（生成長度：{len(updated_html)} 字元）。")
    except Exception as e:
        print(f"❌ [錯誤] API 呼叫失敗：{e}")
        sys.exit(1)

    # 5. 清理格式並寫回檔案
    try:
        if updated_html.startswith("```"):
            lines = updated_html.split("\n")
            if lines[0].startswith("```"):
                lines = lines[1:]
            if lines and lines[-1].startswith("```"):
                lines = lines[:-1]
            updated_html = "\n".join(lines)

        with open(target_file, "w", encoding="utf-8") as f:
            f.write(updated_html)
        print(f"🎉 [Step 5/5] {target_file} 更新成功！")
    except Exception as e:
        print(f"❌ [錯誤] 檔案寫入失敗：{e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
