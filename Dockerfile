# STAGE 1: Setup Python and Node environment
FROM python:3.10-slim

# Install Node.js
RUN apt-get update && apt-get install -y curl
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt-get install -y nodejs

WORKDIR /app

# Copy dependency files
COPY package*.json ./
COPY requirements.txt ./

# Install dependencies for both
RUN npm install
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of your code (ML files, Node scripts, Gemini logic)
COPY . .

EXPOSE 5000
CMD ["node", "server.js"]
CMD ["python","fraud_api.py"]
# Or "python app.py" depending on which one starts your main process
