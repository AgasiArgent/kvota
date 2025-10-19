"""
Script to run database migrations using direct PostgreSQL connection
Usage: python run_migration_direct.py migrations/007_quotes_calculation_schema.sql
"""
import os
import sys
import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
from dotenv import load_dotenv

load_dotenv()

def get_direct_connection_string():
    """Get direct PostgreSQL connection string"""
    # Try POSTGRES_DIRECT_URL first (direct connection, port 5432)
    direct_url = os.getenv("POSTGRES_DIRECT_URL")
    if direct_url:
        return direct_url

    # Try DATABASE_URL but modify for direct connection
    database_url = os.getenv("DATABASE_URL")
    if database_url:
        # Replace pooler port 6543 with direct port 5432
        # Remove pgbouncer parameter
        direct_url = database_url.replace(":6543", ":5432").replace("?pgbouncer=true", "")
        return direct_url

    return None

def run_migration(sql_file):
    """Execute a SQL migration file"""
    conn_string = get_direct_connection_string()

    if not conn_string:
        print("ERROR: No database connection string found")
        print("\nPlease add to backend/.env:")
        print("POSTGRES_DIRECT_URL=postgresql://postgres.[project]:[password]@db.[project].supabase.co:5432/postgres")
        print("\nYou can find this in Supabase Dashboard > Settings > Database > Connection String (Direct)")
        sys.exit(1)

    # Read SQL file
    try:
        with open(sql_file, 'r', encoding='utf-8') as f:
            sql = f.read()
    except Exception as e:
        print(f"ERROR: Could not read file {sql_file}: {e}")
        sys.exit(1)

    print(f"Executing migration: {sql_file}")
    print(f"Connection: {conn_string.split('@')[1].split(':')[0] if '@' in conn_string else 'hidden'}")
    print()

    conn = None
    try:
        # Connect to database
        print("Connecting to database...")
        conn = psycopg2.connect(conn_string)
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        print("✓ Connected successfully")

        # Create cursor
        cursor = conn.cursor()

        # Execute migration
        print("Executing SQL...")
        cursor.execute(sql)
        print("✓ SQL executed successfully")

        # Get any notices or messages
        if conn.notices:
            print("\nDatabase messages:")
            for notice in conn.notices:
                print(f"  {notice.strip()}")

        cursor.close()
        print("\n✅ Migration completed successfully!")

    except psycopg2.Error as e:
        print(f"\n❌ Migration failed with database error:")
        print(f"  Error code: {e.pgcode}")
        print(f"  Message: {e.pgerror}")
        print(f"\nFull error: {e}")
        sys.exit(1)

    except Exception as e:
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
        print("Usage: python run_migration_direct.py <sql_file>")
        print("\nExample:")
        print("  python run_migration_direct.py migrations/007_quotes_calculation_schema.sql")
        sys.exit(1)

    sql_file = sys.argv[1]

    if not os.path.exists(sql_file):
        print(f"ERROR: File not found: {sql_file}")
        sys.exit(1)

    run_migration(sql_file)
