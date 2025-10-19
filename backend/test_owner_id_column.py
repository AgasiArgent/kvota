from supabase import create_client
import os
from dotenv import load_dotenv

load_dotenv(".env")

# Get env vars
supabase = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_SERVICE_ROLE_KEY")
)

print("Testing organizations table schema...")

# Try to select all columns
try:
    result = supabase.table("organizations").select("*").limit(1).execute()
    print("✅ Organizations table exists")
    if result.data:
        print(f"   Columns: {list(result.data[0].keys())}")
    else:
        print("   No data in table (checking column list another way...)")
except Exception as e:
    print(f"❌ Error: {e}")

# Try to insert with owner_id
print("\nTrying to insert organization with owner_id...")
try:
    test_data = {
        "name": "Schema Test Org",
        "slug": "schema-test-" + str(os.urandom(4).hex()),
        "owner_id": "138311f7-78ac-4d5b-bfad-6a681d2df545"
    }
    result = supabase.table("organizations").insert(test_data).execute()
    print("✅ Successfully inserted with owner_id")
    print(f"   Returned data: {result.data}")

    # Clean up
    if result.data:
        org_id = result.data[0]['id']
        supabase.table("organizations").delete().eq("id", org_id).execute()
        print(f"   Cleaned up test organization")
except Exception as e:
    print(f"❌ Insert failed: {e}")
