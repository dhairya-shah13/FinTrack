from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from dotenv import load_dotenv
import os
import requests

# Load environment variables
load_dotenv()

app = Flask(__name__, static_folder='static')
CORS(app)  # Enable CORS for all routes

@app.route('/')
def home():
    return send_from_directory('.', 'index.html')

# Supabase Configuration
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

# Basic headers for Supabase API
def get_headers():
    return {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation"
    }

@app.route('/transactions', methods=['GET'])
def get_transactions():
    if not SUPABASE_URL or not SUPABASE_KEY:
        return jsonify({"error": "Supabase credentials missing"}), 500
    
    try:
        # Supabase REST API: GET request to table endpoint
        api_url = f"{SUPABASE_URL}/rest/v1/transactions?select=*"
        response = requests.get(api_url, headers=get_headers())
        
        if response.status_code == 200:
            return jsonify(response.json()), 200
        else:
            return jsonify({"error": response.text}), response.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/transactions', methods=['POST'])
def add_transaction():
    if not SUPABASE_URL or not SUPABASE_KEY:
        return jsonify({"error": "Supabase credentials missing"}), 500

    data = request.json
    amount = data.get('amount')
    type_ = data.get('type')
    
    if not amount or not type_:
        return jsonify({"error": "Missing amount or type"}), 400

    try:
        # Supabase REST API: POST request to table endpoint
        api_url = f"{SUPABASE_URL}/rest/v1/transactions"
        response = requests.post(api_url, json={"amount": amount, "type": type_}, headers=get_headers())
        
        if response.status_code == 201:
            # Return the created object (requires Prefer: return=representation header)
            return jsonify(response.json()), 201
        else:
            return jsonify({"error": response.text}), response.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    app.run(debug=True, port=port)
