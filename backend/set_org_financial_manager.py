#!/usr/bin/env python3
"""Set Andy as financial manager at organization level"""

import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

def set_org_financial_manager():
    """Update organization's financial_manager_id using Supabase client"""
    SUPABASE_URL = os.getenv("SUPABASE_URL")
    SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        raise ValueError("Missing Supabase environment variables")

    supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    # Update organization to set Andy as financial manager
    result = supabase.table("organizations").update({
        "financial_manager_id": "97ccad9e-ae96-4be5-ba07-321e07e8ee1e"
    }).eq("id", "77144c58-b396-4ec7-b51a-2a822ec6d889").execute()

    if result.data:
        print("✅ Organization updated successfully:")
        print(f"   Name: {result.data[0]['name']}")
        print(f"   Financial Manager ID: {result.data[0]['financial_manager_id']}")

        # Also verify Andy's user profile flag is set
        user_result = supabase.table("user_profiles").select("*")\
            .eq("user_id", "97ccad9e-ae96-4be5-ba07-321e07e8ee1e").execute()

        if user_result.data:
            print(f"\n✅ Andy's user profile:")
            print(f"   Name: {user_result.data[0]['full_name']}")
            print(f"   is_financial_manager: {user_result.data[0].get('is_financial_manager', False)}")
    else:
        print("❌ Failed to update organization")

    return result

if __name__ == "__main__":
    set_org_financial_manager()