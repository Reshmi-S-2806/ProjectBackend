import os
import psycopg2
from flask import Flask, request, jsonify
from flask_cors import CORS
import google.generativeai as genai

app = Flask(__name__)
CORS(app)

# =========================
# 🔐 CONFIG (SET THESE)
# =========================
DATABASE_URL = os.getenv("DATABASE_URL")  # Supabase URL
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

# =========================
# 🤖 GEMINI SETUP
# =========================
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
    model = genai.GenerativeModel("gemini-1.5-flash")
else:
    model = None

# =========================
# 🛢️ DB CONNECTION
# =========================
def get_connection():
    try:
        url = DATABASE_URL.replace("postgres://", "postgresql://", 1)
        return psycopg2.connect(url)
    except Exception as e:
        print("DB CONNECTION ERROR:", e)
        return None

# =========================
# 💬 CHAT API
# =========================
@app.route("/chat", methods=["POST"])
def chat():
    try:
        data = request.get_json()
        user_message = data.get("message", "").lower()

        if not user_message:
            return jsonify({"reply": "Please enter a message."})

        # =========================
        # 1️⃣ PRODUCT STOCK CHECK
        # =========================
        try:
            conn = get_connection()
            if conn:
                cur = conn.cursor()

                cur.execute("SELECT name, stock_quantity FROM products")
                products = cur.fetchall()

                for name, stock in products:
                    if name.lower() in user_message:
                        cur.close()
                        conn.close()

                        if stock > 0:
                            return jsonify({"reply": f"{name} is available in stock."})
                        else:
                            return jsonify({"reply": f"{name} is out of stock."})

                # =========================
                # 2️⃣ FAQ TABLE (Supabase)
                # =========================
                cur.execute("""
                    SELECT answer FROM chatbot_faqs
                    WHERE question ILIKE %s
                    LIMIT 1
                """, (f"%{user_message}%",))

                faq = cur.fetchone()

                if faq:
                    cur.close()
                    conn.close()
                    return jsonify({"reply": faq[0]})

                cur.close()
                conn.close()

        except Exception as e:
            print("DB ERROR:", e)

        # =========================
        # 3️⃣ GEMINI FALLBACK
        # =========================
        if model:
            try:
                prompt = f"You are ShopEasy assistant. Answer clearly:\n{user_message}"
                response = model.generate_content(prompt)

                return jsonify({"reply": response.text})

            except Exception as e:
                print("Gemini ERROR:", e)

        return jsonify({
            "reply": "Sorry, I couldn't understand your query."
        })

    except Exception as e:
        print("SERVER ERROR:", e)
        return jsonify({"reply": "Internal Server Error"}), 500


# =========================
# 🚀 RUN SERVER
# =========================
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=6000, debug=True)
