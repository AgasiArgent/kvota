#!/bin/bash
cd /home/novi/workspace/tech/projects/kvota/user-feedback/backend

TOKEN=$(curl -s -X POST "https://wstwwmiihkzlgvlymlfd.supabase.co/auth/v1/token?grant_type=password" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndzdHd3bWlpaGt6bGd2bHltbGZkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE1NjY4MzQsImV4cCI6MjA2NzE0MjgzNH0.wM4Ipk_rDwiuXbJR0olP0MCFjzZv3a46lOrBX4eTow0" \
  -H "Content-Type: application/json" \
  -d '{"email":"andrey@masterbearingsales.ru","password":"password"}' | python3 -c "import sys,json; print(json.load(sys.stdin).get('access_token',''))")

echo "Token length: ${#TOKEN}"

curl -s -X POST "http://localhost:8000/api/quotes/upload-excel-validation" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/home/novi/workspace/tech/projects/kvota/user-feedback/validation_data/template_quote_input_v6.xlsx" \
  --output /home/novi/Downloads/validation_export_v7.xlsm

ls -la /home/novi/Downloads/validation_export_v7.xlsm
