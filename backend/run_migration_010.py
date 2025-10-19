#!/usr/bin/env python3
"""
Execute migration 010: Add INN column to organizations table
Uses psycopg2 for direct PostgreSQL connection
"""
import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

def main():
    # PostgreSQL connection string - use POSTGRES_DIRECT_URL from .env
    DATABASE_URL = os.getenv('POSTGRES_DIRECT_URL')

    if not DATABASE_URL:
        print("❌ Error: POSTGRES_DIRECT_URL not found in environment")
        return 1

    print("🔗 Connecting to PostgreSQL database...")

    try:
        # Connect to database
        conn = psycopg2.connect(DATABASE_URL)
        cursor = conn.cursor()

        print("✅ Connected successfully")
        print("🚀 Executing migration 010...")

        # Execute ALTER TABLE
        sql = "ALTER TABLE organizations ADD COLUMN IF NOT EXISTS inn TEXT;"
        cursor.execute(sql)

        # Add comment
        comment_sql = "COMMENT ON COLUMN organizations.inn IS 'ИНН (Individual Taxpayer Number) for Russian business compliance';"
        cursor.execute(comment_sql)

        # Commit changes
        conn.commit()

        print("✅ Migration 010 executed successfully!")
        print("✅ Added INN column to organizations table")

        # Verify column exists
        cursor.execute("""
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_name = 'organizations'
            AND column_name = 'inn';
        """)

        result = cursor.fetchone()
        if result:
            print(f"✅ Verified: Column 'inn' exists with type '{result[1]}'")

        cursor.close()
        conn.close()

    except Exception as e:
        print(f"❌ Error: {e}")
        return 1

    return 0

if __name__ == '__main__':
    exit(main())
