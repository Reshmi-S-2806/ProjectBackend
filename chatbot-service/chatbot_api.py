from flask import Flask, request, jsonify
import json
import psycopg2

app = Flask(__name__)

# Load FAQ dataset
with open("faq.json", "r") as f:
    faq_data = json.load(f)

# PostgreSQL connection
conn = psycopg2.connect(
    host="localhost",
    database="shopeasy",
    user="postgres",
    password="root"
)

cursor = conn.cursor()


def check_product_stock(message):

    message = message.lower()

    cursor.execute("SELECT name, stock_quantity FROM products")
    products = cursor.fetchall()

    for product in products:
        product_name = product[0].lower()
        stock = product[1]

        if product_name in message:

            if stock > 0:
                return f"Yes, {product_name} is available in stock. You can place the order."

            else:
                return f"{product_name} is currently out of stock. Please try again in 2-3 days."

    return None


def check_faq(message):

    message = message.lower()

    for key in faq_data:
        if key in message:
            return faq_data[key]

    return None


@app.route("/chat", methods=["POST"])
def chat():

    user_message = request.json.get("message")

    # Check product stock
    product_reply = check_product_stock(user_message)

    if product_reply:
        return jsonify({"reply": product_reply})

    # Check FAQ dataset
    faq_reply = check_faq(user_message)

    if faq_reply:
        return jsonify({"reply": faq_reply})

    return jsonify({
        "reply": "Sorry, I could not understand your question. Please ask about payments, fraud detection, or product availability."
    })


if __name__ == "__main__":
    app.run(port=6000, debug=True)
