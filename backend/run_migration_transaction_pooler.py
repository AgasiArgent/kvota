"""
Script to run database migrations using Transaction mode pooler
This works with Supabase's Transaction pooler which supports DDL statements
Usage: python run_migration_transaction_pooler.py migrations/007_quotes_calculation_schema.sql
"""
import os
import sys
import psycopg2
from dotenv import load_dotenv

load_dotenv()

def get_transaction_pooler_connection():
    """Get transaction pooler connection string"""
    database_url = os.getenv("DATABASE_URL")

    if not database_url:
        print("ERROR: DATABASE_URL not found in .env")
        sys.exit(1)

    # Remove pgbouncer parameter (not valid for psycopg2)
    # The pooler connection still works without it
    database_url = database_url.replace("?pgbouncer=true", "")
    database_url = database_url.replace("&pgbouncer=true", "")

    return database_url

def run_migration(sql_file):
    """Execute a SQL migration file using transaction pooler"""
    conn_string = get_transaction_pooler_connection()

    # Read SQL file
    try:
        with open(sql_file, 'r', encoding='utf-8') as f:
            sql = f.read()
    except Exception as e:
        print(f"ERROR: Could not read file {sql_file}: {e}")
        sys.exit(1)

    print(f"Executing migration: {sql_file}")
    print(f"Using Transaction mode pooler")
    print()

    conn = None
    try:
        # Connect to database
        print("Connecting to database...")
        conn = psycopg2.connect(conn_string)
        print("✓ Connected successfully")

        # Don't use AUTOCOMMIT - use explicit transaction
        conn.autocommit = False

        # Create cursor
        cursor = conn.cursor()

        # Execute migration in transaction
        print("Executing SQL in transaction...")
        cursor.execute(sql)

        # Commit transaction
        conn.commit()
        print("✓ Transaction committed successfully")

        # Get any notices or messages
        if conn.notices:
            print("\nDatabase messages:")
            for notice in conn.notices:
                print(f"  {notice.strip()}")

        cursor.close()
        print("\n✅ Migration completed successfully!")
        return True

    except psycopg2.Error as e:
        if conn:
            conn.rollback()
            print("✗ Transaction rolled back")

        print(f"\n❌ Migration failed with database error:")
        print(f"  Error code: {e.pgcode}")
        print(f"  Message: {e.pgerror}")
        print(f"\nFull error: {e}")
        sys.exit(1)

    except Exception as e:
        if conn:
            conn.rollback()
        print(f"\n❌ Migration failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

    finally:
        if conn:
            conn.close()
            print("✓ Connection closed")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python run_migration_transaction_pooler.py <sql_file>")
        print("\nExample:")
        print("  python run_migration_transaction_pooler.py migrations/007_quotes_calculation_schema.sql")
        sys.exit(1)

    sql_file = sys.argv[1]

    if not os.path.exists(sql_file):
        print(f"ERROR: File not found: {sql_file}")
        sys.exit(1)

    run_migration(sql_file)
