import os
import psycopg2
from flask import Flask, request, jsonify
from flask_cors import CORS
import google.generativeai as genai

app = Flask(__name__)
CORS(app)

DATABASE_URL = os.getenv("DATABASE_URL")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

# ✅ FIXED MODEL NAME
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
    model = genai.GenerativeModel('gemini-1.5-flash')
else:
    model = None

def get_db_connection():
    url = DATABASE_URL.replace("postgres://", "postgresql://", 1)
    return psycopg2.connect(url)

@app.route('/chat', methods=['POST'])
def chat():
    try:
        data = request.get_json()
        user_query = data.get('message', '').lower()

        if not user_query:
            return jsonify({"response": "Please enter a message."})

        # =========================
        # 1. PRODUCT STOCK CHECK
        # =========================
        try:
            conn = get_db_connection()
            cur = conn.cursor()

            cur.execute("SELECT name, stock_quantity FROM products")
            products = cur.fetchall()

            for name, stock in products:
                if name.lower() in user_query:
                    cur.close()
                    conn.close()

                    if stock > 0:
                        return jsonify({"response": f"{name} is available in stock."})
                    else:
                        return jsonify({"response": f"{name} is out of stock."})

            # =========================
            # 2. FAQ FIXED QUERY ✅
            # =========================
            cur.execute("""
                SELECT answer FROM chatbot_faqs
                WHERE question ILIKE %s
                LIMIT 1
            """, (f"%{user_query}%",))

            faq_result = cur.fetchone()

            if faq_result:
                cur.close()
                conn.close()
                return jsonify({"response": faq_result[0]})

            cur.close()
            conn.close()

        except Exception as e:
            print("DB ERROR:", e)

        # =========================
        # 3. GEMINI FALLBACK
        # =========================
        if model:
            try:
                prompt = f"You are ShopEasy AI. Answer clearly and concisely:\n{user_query}"
                gen_response = model.generate_content(prompt)

                return jsonify({
                    "response": gen_response.text
                })

            except Exception as e:
                print("Gemini Error:", e)

        return jsonify({
            "response": "Sorry, I couldn't find an answer."
        })

    except Exception as e:
        print("Server Error:", e)
        return jsonify({"response": "Internal Server Error"}), 500


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=6000)
