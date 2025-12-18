# TASK-007: Context & Decisions

**Last Updated:** 2025-12-18

---

## Current State

**Status:** Not Started

**Completed:**
- [x] Security audit - identified all exposed secrets
- [x] Verified .env files are properly gitignored
- [x] Confirmed GitHub PAT is still valid (not auto-revoked)
- [x] Created implementation plan

**In Progress:**
- Nothing yet

**Next Steps:**
- Phase 1: Replace secrets with placeholders in code

---

## Key Decisions

### Decision 1: Clean vs Rotate
**Question:** Should we rotate secrets or just clean history?
**Decision:** Clean history + replace with placeholders (no rotation)
**Rationale:** Repo is private, only owner has access, secrets haven't been exposed

### Decision 2: Developer Permission Level
**Question:** What GitHub permission level for new developer?
**Decision:** "Write" permission
**Rationale:** Allows pushing to branches and creating PRs, but cannot push to protected main branch, delete repo, or access secrets

### Decision 3: Branch Protection
**Question:** How strict should branch protection be?
**Decision:** Require 1 approval, dismiss stale reviews
**Rationale:** Prevents accidental or malicious direct pushes to main while keeping workflow simple for 2-person team

---

## Secrets Inventory

### GitHub PAT
- **Value:** `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`
- **Files:** CLAUDE.md, .mcp.json, .claude/DEPENDENCIES.md, .claude/TROUBLESHOOTING.md
- **Placeholder:** `<YOUR_GITHUB_PAT>`

### Database Password
- **Value:** `Y7pX9fL3QrD6zW`
- **Files:** .mcp.json, backend/migrations/*.md, .claude/archive/deployment/DEPLOYMENT_GUIDE.md
- **Placeholder:** `<DB_PASSWORD>`

### Supabase Service Role Key
- **Value:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndzdHd3bWlpaGt6bGd2bHltbGZkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTU2NjgzNCwiZXhwIjoyMDY3MTQyODM0fQ.9ricgGpcud76PWbxCgKuT1-fkN-ky_LOclRUJ2TuL3g`
- **Files:** backend/test_organization_strict.py, backend/gen_export.sh, .claude/archive/deployment/DEPLOYMENT_GUIDE.md
- **Placeholder:** `<SUPABASE_SERVICE_ROLE_KEY>`

### Supabase Anon Key
- **Value:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndzdHd3bWlpaGt6bGd2bHltbGZkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE1NjY4MzQsImV4cCI6MjA2NzE0MjgzNH0.wM4Ipk_rDwiuXbJR0olP0MCFjzZv3a46lOrBX4eTow0`
- **Files:** backend/gen_export.sh
- **Placeholder:** `<SUPABASE_ANON_KEY>`

### VPS Credentials
- **IP:** `217.26.25.207`
- **Password:** `V5z!s%PjGVeD`
- **Files:** .claude/SESSION_PROGRESS.md
- **Placeholder:** `<VPS_IP>`, `<VPS_PASSWORD>`

### Railway API Token
- **Value:** `09ab2185-e96f-4607-a577-64cd4188c80a`
- **Files:** .claude/scripts/deployment/railway-api.sh
- **Placeholder:** `<RAILWAY_API_TOKEN>`

---

## Files Modified

Will be updated as work progresses:

| File | Action | Status |
|------|--------|--------|
| CLAUDE.md | Replace GitHub PAT | [ ] |
| .mcp.json | Replace GitHub PAT, DB password | [ ] |
| .claude/DEPENDENCIES.md | Replace GitHub PAT | [ ] |
| .claude/TROUBLESHOOTING.md | Replace GitHub PAT | [ ] |
| backend/migrations/EXECUTE_MIGRATION_011.md | Replace DB password | [ ] |
| backend/migrations/MIGRATION_011_SUMMARY.md | Replace DB password | [ ] |
| backend/test_organization_strict.py | Replace Supabase key | [ ] |
| backend/gen_export.sh | Replace Supabase keys | [ ] |
| backend/debug_quote_items.py | Replace Supabase key | [ ] |
| .claude/archive/deployment/DEPLOYMENT_GUIDE.md | Replace all secrets | [ ] |
| .claude/SESSION_PROGRESS.md | Replace VPS IP | [ ] |
| .claude/scripts/deployment/railway-api.sh | Replace Railway token | [ ] |

---

## Known Issues

1. **BFG requires Java** - May need `brew install java` if not installed
2. **Force push rewrites history** - Any existing clones become invalid
3. **.mcp.json contains local paths** - Developer will need their own copy

---

## Integration Points

- **GitHub:** Branch protection, collaborator invitation
- **Local:** .mcp.json will need developer-specific configuration
- **Git:** History rewrite affects all clones

---

## Notes for Resuming

When continuing this task:
1. Read this context.md first
2. Check tasks.md for current progress
3. Run grep commands from plan.md to verify current state
4. Continue from where left off
