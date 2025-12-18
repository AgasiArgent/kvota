#!/bin/bash
cd /home/novi/workspace/tech/projects/kvota/user-feedback/backend

# Get SUPABASE_ANON_KEY from .env file
TOKEN=$(curl -s -X POST "https://wstwwmiihkzlgvlymlfd.supabase.co/auth/v1/token?grant_type=password" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"andrey@masterbearingsales.ru","password":"password"}' | python3 -c "import sys,json; print(json.load(sys.stdin).get('access_token',''))")

echo "Token length: ${#TOKEN}"

curl -s -X POST "http://localhost:8000/api/quotes/upload-excel-validation" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/home/novi/workspace/tech/projects/kvota/user-feedback/validation_data/template_quote_input_v6.xlsx" \
  --output /home/novi/Downloads/validation_export_v7.xlsm

ls -la /home/novi/Downloads/validation_export_v7.xlsm
