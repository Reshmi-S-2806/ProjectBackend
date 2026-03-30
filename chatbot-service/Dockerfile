# Use a lightweight Python image
FROM python:3.9-slim

# Set the working directory inside the container
WORKDIR /app

# Install only the necessary system libraries for PostgreSQL (psycopg2)
RUN apt-get update && apt-get install -y \
    libpq-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Install the Python dependencies directly
RUN pip install --no-cache-dir flask psycopg2-binary

# Copy only the files needed for the chatbot to function
COPY chatbot_api.py .
COPY faq.json .

# Expose the port your Flask app is running on
EXPOSE 6000

# Command to run the chatbot
CMD ["python", "chatbot_api.py"]
