# STAGE 1: Setup Python and Node environment
FROM python:3.10-slim

# Install Node.js
RUN apt-get update && apt-get install -y curl
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt-get install -y nodejs

WORKDIR /app

# 1. Copy dependency files first (for faster caching)
COPY package*.json ./
COPY requirements.txt ./

# 2. Install dependencies
RUN npm install
RUN pip install --no-cache-dir -r requirements.txt

# 3. Copy the rest of the code (including start.sh)
COPY . .

# 4. CRITICAL: Fix permissions and Line Endings
# 'sed' removes Windows hidden characters (\r) just in case
RUN sed -i 's/\r$//' start.sh && chmod +x start.sh

EXPOSE 5000

# 5. Use the full path to the shell
CMD ["/bin/sh", "./start.sh"]
