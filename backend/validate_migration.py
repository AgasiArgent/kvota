"""
Validate SQL migration syntax without applying it
"""
import re

def validate_sql_migration(file_path):
    """Check SQL migration for common syntax errors"""

    with open(file_path, 'r') as f:
        sql = f.read()

    issues = []

    # Check for basic SQL syntax patterns
    if not sql.strip():
        issues.append("❌ Migration file is empty")
        return issues

    # Check for required CREATE TABLE statements
    expected_tables = ['organizations', 'roles', 'organization_members',
                       'organization_invitations', 'user_profiles']

    for table in expected_tables:
        if f"CREATE TABLE" not in sql and f"create table" not in sql.lower():
            issues.append(f"⚠️  No CREATE TABLE statements found")
            break

        if table not in sql.lower():
            issues.append(f"⚠️  Table '{table}' not found in migration")

    # Check for RLS policies
    if "ENABLE ROW LEVEL SECURITY" not in sql:
        issues.append("⚠️  No RLS policies found")

    # Check for role inserts
    if "INSERT INTO roles" not in sql:
        issues.append("⚠️  No role seed data found")

    # Check for common SQL errors
    if sql.count("(") != sql.count(")"):
        issues.append("❌ Mismatched parentheses")

    # Check for semicolons
    create_count = sql.upper().count("CREATE TABLE")
    semicolon_count = sql.count(";")
    if semicolon_count < create_count:
        issues.append("⚠️  Possibly missing semicolons")

    # Count key components
    print("\n📊 Migration Statistics:")
    print(f"   CREATE TABLE statements: {sql.upper().count('CREATE TABLE')}")
    print(f"   CREATE INDEX statements: {sql.upper().count('CREATE INDEX')}")
    print(f"   CREATE POLICY statements: {sql.upper().count('CREATE POLICY')}")
    print(f"   CREATE FUNCTION statements: {sql.upper().count('CREATE FUNCTION')}")
    print(f"   CREATE TRIGGER statements: {sql.upper().count('CREATE TRIGGER')}")
    print(f"   INSERT statements: {sql.upper().count('INSERT INTO')}")
    print(f"   Total lines: {len(sql.splitlines())}")
    print(f"   Total characters: {len(sql)}")

    return issues

if __name__ == "__main__":
    print("🔍 Validating SQL migration...\n")

    migration_file = "migrations/001_multi_tenant_organizations.sql"

    try:
        issues = validate_sql_migration(migration_file)

        if not issues:
            print("\n✅ Migration validation passed!")
            print("   No obvious syntax errors detected")
            print("\n📝 Next steps:")
            print("   1. Apply migration via Supabase dashboard")
            print("   2. Copy contents of migrations/001_multi_tenant_organizations.sql")
            print("   3. Paste into SQL Editor")
            print("   4. Run the migration")
        else:
            print("\n⚠️  Validation warnings/errors:")
            for issue in issues:
                print(f"   {issue}")

            if any("❌" in issue for issue in issues):
                print("\n🚨 Critical errors found - fix before applying")
            else:
                print("\n💡 Warnings found - review before applying")

    except FileNotFoundError:
        print(f"❌ Migration file not found: {migration_file}")
    except Exception as e:
        print(f"❌ Validation error: {e}")
