import requests
import os
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

headers = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation"
}

api_url = f"{SUPABASE_URL}/rest/v1/transactions?select=*&limit=1"
try:
    response = requests.get(api_url, headers=headers)
    print(response.json())
except Exception as e:
    print(e)
