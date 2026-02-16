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

api_url = f"{SUPABASE_URL}/rest/v1/transactions"
payload = {
    "amount": 1,
    "category": "TestNewCategory",
    "note": "Testing if new category is accepted"
}

try:
    print(f"Attempting to add transaction with new category: {payload['category']}")
    response = requests.post(api_url, json=payload, headers=headers)
    if response.status_code == 201:
        print("Success! New category accepted.")
        print(response.json())
        # Clean up
        new_id = response.json()[0]['id']
        requests.delete(f"{api_url}?id=eq.{new_id}", headers=headers)
        print("Cleaned up test transaction.")
    else:
        print(f"Failed: {response.text}")
except Exception as e:
    print(e)
