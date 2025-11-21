#!/usr/bin/env python3
"""Run migration 029 to add missing workflow states"""

import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

def run_migration():
    """Execute migration 029 to add missing workflow states"""
    SUPABASE_URL = os.getenv("SUPABASE_URL")
    SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        raise ValueError("Missing Supabase environment variables")

    supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    # Read migration file
    with open('migrations/029_add_financial_workflow_states.sql', 'r') as f:
        migration_sql = f.read()

    # Execute migration via RPC (we need to use raw SQL)
    print("🔄 Running migration 029: Add missing workflow states...")

    # Split the migration into individual statements
    statements = [
        """ALTER TABLE quotes DROP CONSTRAINT IF EXISTS check_workflow_state""",
        """ALTER TABLE quotes
        ADD CONSTRAINT check_workflow_state CHECK (
          workflow_state IN (
            'draft',
            'awaiting_procurement',
            'awaiting_logistics_customs',
            'awaiting_sales_review',
            'awaiting_financial_approval',
            'awaiting_senior_approval',
            'approved',
            'rejected',
            'sent_back_for_revision',
            'rejected_by_finance',
            'financially_approved'
          )
        )"""
    ]

    # We can't execute DDL directly through Supabase client
    # So let's use psycopg2 instead
    import psycopg2

    DATABASE_URL = os.getenv("DATABASE_URL")
    if not DATABASE_URL:
        raise ValueError("Missing DATABASE_URL environment variable")

    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()

    try:
        for stmt in statements:
            print(f"  Executing: {stmt[:50]}...")
            cur.execute(stmt)

        # Verify the constraint
        cur.execute("""
            SELECT
              conname as constraint_name,
              pg_get_constraintdef(oid) as constraint_definition
            FROM pg_constraint
            WHERE conname = 'check_workflow_state'
            AND conrelid = 'quotes'::regclass
        """)

        result = cur.fetchone()
        if result:
            print(f"✅ Constraint updated successfully!")
            print(f"   Constraint: {result[0]}")
            print(f"   Definition: {result[1][:100]}...")

        conn.commit()
        print("✅ Migration 029 completed successfully!")

    except Exception as e:
        conn.rollback()
        print(f"❌ Migration failed: {e}")
        raise
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    run_migration()