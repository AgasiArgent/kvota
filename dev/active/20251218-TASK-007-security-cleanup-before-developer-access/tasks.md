# TASK-007: Task Checklist

**Last Updated:** 2025-12-18

---

## Phase 1: Replace Secrets with Placeholders (~15 min)

### GitHub PAT
- [ ] CLAUDE.md - Replace `***REMOVED***` with `<YOUR_GITHUB_PAT>`
- [ ] .mcp.json - Replace GitHub PAT
- [ ] .claude/DEPENDENCIES.md - Replace all GitHub PAT occurrences
- [ ] .claude/TROUBLESHOOTING.md - Replace all GitHub PAT occurrences

### Database Password
- [ ] .mcp.json - Replace `***REMOVED***` with `<DB_PASSWORD>`
- [ ] backend/migrations/EXECUTE_MIGRATION_011.md - Replace DB password
- [ ] backend/migrations/MIGRATION_011_SUMMARY.md - Replace DB password
- [ ] .claude/archive/deployment/DEPLOYMENT_GUIDE.md - Replace DB password

### Supabase Keys
- [ ] backend/test_organization_strict.py - Replace service role key with `<SUPABASE_SERVICE_ROLE_KEY>`
- [ ] backend/gen_export.sh - Replace both anon and service role keys
- [ ] backend/debug_quote_items.py - Replace service role key
- [ ] .claude/archive/deployment/DEPLOYMENT_GUIDE.md - Replace Supabase keys

### VPS Credentials
- [ ] .claude/SESSION_PROGRESS.md - Replace IP `***REMOVED***` with `<VPS_IP>`
- [ ] Remove any VPS password references

### Other
- [ ] .claude/scripts/deployment/railway-api.sh - Replace Railway token with `<RAILWAY_API_TOKEN>`

---

## Phase 2: Commit Changes (~2 min)

- [ ] Stage all changes: `git add -A`
- [ ] Commit with security message
- [ ] Verify commit looks correct: `git show --stat`

---

## Phase 3: Clean Git History (~10 min)

### Prerequisites
- [ ] Verify BFG installed: `bfg --version`
- [ ] If not installed: `brew install bfg`

### Create Secrets File
- [ ] Create `/tmp/secrets-to-remove.txt` with all secrets

### Run BFG
- [ ] Run: `bfg --replace-text /tmp/secrets-to-remove.txt`
- [ ] Run: `git reflog expire --expire=now --all`
- [ ] Run: `git gc --prune=now --aggressive`

### Force Push
- [ ] Run: `git push --force --all`
- [ ] Run: `git push --force --tags` (if applicable)

---

## Phase 4: Verify Cleanup (~5 min)

### Check Git History
- [ ] Search for GitHub PAT in history: `git log -p --all -S "ghp_MZ4W"` (should be empty)
- [ ] Search for DB password in history: `git log -p --all -S "Y7pX9f"` (should be empty)
- [ ] Search for Supabase key in history: `git log -p --all -S "9ricgG"` (should be empty)

### Check Current Files
- [ ] Run grep for GitHub PAT (should return nothing)
- [ ] Run grep for DB password (should return nothing)
- [ ] Run grep for Supabase key (should return nothing)

---

## Phase 5: Set Up Branch Protection (~5 min)

- [ ] Navigate to GitHub repo settings
- [ ] Go to Branches > Add rule
- [ ] Set branch pattern: `main`
- [ ] Enable "Require a pull request before merging"
- [ ] Set required approvals: 1
- [ ] Enable "Dismiss stale PR approvals"
- [ ] Save rule
- [ ] Verify rule shows as active

---

## Phase 6: Invite Developer (~2 min)

- [ ] Go to repo Settings > Collaborators
- [ ] Click "Add people"
- [ ] Enter developer's GitHub username/email
- [ ] Select "Write" permission
- [ ] Send invite
- [ ] Verify developer received invite

---

## Post-Completion Verification

- [ ] Developer can clone repo
- [ ] Developer can create branches
- [ ] Developer can push to their branches
- [ ] Developer CANNOT push directly to main
- [ ] Developer can create PRs
- [ ] You can review and merge PRs
- [ ] No secrets visible in any file or history

---

## Summary

| Phase | Tasks | Estimated Time | Status |
|-------|-------|----------------|--------|
| 1. Replace Secrets | 15 | ~15 min | [ ] Not Started |
| 2. Commit | 3 | ~2 min | [ ] Not Started |
| 3. Clean History | 5 | ~10 min | [ ] Not Started |
| 4. Verify | 6 | ~5 min | [ ] Not Started |
| 5. Branch Protection | 7 | ~5 min | [ ] Not Started |
| 6. Invite Developer | 5 | ~2 min | [ ] Not Started |
| **Total** | **41** | **~40 min** | |

---

## Notes

- All times are estimates
- Phase 3 (BFG) might take longer on slow connections
- If any verification fails, stop and investigate before proceeding
