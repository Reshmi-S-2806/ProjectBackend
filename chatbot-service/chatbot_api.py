import os
import psycopg2
from flask import Flask, request, jsonify
from flask_cors import CORS
import google.generativeai as genai

app = Flask(__name__)
CORS(app) # Ensures your Angular frontend can talk to this Python API

# 1. Configure Gemini AI
# Make sure GEMINI_API_KEY is in your k8s/deployment.yaml
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
model = genai.GenerativeModel('gemini-1.5-flash')

DATABASE_URL = os.getenv("DATABASE_URL")

def get_db_connection():
    # Fix for common Supabase connection string issues
    url = DATABASE_URL
    if url and url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql://", 1)
    return psycopg2.connect(url)

@app.route('/chat', methods=['POST'])
def chat():
    user_query = request.json.get('message')
    if not user_query:
        return jsonify({"response": "I didn't catch that. Could you repeat?"})

    response_text = None

    # STEP 1: Search your Supabase FAQ table first
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Search for a matching question in your table
        cur.execute("SELECT answer FROM chatbot_faqs WHERE question ILIKE %s LIMIT 1",
    (f"%{user_query}%",)
        # ILIKE %s LIMIT 1", (f'%{user_query}%',))
        result = cur.fetchone()
        
        if result:
            response_text = result[0]
            
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Database error: {e}")
        # We don't return here; if DB fails, we let Gemini try to answer

    # STEP 2: If no FAQ match, use Gemini AI
    if not response_text:
        try:
            # Context injection tells Gemini who it is
            prompt = f"You are the AI assistant for ShopEasy, an e-commerce site. User asks: {user_query}"
            gen_response = model.generate_content(prompt)
            response_text = gen_response.text
        except Exception as e:
            print(f"Gemini error: {e}")
            response_text = "I'm sorry, I'm having trouble connecting to my AI brain. Please try again."

    return jsonify({"response": response_text})

if __name__ == '__main__':
    # Running on port 6000 as per your Kubernetes configuration
    app.run(host='0.0.0.0', port=6000, debug=True)
