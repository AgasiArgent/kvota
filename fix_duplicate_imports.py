#!/usr/bin/env python3
"""
Fix duplicate imports in TypeScript files
"""

import os
import re
from pathlib import Path

def fix_duplicate_imports():
    """Fix duplicate imports in all API service files"""

    # Find all TypeScript files in src/lib/api
    api_dir = Path("frontend/src/lib/api") if Path("frontend/src/lib/api").exists() else Path("src/lib/api")
    files_to_fix = list(api_dir.glob("*.ts"))

    for file_path in files_to_fix:
        with open(file_path, 'r') as f:
            lines = f.readlines()

        # Remove duplicate import lines
        seen_imports = set()
        new_lines = []

        for line in lines:
            # Check if it's an import from @/lib/config
            if "import" in line and "@/lib/config" in line:
                if line.strip() not in seen_imports:
                    seen_imports.add(line.strip())
                    new_lines.append(line)
                else:
                    print(f"Removing duplicate import in {file_path}")
            else:
                new_lines.append(line)

        # Write back if changed
        if len(new_lines) != len(lines):
            with open(file_path, 'w') as f:
                f.writelines(new_lines)
            print(f"Fixed {file_path}")

    # Also fix the duplicate config imports
    for file_path in files_to_fix:
        with open(file_path, 'r') as f:
            content = f.read()

        # Remove duplicate config imports
        content = re.sub(r"(import { config } from '@/lib/config';\n)+", "import { config } from '@/lib/config';\n", content)

        with open(file_path, 'w') as f:
            f.write(content)

    print("\n✅ Fixed all duplicate imports!")

if __name__ == "__main__":
    fix_duplicate_imports()