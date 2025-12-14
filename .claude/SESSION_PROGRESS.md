# Session Progress

**Last Updated:** 2025-12-14 (Session 74)

---

## Current TODO

- [ ] Test Dual Currency Storage E2E (verify `*_quote` columns populated)
- [ ] Investigate Organization Switching Bug (customer goes to wrong org)
- [ ] Test VPS Latency from Russia

---

## Recent Completed

### Session 74 (2025-12-14) - TASK-002 Complete

**USD Calculation Engine Fixes** - PR #26

Key discovery: Calculation engine already currency-agnostic!
- Fixed `quotes_upload.py` to match `quotes_calc.py` (both use USD)
- Fixed validation export currency conversion (column D formulas)
- Fixed DM fee conversion, conditional formatting threshold

### Sessions 67-73 (Dec 7-13)

- VPS Migration complete (api.kvotaflow.ru, db.kvotaflow.ru)
- shadcn/ui migration complete
- Dual currency storage (USD + quote currency)
- Telegram notifications + Sentry error tracking
- GitHub Actions auto-deploy

---

## Architecture

```
Vercel (kvotaflow.ru) → VPS Russia (***REMOVED***)
                        ├─ api.kvotaflow.ru (FastAPI)
                        ├─ db.kvotaflow.ru (Supabase)
                        └─ Caddy (HTTPS)
```

---

## Key References

- **Skills:** `.claude/skills/` (calculation-engine, database-verification, frontend-dev, backend-dev)
- **Variables:** `.claude/VARIABLES.md`
- **Testing:** `.claude/TESTING_WORKFLOW.md`

---

## Archive

Sessions 61 and earlier: See git history.

Milestones: Multi-currency (48-49), Pre-deployment infra (26), Calculation engine (15), ag-Grid (8-14)
