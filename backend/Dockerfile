# Railway deployment Dockerfile
# Uses Debian base with Python 3.12 and GTK/GObject libraries for WeasyPrint
# Cache bust: 2025-10-27-v2

FROM python:3.12-slim

# Install system dependencies for WeasyPrint PDF generation
RUN apt-get update && apt-get install -y \
    libcairo2 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libgdk-pixbuf-2.0-0 \
    libffi-dev \
    shared-mime-info \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Make start script executable
RUN chmod +x start.sh

# Start uvicorn server via startup script
# Railway auto-detects port from $PORT environment variable
CMD ["/bin/bash", "/app/start.sh"]
