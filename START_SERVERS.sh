#!/bin/bash
# Quick start script for CRM testing
# Run servers from main dev worktree (has dependencies installed)

echo "🚀 Starting CRM servers for testing..."
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running from q1-crm worktree
if [[ $PWD == *"q1-crm"* ]]; then
  echo -e "${YELLOW}⚠️  You're in q1-crm worktree (no dependencies)${NC}"
  echo "Switching to main dev worktree..."
  cd /home/novi/workspace/tech/projects/kvota/dev
fi

echo ""
echo "📂 Working directory: $PWD"
echo ""

# Backend
echo "1️⃣  Starting Backend (port 8001)..."
cd backend

if [ -d "venv" ]; then
  source venv/bin/activate
  echo -e "${GREEN}✅ venv activated${NC}"
else
  echo -e "${YELLOW}⚠️  No venv found, using system python${NC}"
fi

# Kill existing backend on 8001
lsof -ti:8001 | xargs kill -9 2>/dev/null
sleep 1

# Start backend in background
nohup uvicorn main:app --reload --port 8001 > /tmp/crm_backend_test.log 2>&1 &
BACKEND_PID=$!
sleep 3

# Check if started
if curl -s http://localhost:8001/api/leads/webhook/health > /dev/null 2>&1; then
  echo -e "${GREEN}✅ Backend running on port 8001 (PID: $BACKEND_PID)${NC}"
else
  echo -e "${YELLOW}⚠️  Backend failed to start. Check logs: tail -f /tmp/crm_backend_test.log${NC}"
fi

cd ..

echo ""

# Frontend
echo "2️⃣  Starting Frontend (port 3001)..."
cd frontend

# Kill existing frontend on 3001
lsof -ti:3001 | xargs kill -9 2>/dev/null
sleep 1

# Start frontend in background
nohup npm run dev -- --port 3001 > /tmp/crm_frontend_test.log 2>&1 &
FRONTEND_PID=$!
sleep 5

# Check if started
if curl -s http://localhost:3001 > /dev/null 2>&1; then
  echo -e "${GREEN}✅ Frontend running on port 3001 (PID: $FRONTEND_PID)${NC}"
else
  echo -e "${YELLOW}⚠️  Frontend still starting... Check logs: tail -f /tmp/crm_frontend_test.log${NC}"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "${GREEN}✅ Servers started!${NC}"
echo ""
echo "Backend:  http://localhost:8001"
echo "Frontend: http://localhost:3001"
echo ""
echo "📋 Testing Guide:"
echo "   See: .claude/CRM_TESTING_SEQUENCE.md"
echo ""
echo "🔍 View Logs:"
echo "   Backend:  tail -f /tmp/crm_backend_test.log"
echo "   Frontend: tail -f /tmp/crm_frontend_test.log"
echo ""
echo "🛑 Stop Servers:"
echo "   kill $BACKEND_PID $FRONTEND_PID"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
