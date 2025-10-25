#!/usr/bin/env python3
"""Run migration 013 using psycopg2"""
import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

def run_migration():
    # Connect to database
    conn = psycopg2.connect(os.getenv("DATABASE_URL"))
    conn.autocommit = True
    cursor = conn.cursor()

    try:
        # Read migration file
        with open('migrations/013_add_last_name_to_contacts.sql', 'r') as f:
            migration_sql = f.read()

        # Execute migration
        print("Running migration 013...")
        cursor.execute(migration_sql)
        print("✅ Migration 013 completed successfully!")

    except Exception as e:
        print(f"❌ Migration failed: {e}")
        raise
    finally:
        cursor.close()
        conn.close()

if __name__ == "__main__":
    run_migration()
