# Railway deployment Dockerfile
# Uses Debian base with Python 3.12 and GTK/GObject libraries for WeasyPrint

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

# Expose port (Railway will override with $PORT)
EXPOSE 8000

# Start uvicorn server
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}
