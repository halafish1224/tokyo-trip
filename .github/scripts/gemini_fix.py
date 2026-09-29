import os
import sys
import glob
from google import genai

# 1. 檢查 API Key
api_key = os.environ.get("GEMINI_API_KEY")
if not api_key:
    print("❌ 錯誤：未偵測到 GEMINI_API_KEY，請檢查 GitHub Secrets 設定！")
    sys.exit(1)

try:
    client = genai.Client(api_key=api_key)
    print("✅ Gemini API Client 初始化成功！")
except Exception as e:
    print(f"❌ Gemini Client 初始化失敗: {e}")
    sys.exit(1)

# 2. 搜尋目標檔案（以 HTML/JS/Python 為例，可自行修改）
target_files = glob.glob("**/*.py", recursive=True) + glob.glob("**/*.js", recursive=True)
target_files = [f for f in target_files if "node_modules" not in f and "venv" not in f and ".github" not in f]

if not target_files:
    print("⚠️ 未找到任何符合條件的檔案，結束執行。")
    sys.exit(0)

print(f"📁 找到 {len(target_files)} 個檔案，開始執行檢查...")
