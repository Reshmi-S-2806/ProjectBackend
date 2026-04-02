import os
import psycopg2
from flask import Flask, request, jsonify
from flask_cors import CORS
import google.generativeai as genai

app = Flask(__name__)
CORS(app)

# =========================
# ENV VARIABLES (DEBUG)
# =========================
DATABASE_URL = os.getenv("DATABASE_URL")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

print("DATABASE_URL:", DATABASE_URL)
print("GEMINI_API_KEY:", GEMINI_API_KEY)

# =========================
# GEMINI CONFIG
# =========================
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
    model = genai.GenerativeModel('gemini-flash-latest')
else:
    model = None
    print("⚠️ GEMINI_API_KEY is missing!")

# =========================
# DATABASE CONNECTION
# =========================
def get_db_connection():
    if not DATABASE_URL:
        raise Exception("DATABASE_URL is not set")

    url = DATABASE_URL
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql://", 1)

    return psycopg2.connect(url)

# =========================
# CHAT API
# =========================
@app.route('/chat', methods=['POST'])
def chat():
    try:
        data = request.get_json()
        user_query = data.get('message') if data else None

        print("Incoming query:", user_query)

        if not user_query:
            return jsonify({"response": "I didn't catch that. Could you repeat?"})

        response_text = None

        # =========================
        # STEP 1: DATABASE SEARCH
        # =========================
        try:
            conn = get_db_connection()
            cur = conn.cursor()

            cur.execute(
                "SELECT answer FROM chatbot_faqs WHERE question ILIKE %s LIMIT 1",
                (f"%{user_query}%",)
            )

            result = cur.fetchone()

            if result:
                response_text = result[0]
                print("DB Response:", response_text)

            cur.close()
            conn.close()

        except Exception as e:
            print("Database error:", str(e))

        # =========================
        # STEP 2: GEMINI FALLBACK
        # =========================
        if not response_text:
            if not model:
                return jsonify({
                    "response": "AI service not configured properly."
                })

            try:
                prompt = f"You are the AI assistant for ShopEasy. User asks: {user_query}"
                gen_response = model.generate_content(prompt)

                response_text = gen_response.text if gen_response else "No response from AI"
                print("Gemini Response:", response_text)

            except Exception as e:
                print("Gemini error:", str(e))
                response_text = "I'm having trouble connecting to AI service."

        return jsonify({"response": response_text})

    except Exception as e:
        print("Chat API Error:", str(e))
        return jsonify({"response": "Internal server error"}), 500


# =========================
# RUN APP
# =========================
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=6000, debug=True)
