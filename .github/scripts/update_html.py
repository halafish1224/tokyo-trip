import os
from google import genai

client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))

file_path = "2026/tokyo/index.html"

if os.path.exists(file_path):
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    prompt = f"請優化以下 HTML，補充東京最新景點交通與 Google 評分 3.5~4.0 之間的美食：\n\n{content}"

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt
    )

    # 將 Gemini 修改後的內容寫回檔案
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(response.text)
    print("✅ 檔案更新成功！")
