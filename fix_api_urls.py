#!/usr/bin/env python3
"""
Script to update all hardcoded localhost:8000 references to use environment configuration
"""

import os
import re
from pathlib import Path

def fix_api_urls():
    """Fix all API URLs in the codebase"""

    # Find all TypeScript files in src/lib/api
    api_dir = Path("src/lib/api")
    files_to_update = list(api_dir.glob("*.ts"))

    # Also check specific component files that might have hardcoded URLs
    additional_files = [
        Path("src/app/quotes/create/page.tsx"),
        Path("src/app/quotes/[id]/page.tsx"),
        Path("src/app/customers/[id]/contacts/page.tsx"),
    ]

    for additional_file in additional_files:
        if additional_file.exists():
            files_to_update.append(additional_file)

    for file_path in files_to_update:
        with open(file_path, 'r') as f:
            content = f.read()

        original_content = content

        # Check if file has hardcoded localhost:8000
        if 'localhost:8000' not in content:
            continue

        print(f"Updating {file_path}")

        # Remove duplicate imports
        content = re.sub(r"import { getApiEndpoint } from '@/lib/config';\n", "", content)

        # Remove old API_URL definitions
        content = re.sub(r"const API_URL = process\.env\.NEXT_PUBLIC_API_URL \|\| 'http://localhost:8000';\n", "", content)
        content = re.sub(r'const API_URL = process\.env\.NEXT_PUBLIC_API_URL \|\| "http://localhost:8000";\n', "", content)

        # Add import if not present
        if "import { getApiEndpoint } from '@/lib/config'" not in content:
            # Find the last import statement
            import_pattern = r'^import .*$'
            imports = re.findall(import_pattern, content, re.MULTILINE)
            if imports:
                last_import = imports[-1]
                content = content.replace(last_import, last_import + "\nimport { getApiEndpoint } from '@/lib/config';")
            else:
                # Add at the beginning
                content = "import { getApiEndpoint } from '@/lib/config';\n" + content

        # Replace all hardcoded URLs
        # Handle template literals with variables
        content = re.sub(r'\`http://localhost:8000(/api/[^`]*)\`', r'getApiEndpoint(`\1`)', content)
        content = re.sub(r"'http://localhost:8000(/api/[^']*)'", r"getApiEndpoint('\1')", content)
        content = re.sub(r'"http://localhost:8000(/api/[^"]*)"', r'getApiEndpoint("\1")', content)

        # Handle ${API_URL} references - replace with getApiEndpoint('')
        content = re.sub(r'\$\{API_URL\}/api/', 'getApiEndpoint("/api/', content)
        content = re.sub(r'\`\$\{API_URL\}', 'getApiEndpoint(`', content)

        # Handle any remaining localhost:8000
        content = re.sub(r'http://localhost:8000', "${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}", content)

        # Write back if changed
        if content != original_content:
            with open(file_path, 'w') as f:
                f.write(content)
            print(f"  ✓ Updated {file_path}")

    print("\n✅ API URL update complete!")
    print("\n📝 Note: For production deployment, set NEXT_PUBLIC_API_URL in your environment variables")

if __name__ == "__main__":
    fix_api_urls()