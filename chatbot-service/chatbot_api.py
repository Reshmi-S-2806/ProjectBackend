import os
import psycopg2
from flask import Flask, request, jsonify
from flask_cors import CORS
import google.generativeai as genai

app = Flask(__name__)
CORS(app)

# Database & API Config
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:root@localhost:5432/shopeasy")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
    model = genai.GenerativeModel('gemini-flash-latest')
else:
    model = None

def get_db_connection():
    # Fix for Heroku/Docker postgres naming
    url = DATABASE_URL.replace("postgres://", "postgresql://", 1) if DATABASE_URL.startswith("postgres://") else DATABASE_URL
    return psycopg2.connect(url)

@app.route('/chat', methods=['POST'])
def chat():
    try:
        data = request.get_json()
        user_query = data.get('message', '').lower()

        if not user_query:
            return jsonify({"response": "I didn't catch that. Could you repeat?"})

        # 1. CHECK PRODUCT STOCK (Old Logic Restored)
        try:
            conn = get_db_connection()
            cur = conn.cursor()
            cur.execute("SELECT name, stock_quantity FROM products")
            products = cur.fetchall()
            
            for name, stock in products:
                if name.lower() in user_query:
                    if stock > 0:
                        return jsonify({"response": f"Yes, {name} is in stock! You can order it now."})
                    else:
                        return jsonify({"response": f"Sorry, {name} is out of stock. Check back in 2 days."})
            
            # 2. CHECK FAQ TABLE (Database version of your JSON)
            cur.execute("SELECT answer FROM chatbot_faqs WHERE %s ILIKE CONCAT('%%', question, '%%') LIMIT 1", (user_query,))
            faq_result = cur.fetchone()
            if faq_result:
                return jsonify({"response": faq_result[0]})

            cur.close()
            conn.close()
        except Exception as e:
            print(f"Database/Stock Error: {e}")

        # 3. GEMINI FALLBACK (If not in Stock or FAQ)
        if model:
            prompt = f"You are ShopEasy AI. Answer concisely: {user_query}"
            gen_response = model.generate_content(prompt)
            return jsonify({"response": gen_response.text})
        
        return jsonify({"response": "I'm not sure about that. Try asking about products or payments."})

    except Exception as e:
        return jsonify({"response": "Internal Server Error"}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=6000)
