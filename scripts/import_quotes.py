#!/usr/bin/env python3
"""
CLI script for bulk importing Excel quotes into the database.

Usage:
    python scripts/import_quotes.py validation_data/*.xlsx \
        --org-id "uuid" \
        --user-id "uuid" \
        --batch-size 50 \
        --dry-run
"""
import sys
import argparse
import asyncio
import glob
from pathlib import Path

# Add backend directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

from migration.bulk_importer import BulkQuoteImporter


async def main():
    """Main CLI entry point"""
    parser = argparse.ArgumentParser(
        description="Bulk import Excel quotes into database",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Dry-run (test without database writes)
  python scripts/import_quotes.py validation_data/*.xlsx \\
    --org-id "abc-123" --user-id "xyz-789" --dry-run

  # Import specific files
  python scripts/import_quotes.py quote_001.xlsx quote_002.xlsx \\
    --org-id "abc-123" --user-id "xyz-789"

  # Import all Excel files in directory
  python scripts/import_quotes.py validation_data/*.xlsx \\
    --org-id "abc-123" --user-id "xyz-789" --batch-size 100
        """
    )

    # Positional arguments
    parser.add_argument(
        "files",
        nargs="+",
        help="Excel file paths (supports wildcards like *.xlsx)"
    )

    # Required arguments
    parser.add_argument(
        "--org-id",
        required=True,
        help="Organization UUID (required)"
    )
    parser.add_argument(
        "--user-id",
        required=True,
        help="User UUID performing the import (required)"
    )

    # Optional arguments
    parser.add_argument(
        "--batch-size",
        type=int,
        default=50,
        help="Number of files to process per transaction (default: 50)"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Simulate import without writing to database (for testing)"
    )

    args = parser.parse_args()

    # Expand wildcards and collect all file paths
    file_paths = []
    for pattern in args.files:
        expanded = glob.glob(pattern)
        if expanded:
            file_paths.extend(expanded)
        else:
            # If no wildcard match, check if it's a direct file path
            if Path(pattern).exists():
                file_paths.append(pattern)
            else:
                print(f"⚠️  Warning: No files found for pattern: {pattern}")

    # Filter for .xlsx files only
    file_paths = [f for f in file_paths if f.endswith('.xlsx')]

    if not file_paths:
        print("❌ Error: No Excel files (.xlsx) found")
        print("\nUsage:")
        parser.print_help()
        return 1

    # Print summary
    print("=" * 60)
    print("📋 IMPORT CONFIGURATION")
    print("=" * 60)
    print(f"Files to import:  {len(file_paths)}")
    print(f"Organization ID:  {args.org_id}")
    print(f"User ID:          {args.user_id}")
    print(f"Batch size:       {args.batch_size}")
    print(f"Mode:             {'DRY RUN (no database writes)' if args.dry_run else 'LIVE IMPORT'}")
    print("=" * 60)
    print()

    # Show first few files
    print("📂 Files found:")
    for i, filepath in enumerate(file_paths[:5], 1):
        print(f"  {i}. {Path(filepath).name}")
    if len(file_paths) > 5:
        print(f"  ... and {len(file_paths) - 5} more")
    print()

    # Confirmation prompt (skip for dry-run)
    if args.dry_run:
        print("⚠️  DRY RUN MODE - No data will be written to database")
        print()
    else:
        print("⚠️  WARNING: This will write data to the database!")
        response = input(f"Import {len(file_paths)} quotes? Type 'yes' to continue: ")
        if response.lower() != "yes":
            print("❌ Import cancelled by user")
            return 0
        print()

    # Create importer
    importer = BulkQuoteImporter(
        organization_id=args.org_id,
        user_id=args.user_id,
        batch_size=args.batch_size,
        dry_run=args.dry_run
    )

    # Run import
    try:
        results = await importer.import_files(file_paths)
    except Exception as e:
        print()
        print("=" * 60)
        print("❌ IMPORT FAILED")
        print("=" * 60)
        print(f"Error: {str(e)}")
        print()
        print("Check:")
        print("  1. DATABASE_URL environment variable is set")
        print("  2. Database is accessible")
        print("  3. Organization and User IDs are valid")
        return 1

    # Print summary
    print()
    print("=" * 60)
    print("📊 IMPORT SUMMARY")
    print("=" * 60)
    print(f"Total files:       {results['total']}")
    print(f"✅ Successful:     {results['successful']}")
    print(f"⏭️  Skipped:        {results['skipped']} (duplicates)")
    print(f"❌ Failed:         {results['failed']}")
    print("=" * 60)

    # Print errors if any
    if results['errors']:
        print()
        print("❌ ERRORS ENCOUNTERED:")
        print("-" * 60)
        for error in results['errors'][:10]:  # Show first 10 errors
            print(f"  {error['file']}:")
            print(f"    {error['error']}")
        if len(results['errors']) > 10:
            print(f"  ... and {len(results['errors']) - 10} more errors")
        print("-" * 60)
        print()

    # Exit code
    if results['failed'] > 0:
        print("⚠️  Import completed with errors")
        return 1
    elif results['skipped'] > 0:
        print("✅ Import completed (some files were skipped)")
        return 0
    else:
        print("✅ Import completed successfully")
        return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
