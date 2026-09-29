import os
import glob
from google import genai

# 初始化 Gemini Client
client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))

def fix_code_file(file_path):
    """讀取單一檔案，交由 Gemini 重構與修復，並覆寫原檔"""
    print(f"🔍 正在檢查與優化：{file_path}")
    
    with open(file_path, "r", encoding="utf-8") as f:
        original_code = f.read()

    prompt = f"""
你是一位專業的 Senior 開發者。請審查並優化以下程式碼：
1. 修復潛在的 Bug 或邏輯漏洞。
2. 提升程式碼可讀性與效能。
3. 為關鍵函式補充繁體中文註解。

【重要規定】：
- 請只回傳「修正後的完整程式碼」。
- 不要包含任何解釋文字或 Markdown 說明（如 ```python 標籤請勿包含，直接給純程式碼）。

原程式碼如下：
{original_code}
"""

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt
    )

    fixed_code = response.text.strip()

    # 清除 Gemini 可能誤加的 Markdown 程式碼區塊標記
    if fixed_code.startswith("```"):
        lines = fixed_code.split("\n")
        if lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].startswith("```"):
            lines = lines[:-1]
        fixed_code = "\n".join(lines)

    # 寫回檔案
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(fixed_code)
        
    print(f"✅ {file_path} 優化完成！")

if __name__ == "__main__":
    # 設定要掃描修正的檔案類型（可依專案語言調整，例如 *.py, *.js, *.html）
    target_files = glob.glob("src/**/*.py", recursive=True) + glob.glob("*.py")
    
    for file_path in target_files:
        # 排除虛擬環境或不需要檢查的資料夾
        if "venv" in file_path or ".github" in file_path:
            continue
        fix_code_file(file_path)
