# TASK-007: Security Cleanup Before Developer Access

**Created:** 2025-12-18
**Status:** Not Started
**Priority:** HIGH (must complete before inviting new developer)

---

## Objective

Clean the repository of exposed secrets and set up proper access controls before inviting a new developer to collaborate on the project.

## Success Criteria

- [ ] All secrets removed from git history
- [ ] All secrets replaced with placeholders in current code
- [ ] Branch protection enabled on main branch
- [ ] New developer invited with "Write" (not Admin) permission
- [ ] No secrets visible to the new developer

---

## Background

During security audit, found 4 types of secrets committed to git:

| Secret Type | Example Value | Risk Level |
|-------------|---------------|------------|
| GitHub PAT | `***REMOVED***` | Medium |
| DB Password | `***REMOVED***` | High |
| Supabase Service Key | JWT token (production) | High |
| VPS Server IP | `***REMOVED***` | Low |

Since repo is private and only owner has access, secrets haven't been exposed externally. Plan is to clean history + replace with placeholders (no rotation needed).

---

## Phase 1: Replace Secrets with Placeholders (~15 min)

### Files to Update

**GitHub PAT (`***REMOVED***`):**
- `CLAUDE.md` (line ~711)
- `.mcp.json` (line ~20)
- `.claude/DEPENDENCIES.md` (multiple lines)
- `.claude/TROUBLESHOOTING.md` (multiple lines)

**DB Password (`***REMOVED***`):**
- `.mcp.json`
- `backend/migrations/EXECUTE_MIGRATION_011.md`
- `backend/migrations/MIGRATION_011_SUMMARY.md`
- `.claude/archive/deployment/DEPLOYMENT_GUIDE.md`

**Supabase Service Role Key:**
- `backend/test_organization_strict.py`
- `backend/gen_export.sh`
- `backend/debug_quote_items.py`
- `.claude/archive/deployment/DEPLOYMENT_GUIDE.md`

### Placeholder Format

```
# For GitHub token
<YOUR_GITHUB_PAT>

# For DB password
<DB_PASSWORD>

# For Supabase keys
<SUPABASE_SERVICE_ROLE_KEY>
<SUPABASE_ANON_KEY>

# For server credentials
<VPS_IP>
<VPS_PASSWORD>
```

---

## Phase 2: Commit Placeholder Changes (~2 min)

```bash
git add -A
git commit -m "security: replace hardcoded secrets with placeholders

Removed hardcoded credentials from:
- CLAUDE.md (GitHub PAT)
- .mcp.json (GitHub PAT, DB password)
- .claude/DEPENDENCIES.md (GitHub PAT)
- .claude/TROUBLESHOOTING.md (GitHub PAT)
- backend/migrations/*.md (DB password)
- backend/test_*.py (Supabase keys)
- backend/*.sh (Supabase keys)

Secrets should be stored in .env files (which are gitignored)
"
```

---

## Phase 3: Clean Git History with BFG (~10 min)

### Prerequisites

```bash
# Install BFG (if not installed)
brew install bfg
```

### Create Secrets File

```bash
cat > /tmp/secrets-to-remove.txt << 'EOF'
***REMOVED***
***REMOVED***
***REMOVED***
***REMOVED***
***REMOVED***
***REMOVED***
***REMOVED***
EOF
```

### Run BFG

```bash
cd /Users/andreynovikov/workspace/tech/projects/kvota/user-feedback

# Run BFG to replace secrets in all history
bfg --replace-text /tmp/secrets-to-remove.txt

# Clean up refs
git reflog expire --expire=now --all
git gc --prune=now --aggressive
```

### Force Push

```bash
# Force push all branches
git push --force --all

# Force push tags (if any)
git push --force --tags
```

**WARNING:** This rewrites history. Any existing clones will need to be re-cloned.

---

## Phase 4: Verify Cleanup (~5 min)

### Check No Secrets Remain

```bash
# Search for GitHub token
git log -p --all -S "***REMOVED***" | head -20

# Search for DB password
git log -p --all -S "***REMOVED***" | head -20

# Search for Supabase key
git log -p --all -S "9ricgGpcud76PWbxCgKuT1" | head -20
```

All should return empty (no matches).

### Verify Current Files

```bash
# Should return no matches
grep -r "***REMOVED***" . --include="*.md" --include="*.json" --include="*.py" --include="*.sh"
grep -r "***REMOVED***" . --include="*.md" --include="*.json" --include="*.py" --include="*.sh"
```

---

## Phase 5: Set Up Branch Protection (~5 min)

### Via GitHub UI

1. Go to: `https://github.com/AgasiArgent/kvota/settings/branches`
2. Click "Add rule"
3. Branch name pattern: `main`
4. Enable:
   - [x] Require a pull request before merging
   - [x] Require approvals: 1
   - [x] Dismiss stale PR approvals when new commits are pushed
   - [x] Require status checks to pass (if CI configured)
   - [x] Do not allow bypassing the above settings

### Via GitHub CLI (Alternative)

```bash
gh api repos/AgasiArgent/kvota/branches/main/protection -X PUT \
  -f required_pull_request_reviews='{"required_approving_review_count":1,"dismiss_stale_reviews":true}' \
  -f enforce_admins=true \
  -f required_status_checks=null \
  -f restrictions=null
```

---

## Phase 6: Invite Developer (~2 min)

### Via GitHub UI

1. Go to: `https://github.com/AgasiArgent/kvota/settings/access`
2. Click "Add people"
3. Enter developer's GitHub username or email
4. Select role: **Write** (NOT Admin)
5. Click "Add"

### Permission Levels Reference

| Role | Push to branches | Merge PRs | Delete repo | Manage secrets |
|------|------------------|-----------|-------------|----------------|
| Read | No | No | No | No |
| Triage | No | No | No | No |
| **Write** ✅ | Yes (not main) | Via PR only | No | No |
| Maintain | Yes | Yes | No | No |
| Admin | Yes | Yes | Yes | Yes |

---

## Post-Completion Checklist

- [ ] All secrets search returns empty
- [ ] Force push completed successfully
- [ ] Branch protection rule shows as active
- [ ] Developer received invite
- [ ] Developer can create branches but NOT push to main directly
- [ ] Test: Developer creates PR, you can review and merge

---

## Rollback Plan

If something goes wrong:

1. **Before force push:** You still have local history, just don't push
2. **After force push:** Contact GitHub support (they keep backups for ~90 days)
3. **If secrets were exposed:** Rotate all credentials immediately

---

## References

- [BFG Repo-Cleaner](https://rtyley.github.io/bfg-repo-cleaner/)
- [GitHub Branch Protection](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches)
- [GitHub Collaborator Permissions](https://docs.github.com/en/organizations/managing-user-access-to-your-organizations-repositories/repository-roles-for-an-organization)
