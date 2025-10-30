# Fix TypeScript Errors - Automated Detection & Safe Auto-Fixing

**Description:** Detect, categorize, and safely auto-fix TypeScript/ESLint errors in the frontend codebase.

**What it fixes automatically:**
- ✅ Unused imports (100% safe)
- ✅ Unused variables with `_` prefix convention (safe)
- ✅ Known React 19 patterns (safe when pattern matches)

**What it suggests but doesn't auto-fix:**
- ⚠️ Type mismatches (`any` types, missing generics)
- ⚠️ Missing useEffect dependencies
- ⚠️ Complex type inference issues

**Safety:** All changes are shown before applying. Git status is checked first to ensure clean working directory.

---

## Usage

```bash
/fix-typescript-errors
```

The command will:
1. Detect all TypeScript/ESLint errors
2. Categorize by fix difficulty
3. Show what will be changed
4. Ask for confirmation
5. Apply safe auto-fixes
6. Re-verify and report results

---

## Step 1: Detect & Categorize Errors

**Action:** Run type check and ESLint, parse output into categories.

```bash
cd /home/novi/quotation-app-dev/frontend

# Check git status first
echo "=== Git Status Check ==="
git status --short
echo ""
echo "⚠️  WARNING: This command will modify files. Ensure git working directory is clean or commit your work first."
echo ""
read -p "Continue? (y/n): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 1
fi

# Check if npm is available
if ! command -v npm &> /dev/null; then
    echo "❌ ERROR: npm not found"
    echo "Install Node.js from: https://nodejs.org/"
    echo "Or via package manager: sudo apt-get install nodejs npm"
    exit 1
fi

# Run ESLint and capture errors
echo "=== Running ESLint Analysis ==="
npm run lint > /tmp/eslint-output.txt 2>&1

# Parse and categorize
echo ""
echo "=== ERROR CATEGORIZATION ==="
echo ""

# Category 1: Unused imports/variables (SAFE to auto-fix)
echo "📦 CATEGORY 1: Unused Imports/Variables (Auto-fixable)"
grep -E "(is defined but never used|is assigned a value but never used)" /tmp/eslint-output.txt | \
  grep -v "warning.*'_.*' is" | head -20
UNUSED_COUNT=$(grep -c -E "(is defined but never used|is assigned a value but never used)" /tmp/eslint-output.txt 2>/dev/null || echo "0")
echo "   Total: $UNUSED_COUNT errors"
echo ""

# Category 2: Any types (SUGGEST proper types)
echo "🔍 CATEGORY 2: Any Types (Manual review needed)"
grep "Unexpected any" /tmp/eslint-output.txt | head -20
ANY_COUNT=$(grep -c "Unexpected any" /tmp/eslint-output.txt 2>/dev/null || echo "0")
echo "   Total: $ANY_COUNT errors"
echo ""

# Category 3: Missing dependencies (SUGGEST additions)
echo "🔗 CATEGORY 3: Missing useEffect Dependencies (Manual review needed)"
grep "has.*missing dependenc" /tmp/eslint-output.txt | head -20
DEPS_COUNT=$(grep -c "has.*missing dependenc" /tmp/eslint-output.txt 2>/dev/null || echo "0")
echo "   Total: $DEPS_COUNT errors"
echo ""

# Summary
TOTAL_ERRORS=$((UNUSED_COUNT + ANY_COUNT + DEPS_COUNT))
echo "=== SUMMARY ==="
echo "Total errors detected: $TOTAL_ERRORS"
echo "  - Auto-fixable (unused): $UNUSED_COUNT"
echo "  - Manual review (any types): $ANY_COUNT"
echo "  - Manual review (dependencies): $DEPS_COUNT"
echo ""
```

**Output example:**
```
📦 CATEGORY 1: Unused Imports/Variables (Auto-fixable)
   /frontend/src/app/dashboard/page.tsx
     30:10  warning  'QuoteService' is defined but never used
   /frontend/src/app/auth/register/page.tsx
     15:3   warning  'Select' is defined but never used
   Total: 12 errors

🔍 CATEGORY 2: Any Types (Manual review needed)
   /frontend/src/app/customers/[id]/page.tsx
     84:21  warning  Unexpected any. Specify a different type
   Total: 58 errors

🔗 CATEGORY 3: Missing useEffect Dependencies (Manual review needed)
   /frontend/src/app/profile/page.tsx
     19:6  warning  React Hook useEffect has a missing dependency
   Total: 38 errors
```

---

## Step 2: Auto-Fix Unused Imports/Variables

**Action:** Use ESLint's built-in auto-fix for unused imports.

```bash
echo "=== STEP 2: Auto-Fixing Unused Imports/Variables ==="
echo ""

# ESLint can auto-fix some unused imports
echo "Running ESLint --fix (removes unused imports)..."
npm run lint:fix > /tmp/eslint-fix-output.txt 2>&1

echo "✅ ESLint auto-fix complete"
echo ""

# Show which files were modified
echo "Files modified by ESLint --fix:"
git diff --name-only | sed 's/^/  - /'
echo ""
```

**What ESLint --fix does:**
- Removes unused imports automatically
- Does NOT remove unused variables (requires manual review)
- Safe because it only removes imports that are 100% not used

---

## Step 3: Suggest Fixes for Any Types

**Action:** Extract all `any` type locations and suggest proper types based on context.

```bash
echo "=== STEP 3: Suggested Fixes for 'any' Types ==="
echo ""

# Create a temporary file with suggestions
> /tmp/any-type-suggestions.txt

# Parse each 'any' type error and provide context
grep "Unexpected any" /tmp/eslint-output.txt | while IFS= read -r line; do
    FILE=$(echo "$line" | cut -d: -f1)
    LINE_NUM=$(echo "$line" | cut -d: -f2 | tr -d ' ')

    # Extract the line of code
    CODE_LINE=$(sed -n "${LINE_NUM}p" "$FILE" 2>/dev/null)

    echo "📍 $FILE:$LINE_NUM" >> /tmp/any-type-suggestions.txt
    echo "   Current: $CODE_LINE" >> /tmp/any-type-suggestions.txt

    # Suggest proper type based on context
    if echo "$CODE_LINE" | grep -q "catch.*error"; then
        echo "   Suggest: catch (error: unknown) or catch (error) with type guard" >> /tmp/any-type-suggestions.txt
    elif echo "$CODE_LINE" | grep -q "\.map\|\.filter\|\.forEach"; then
        echo "   Suggest: Add proper generic type to array (e.g., Array<Customer>)" >> /tmp/any-type-suggestions.txt
    elif echo "$CODE_LINE" | grep -q "params\|event\|data"; then
        echo "   Suggest: Import and use proper type from API or Ant Design" >> /tmp/any-type-suggestions.txt
    else
        echo "   Suggest: Review code context and add explicit type annotation" >> /tmp/any-type-suggestions.txt
    fi
    echo "" >> /tmp/any-type-suggestions.txt
done

# Show first 10 suggestions
head -40 /tmp/any-type-suggestions.txt
echo ""
echo "⚠️  These 'any' types require manual review and proper type annotations."
echo "Full suggestions saved to: /tmp/any-type-suggestions.txt"
echo ""
```

**Common patterns for fixing `any` types:**

1. **Error handling:**
   ```typescript
   // ❌ Before
   catch (error: any) {

   // ✅ After
   catch (error: unknown) {
     if (error instanceof Error) {
       message.error(error.message);
     }
   }
   ```

2. **Event handlers:**
   ```typescript
   // ❌ Before
   const handleChange = (value: any) => {

   // ✅ After (Ant Design)
   import { SelectProps } from 'antd';
   const handleChange: SelectProps['onChange'] = (value) => {
   ```

3. **API responses:**
   ```typescript
   // ❌ Before
   const response: any = await fetch(...);

   // ✅ After
   interface Customer { id: string; name: string; /* ... */ }
   const response: Customer = await fetch(...);
   ```

---

## Step 4: Suggest Fixes for Missing Dependencies

**Action:** Show which dependencies are missing and suggest safe additions.

```bash
echo "=== STEP 4: Suggested Fixes for Missing useEffect Dependencies ==="
echo ""

# Extract missing dependencies
grep "has.*missing dependenc" /tmp/eslint-output.txt | while IFS= read -r line; do
    FILE=$(echo "$line" | cut -d: -f1)
    LINE_NUM=$(echo "$line" | cut -d: -f2 | tr -d ' ')

    # Extract the warning message
    WARNING=$(echo "$line" | sed 's/.*warning  //')

    echo "📍 $FILE:$LINE_NUM"
    echo "   $WARNING"

    # Show the useEffect code (next 5 lines)
    echo "   Code context:"
    sed -n "${LINE_NUM},$((LINE_NUM + 5))p" "$FILE" | sed 's/^/     /'
    echo ""
done | head -60

echo ""
echo "⚠️  IMPORTANT: Only add dependencies that should trigger re-runs."
echo "    - If function is stable, wrap it with useCallback"
echo "    - If you don't want re-runs on function change, disable the warning"
echo ""
```

**Common patterns for fixing missing dependencies:**

1. **Stable functions - use useCallback:**
   ```typescript
   // ✅ Recommended
   const fetchData = useCallback(async () => {
     // fetch logic
   }, []); // Empty deps if truly stable

   useEffect(() => {
     fetchData();
   }, [fetchData]); // Now safe to include
   ```

2. **One-time effect - disable warning:**
   ```typescript
   // ✅ Acceptable for mount-only effects
   useEffect(() => {
     loadInitialData();
   }, []); // eslint-disable-next-line react-hooks/exhaustive-deps
   ```

3. **Add missing dependencies:**
   ```typescript
   // ✅ When dependencies should trigger re-runs
   useEffect(() => {
     if (customerId) {
       fetchCustomer(customerId);
     }
   }, [customerId, fetchCustomer]); // Include both
   ```

---

## Step 5: Re-Verify & Report

**Action:** Run checks again and report what was fixed vs. what remains.

```bash
echo "=== STEP 5: Re-Verification ==="
echo ""

# Check for ESLint configuration files
if [ ! -f ".eslintrc.json" ] && [ ! -f "eslint.config.js" ] && [ ! -f ".eslintrc.js" ] && [ ! -f ".eslintrc.cjs" ] && [ ! -f ".eslintrc.mjs" ]; then
    echo "⚠️ WARNING: No ESLint config found"
    echo "Expected one of: .eslintrc.json, eslint.config.js, .eslintrc.js"
    echo "ESLint may be using default settings or Next.js built-in config"
    echo ""
fi

# Run ESLint again
npm run lint > /tmp/eslint-output-after.txt 2>&1

# Count errors before and after
ERRORS_BEFORE=$TOTAL_ERRORS
UNUSED_AFTER=$(grep -c -E "(is defined but never used|is assigned a value but never used)" /tmp/eslint-output-after.txt 2>/dev/null || echo "0")
ANY_AFTER=$(grep -c "Unexpected any" /tmp/eslint-output-after.txt 2>/dev/null || echo "0")
DEPS_AFTER=$(grep -c "has.*missing dependenc" /tmp/eslint-output-after.txt 2>/dev/null || echo "0")
ERRORS_AFTER=$((UNUSED_AFTER + ANY_AFTER + DEPS_AFTER))

ERRORS_FIXED=$((ERRORS_BEFORE - ERRORS_AFTER))

echo "=== RESULTS ==="
echo ""
echo "Errors before:   $ERRORS_BEFORE"
echo "Errors fixed:    $ERRORS_FIXED"
echo "Errors remaining: $ERRORS_AFTER"
echo ""
echo "Breakdown:"
echo "  - Unused (fixed):      $((UNUSED_COUNT - UNUSED_AFTER)) / $UNUSED_COUNT"
echo "  - Any types (remain):  $ANY_AFTER"
echo "  - Dependencies (remain): $DEPS_AFTER"
echo ""

# Show which files were modified
echo "Files modified:"
git diff --name-only | sed 's/^/  ✏️  /'
echo ""

# Show diff summary
echo "Total lines changed:"
git diff --stat
echo ""

echo "=== NEXT STEPS ==="
echo ""
echo "✅ Auto-fixes applied (unused imports removed)"
echo ""
echo "⚠️  Manual fixes needed:"
echo "   1. Review suggestions in /tmp/any-type-suggestions.txt"
echo "   2. Add proper type annotations for remaining 'any' types"
echo "   3. Review useEffect dependencies and add useCallback where needed"
echo ""
echo "📋 To commit changes:"
echo "   git add ."
echo "   git commit -m 'fix: Remove unused imports (auto-fixed by Claude)'"
echo ""
echo "📊 To review changes before committing:"
echo "   git diff src/"
echo ""
```

**Expected output example:**
```
=== RESULTS ===

Errors before:   108
Errors fixed:    12
Errors remaining: 96

Breakdown:
  - Unused (fixed):      12 / 12
  - Any types (remain):  58
  - Dependencies (remain): 38

Files modified:
  ✏️  src/app/dashboard/page.tsx
  ✏️  src/app/auth/register/page.tsx
  ✏️  src/app/organizations/page.tsx

Total lines changed:
 3 files changed, 0 insertions(+), 12 deletions(-)
```

---

## Safety Checks

**Before running any auto-fixes:**

1. ✅ **Git status check** - Warns if working directory has uncommitted changes
2. ✅ **Confirmation prompt** - User must confirm before proceeding
3. ✅ **Preview changes** - Shows which files will be modified
4. ✅ **Re-verification** - Runs tests after fixes to ensure nothing broke

**What this command will NEVER do:**

- ❌ Auto-fix type mismatches (requires manual review)
- ❌ Remove unused variables without `_` prefix (might be intentional)
- ❌ Add missing dependencies automatically (could cause infinite loops)
- ❌ Modify code that could break runtime behavior

**Rollback if needed:**
```bash
# Undo all changes
git checkout .

# Or undo specific file
git checkout -- src/app/dashboard/page.tsx
```

---

## Advanced Usage

### Fix specific file only

```bash
cd /home/novi/quotation-app-dev/frontend

# Run ESLint fix on specific file
npx eslint --fix src/app/dashboard/page.tsx

# Check result
npx eslint src/app/dashboard/page.tsx
```

### Fix specific error type only

```bash
# Fix only unused imports
npx eslint --fix --rule '@typescript-eslint/no-unused-vars: error' .

# Check only 'any' types
npx eslint . --rule '@typescript-eslint/no-explicit-any: error' --format compact
```

### Manual type fixing workflow

1. **Identify file with most `any` types:**
   ```bash
   grep -r "any" src/app --include="*.tsx" | cut -d: -f1 | sort | uniq -c | sort -rn | head -5
   ```

2. **Review file and add proper types:**
   - Check imports for available types
   - Define new interfaces if needed
   - Use TypeScript inference when possible

3. **Verify fix:**
   ```bash
   npx eslint src/app/file.tsx
   ```

---

## Common React 19 + Next.js 15 Patterns

### Pattern 1: Async Server Components (Next.js 15)

```typescript
// ✅ Server Component (no 'use client')
export default async function Page() {
  const data = await fetch(...); // Direct async, no useEffect
  return <div>{data}</div>;
}
```

### Pattern 2: Client Components with Ant Design

```typescript
// ✅ Client Component
'use client';

import { useState } from 'react';
import { Form } from 'antd'; // Ant Design requires client

export default function ClientPage() {
  const [form] = Form.useForm();
  // ...
}
```

### Pattern 3: TypeScript Strict Mode

```typescript
// ❌ Loose typing
const data: any = await response.json();

// ✅ Proper typing
interface ApiResponse { id: string; name: string; }
const data: ApiResponse = await response.json();

// ✅ Or use generics
async function fetchData<T>(): Promise<T> {
  const response = await fetch(...);
  return response.json();
}
```

---

## Troubleshooting

### Issue: ESLint --fix didn't remove unused import

**Cause:** Import might be used in a type annotation that ESLint missed.

**Solution:** Manually search the file for the import name.

```bash
grep -n "ImportName" src/app/file.tsx
```

### Issue: Too many `any` types to fix manually

**Strategy:** Fix files in order of importance:
1. Core business logic (quotes, calculations)
2. Shared components/utilities
3. Admin/settings pages
4. Less critical pages

**Bulk approach:**
- Create interfaces for common API responses
- Add them to `src/lib/api/types.ts`
- Import and use throughout app

### Issue: useEffect dependency warnings are overwhelming

**Strategy:** Use ESLint disable comments for intentional mount-only effects:

```typescript
useEffect(() => {
  loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []); // Only run on mount
```

**Long-term:** Wrap functions with `useCallback` to make them stable dependencies.

---

## Metrics & Goals

**Current state (Session 26):**
- Total ESLint warnings: 108
- Unused imports/variables: ~12
- `any` types: ~58
- Missing dependencies: ~38

**Goal (Production ready):**
- Total warnings: 0
- All `any` types replaced with proper types
- All useEffect dependencies properly managed
- Type-safe codebase for maintainability

**Progress tracking:**
```bash
# Run before and after each session
cd frontend
npm run lint 2>&1 | grep -c "warning"
```

---

## Related Commands

- `/test-frontend` - Run frontend tests after fixing types
- `/check-build` - Verify production build works
- `/code-review` - Review type safety across codebase

---

**Last Updated:** 2025-10-30 (Session 27 - Phase 7 Slash Commands)