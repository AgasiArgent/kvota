import os
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

supabase = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_SERVICE_ROLE_KEY")
)

# Query customers
result = supabase.table("customers").select("*").limit(10).execute()

print(f"\nFound {len(result.data)} customers in database:\n")
for customer in result.data:
    print(f"  - Name: {customer['name']}")
    print(f"    ID: {customer['id']}")
    print(f"    Organization: {customer['organization_id']}")
    print(f"    Created: {customer['created_at']}")
    print()
