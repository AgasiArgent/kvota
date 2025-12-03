#!/bin/bash
# Railway startup script - properly expands $PORT environment variable

# Default to port 8000 if PORT is not set
PORT=${PORT:-8000}

# Number of workers - Railway provides 1 vCPU minimum, use 2-4 workers
# More workers = better concurrency but more memory
WORKERS=${WORKERS:-2}

echo "Starting uvicorn on port $PORT with $WORKERS workers..."
exec uvicorn main:app --host 0.0.0.0 --port "$PORT" --workers "$WORKERS"
