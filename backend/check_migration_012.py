"""
Check if migration 012 has been executed
"""
import os
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

def check_migration():
    """Check if migration 012 tables and columns exist"""

    supabase = create_client(
        os.getenv("SUPABASE_URL"),
        os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    )

    try:
        # Try to query customer_contacts table
        result = supabase.table("customer_contacts").select("id").limit(1).execute()
        print("✅ Migration 012 executed - customer_contacts table exists")
        print(f"   Found {len(result.data)} contacts")

        # Try to query quotes with new columns
        result2 = supabase.table("quotes").select("delivery_address, contact_id, manager_name").limit(1).execute()
        print("✅ quotes table has new export columns (delivery_address, contact_id, manager_name)")

        # Try to query organizations with CEO columns
        result3 = supabase.table("organizations").select("ceo_name, ceo_title").limit(1).execute()
        print("✅ organizations table has CEO columns (ceo_name, ceo_title)")

        print("\n✅ Migration 012 is fully applied!")
        return True

    except Exception as e:
        error_msg = str(e)
        if "customer_contacts" in error_msg or "does not exist" in error_msg.lower():
            print("❌ Migration 012 NOT executed - customer_contacts table missing")
            print(f"   Error: {error_msg}")
            return False
        else:
            print(f"⚠️  Unexpected error: {error_msg}")
            return False

if __name__ == "__main__":
    check_migration()
