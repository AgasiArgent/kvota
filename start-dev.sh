#!/bin/bash
# Start Dev Worktree Servers
# Usage: ./start-dev.sh [frontend|backend|both]

WORKTREE_DIR="/home/novi/quotation-app-dev"
MODE="${1:-both}"

echo "🚀 Starting DEV worktree servers..."
echo "📁 Location: $WORKTREE_DIR"
echo ""

start_frontend() {
    echo "▶️  Starting FRONTEND on :3001..."
    cd "$WORKTREE_DIR/frontend"
    npm run dev -- -p 3001 &
    FRONTEND_PID=$!
    echo "   Frontend PID: $FRONTEND_PID"
}

start_backend() {
    echo "▶️  Starting BACKEND on :8001..."
    cd "$WORKTREE_DIR/backend"
    source venv/bin/activate
    uvicorn main:app --reload --port 8001 &
    BACKEND_PID=$!
    echo "   Backend PID: $BACKEND_PID"
}

case $MODE in
    frontend)
        start_frontend
        ;;
    backend)
        start_backend
        ;;
    both)
        start_frontend
        start_backend
        ;;
    *)
        echo "❌ Invalid mode: $MODE"
        echo "   Usage: ./start-dev.sh [frontend|backend|both]"
        exit 1
        ;;
esac

echo ""
echo "✅ Dev servers started!"
echo ""
echo "📍 Access points:"
echo "   Frontend: http://localhost:3001"
echo "   Backend:  http://localhost:8001"
echo "   API Docs: http://localhost:8001/docs"
echo ""
echo "💡 Tip: To stop servers, run: pkill -f 'npm run dev.*3001' or pkill -f 'uvicorn.*8001'"
