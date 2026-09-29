import os
import sys
from google import genai

def main():
    # 1. 取得 API Key
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("❌ 錯誤：未找到 GEMINI_API_KEY 環境變數！")
        sys.exit(1)

    # 2. 指定目標 HTML 檔案路徑
    target_file = "2026/tokyo/index.html"
    if not os.path.exists(target_file):
        print(f"❌ 錯誤：找不到目標檔案 {target_file}")
        sys.exit(1)

    print(f"📖 正在讀取 {target_file}...")
    with open(target_file, "r", encoding="utf-8") as f:
        original_html = f.read()

    # 3. 初始化 Gemini Client
    client = genai.Client(api_key=api_key)

    # 4. 設定 Prompt 提示詞
    prompt = f"""
你是一位專業的日本旅遊專家與前端工程師。請為這份東京旅遊 HTML 網頁進行內容優化與架構升級：

【修改需求】：
1. **景點最新資訊與交通重構**：
   - 保持並優化現有的景點資訊（包含淺草寺、晴空塔、上野、鎌倉等）。
   - 提供更順暢的交通規劃與轉乘建議（如成田機場至市區住宿飯店、都營地下鐵/JR山手線轉乘）。
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

    print("🤖 正在呼叫 Gemini API 進行網頁更新與優化...")
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt
    )

    updated_html = response.text.strip()

    # 清除可能誤帶的 Markdown 標記
    if updated_html.startswith("```"):
        lines = updated_html.split("\n")
        if lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].startswith("```"):
            lines = lines[:-1]
        updated_html = "\n".join(lines)

    # 寫回檔案
    with open(target_file, "w", encoding="utf-8") as f:
        f.write(updated_html)

    print(f"✅ {target_file} 已成功由 Gemini 更新完成！")

if __name__ == "__main__":
    main()
