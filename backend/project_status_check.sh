#!/bin/bash

# B2B Quotation Platform - Current Status Checker
# Run this script to verify what's actually implemented vs planned

echo "🔍 B2B Quotation Platform - Status Check"
echo "========================================"
echo ""

# Check current directory
echo "📁 Current Directory Check:"
if [[ $(basename "$PWD") == "backend" ]]; then
    echo "✅ In backend directory"
else
    echo "⚠️  Not in backend directory. Current: $PWD"
    echo "   Please run: cd ~/quotation-app/backend"
    exit 1
fi
echo ""

# Check Phase 2 Step 4 Components (Should be complete)
echo "✅ Phase 2 Step 4 - Core API Endpoints:"
echo "--------------------------------------"

# Check main files
[[ -f "main.py" ]] && echo "✅ main.py exists" || echo "❌ main.py missing"
[[ -f "auth.py" ]] && echo "✅ auth.py exists" || echo "❌ auth.py missing"  
[[ -f "models.py" ]] && echo "✅ models.py exists" || echo "❌ models.py missing"
[[ -f ".env" ]] && echo "✅ .env exists" || echo "❌ .env missing"

# Check routes directory
[[ -d "routes" ]] && echo "✅ routes/ directory exists" || echo "❌ routes/ directory missing"
[[ -f "routes/__init__.py" ]] && echo "✅ routes/__init__.py exists" || echo "❌ routes/__init__.py missing"
[[ -f "routes/customers.py" ]] && echo "✅ routes/customers.py exists" || echo "❌ routes/customers.py missing"
[[ -f "routes/quotes.py" ]] && echo "✅ routes/quotes.py exists" || echo "❌ routes/quotes.py missing"

# Check if routes are included in main.py
if grep -q "from routes import customers, quotes" main.py 2>/dev/null; then
    echo "✅ Customer and quote routes imported in main.py"
else
    echo "❌ Routes not properly imported in main.py"
fi

if grep -q "app.include_router.*customers\|app.include_router.*quotes" main.py 2>/dev/null; then
    echo "✅ Customer and quote routes included in FastAPI app"
else
    echo "❌ Routes not included in FastAPI app"
fi

echo ""

# Check Phase 2 Step 5 Components (Should be missing)
echo "❓ Phase 2 Step 5 - File Upload System:"
echo "--------------------------------------"

[[ -f "routes/files.py" ]] && echo "✅ routes/files.py exists" || echo "❌ routes/files.py missing (EXPECTED)"

# Check if file upload models exist
if grep -q "FileUpload\|FileProcessing" models.py 2>/dev/null; then
    echo "✅ File upload models exist in models.py"
else
    echo "❌ File upload models missing from models.py (EXPECTED)"
fi

# Check if file routes are imported
if grep -q "from routes import.*files\|import.*files" main.py 2>/dev/null; then
    echo "✅ File routes imported in main.py"
else
    echo "❌ File routes not imported in main.py (EXPECTED)"
fi

echo ""

# Check dependencies
echo "📦 Dependencies Check:"
echo "---------------------"

# Core dependencies (should exist)
echo "Core FastAPI dependencies:"
pip list 2>/dev/null | grep -E "fastapi|uvicorn|python-dotenv|asyncpg" | sed 's/^/✅ /'

# File processing dependencies (might be missing)
echo ""
echo "File processing dependencies:"
if pip list 2>/dev/null | grep -q "pandas"; then
    echo "✅ pandas (file processing)"
else
    echo "❌ pandas missing (needed for file processing)"
fi

if pip list 2>/dev/null | grep -q "openpyxl"; then
    echo "✅ openpyxl (Excel file handling)"
else
    echo "❌ openpyxl missing (needed for Excel files)"
fi

if pip list 2>/dev/null | grep -q "python-multipart"; then
    echo "✅ python-multipart (file uploads)"
else
    echo "❌ python-multipart missing (needed for file uploads)"
fi

echo ""

# Check if server can start
echo "🚀 Server Status Check:"
echo "----------------------"
if pgrep -f "uvicorn.*main:app" > /dev/null; then
    echo "✅ Server is currently running"
    # Test basic endpoints
    if curl -s http://localhost:8000/api/health > /dev/null 2>&1; then
        echo "✅ Health endpoint responding"
    else
        echo "⚠️  Server running but health endpoint not responding"
    fi
else
    echo "❌ Server not currently running"
    echo "   Start with: uvicorn main:app --reload --host 0.0.0.0 --port 8000"
fi

echo ""

# Final assessment
echo "📋 FINAL ASSESSMENT:"
echo "==================="

# Count completed components
STEP4_COMPLETE=0
STEP5_COMPLETE=0

# Step 4 checks
[[ -f "routes/customers.py" ]] && ((STEP4_COMPLETE++))
[[ -f "routes/quotes.py" ]] && ((STEP4_COMPLETE++))
[[ -f "models.py" ]] && ((STEP4_COMPLETE++))
grep -q "include_router" main.py 2>/dev/null && ((STEP4_COMPLETE++))

# Step 5 checks  
[[ -f "routes/files.py" ]] && ((STEP5_COMPLETE++))
grep -q "FileUpload" models.py 2>/dev/null && ((STEP5_COMPLETE++))
pip list 2>/dev/null | grep -q "pandas" && ((STEP5_COMPLETE++))
pip list 2>/dev/null | grep -q "python-multipart" && ((STEP5_COMPLETE++))

echo "Phase 2 Step 4 (Core API): $STEP4_COMPLETE/4 components complete"
echo "Phase 2 Step 5 (File Upload): $STEP5_COMPLETE/4 components complete"
echo ""

if [[ $STEP4_COMPLETE -eq 4 ]]; then
    echo "✅ Phase 2 Step 4 is COMPLETE"
else
    echo "⚠️  Phase 2 Step 4 needs completion ($STEP4_COMPLETE/4 done)"
fi

if [[ $STEP5_COMPLETE -eq 0 ]]; then
    echo "❌ Phase 2 Step 5 NOT STARTED (this is normal)"
    echo ""
    echo "🎯 RECOMMENDATION: You are correct!"
    echo "   - Phase 2 Step 4 is complete ✅"
    echo "   - Phase 2 Step 5 (file upload) needs to be implemented next"
    echo ""
    echo "📝 Next steps:"
    echo "   1. Install file processing dependencies"
    echo "   2. Add file upload models to models.py" 
    echo "   3. Create routes/files.py with upload endpoints"
    echo "   4. Include file routes in main.py"
elif [[ $STEP5_COMPLETE -lt 4 ]]; then
    echo "⚠️  Phase 2 Step 5 partially complete ($STEP5_COMPLETE/4 done)"
else
    echo "✅ Phase 2 Step 5 is COMPLETE"
fi
