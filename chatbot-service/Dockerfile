# Use a lightweight Python image
FROM python:3.9-slim

# Set the working directory
WORKDIR /app

# Install system dependencies for PostgreSQL
RUN apt-get update && apt-get install -y \
    libpq-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Install all Python dependencies in ONE command
# This ensures flask-cors and google-generativeai are definitely present
RUN pip install --no-cache-dir \
    flask \
    psycopg2-binary \
    flask-cors \
    google-generativeai

# Copy your script and your local FAQ file
COPY chatbot_api.py .


# Expose the port (matching your app.run port)
EXPOSE 6000

# Run the application
CMD ["python", "chatbot_api.py"]
