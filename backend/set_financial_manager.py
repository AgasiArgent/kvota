#!/usr/bin/env python3
"""
Set financial manager for the test organization
"""
import os
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

def set_financial_manager():
    """Set financial manager for organization"""
    try:
        # Create Supabase client
        supabase: Client = create_client(
            os.getenv("SUPABASE_URL"),
            os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        )

        # Our test organization ID (ООО "Ромашка"11)
        org_id = "77144c58-b396-4ec7-b51a-2a822ec6d889"

        # Find an admin or owner in this organization
        result = supabase.table("organization_members").select(
            "user_id, roles(slug)"
        ).eq("organization_id", org_id).eq("status", "active").execute()

        print(f"Found {len(result.data)} members in organization")

        # Find admin or owner
        financial_manager_id = None
        for member in result.data:
            role = member.get('roles', {}).get('slug') if member.get('roles') else None
            print(f"Member {member['user_id']} has role: {role}")
            if role in ['admin', 'owner']:
                financial_manager_id = member['user_id']
                print(f"✅ Found admin/owner: {financial_manager_id}")
                break

        if not financial_manager_id:
            # If no admin/owner, just use the first active member
            if result.data:
                financial_manager_id = result.data[0]['user_id']
                print(f"⚠️ No admin/owner found, using first member: {financial_manager_id}")
            else:
                print("❌ No members found in organization")
                return

        # Update the organization
        update_result = supabase.table("organizations").update({
            "financial_manager_id": financial_manager_id
        }).eq("id", org_id).execute()

        if update_result.data:
            print(f"\n✅ Successfully set financial manager for organization")
            print(f"Organization ID: {org_id}")
            print(f"Financial Manager ID: {financial_manager_id}")
        else:
            print("❌ Failed to update organization")

    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    set_financial_manager()