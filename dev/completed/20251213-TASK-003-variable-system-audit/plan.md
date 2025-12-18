# Variable System Documentation Audit - Plan

**Task ID:** TASK-003
**Created:** 2025-12-13
**Status:** In Progress
**Owner:** User + Claude
**Estimated Time:** 1-2 days (thorough audit)
**Last Updated:** 2025-12-13

---

## 1. Objective

### What Problem Are We Solving?

1. **No single source of truth** - 12+ docs scattered across active/archive/skills
2. **Unknown currency handling** - What currency are calculations done in? Stored in? Displayed in?
3. **Docs may be wrong** - Comments and docs might not match actual code
4. **Missing data flow** - No end-to-end documentation (UI → API → Calc → DB → Export)

### Success Criteria

- [ ] Know EXACTLY what currency calculations happen in (from code, not docs)
- [ ] All variables mapped: Name → Type → Storage → Display
- [ ] Complete data flow documented (input to output)
- [ ] Export mapping documented (what appears in Excel/PDF)
- [ ] Single source of truth in calculation-engine-guidelines skill
- [ ] Discrepancies between old docs and reality noted

### Approach

**RULE: Read actual code, not comments or docs. Code is truth.**

---

## 2. Output Structure

### Skill Upgrade (calculation-engine-guidelines)

```
.claude/skills/calculation-engine-guidelines/
├── SKILL.md                         # Overview + when to use
├── resources/
│   ├── variable-master-list.md      # NEW: All variables (single source of truth)
│   ├── data-flow.md                 # NEW: Complete data flow diagram
│   ├── currency-handling.md         # NEW: Currency truth (from code analysis)
│   ├── database-mapping.md          # NEW: Variables → DB columns
│   ├── export-mapping.md            # NEW: Variables in Excel/PDF
│   ├── calculation-phases.md        # EXISTS: 13 phases (verify/update)
│   └── ... (other existing files)
```

### Quick Reference (separate, short)

```
.claude/VARIABLES_QUICK_REF.md       # 50-line cheat sheet for humans
```

---

## 3. Investigation Phases

### Phase 1: Currency Truth (Priority #1)
**Goal:** Answer "What currency are calculations done in?"

**Investigate:**
- `backend/calculation_engine.py` - Where do calculations happen?
- `backend/calculation_models.py` - Input/output types
- `backend/services/multi_currency_service.py` - Currency conversion
- `backend/routes/quotes_calc.py` - API layer
- Database: What's actually stored in quote_items, quote_calculation_variables

**Questions to answer:**
- Input currency: What does user enter?
- Calculation currency: What does engine use internally?
- Storage currency: What's saved to DB?
- Display currency: What does user see?
- Conversion: When/where does conversion happen?

---

### Phase 2: Variable Inventory
**Goal:** Complete list of all variables from actual code

**Investigate:**
- `backend/calculation_models.py` - Pydantic models (DONE - found ~40 vars)
- `backend/calculation_engine.py` - Additional calculated values
- `frontend/src/types/` - TypeScript interfaces
- Database tables - actual columns

**Deliverable:** Master variable list with:
- Variable name
- Type (Decimal, int, string, enum)
- Category (Product, Financial, Logistics, etc.)
- Level (Quote-level vs Product-level)
- Source (user input vs calculated vs system)

---

### Phase 3: Data Flow Tracing
**Goal:** Document complete flow from UI to storage and back

**Trace forward (input):**
1. UI form → What fields exist?
2. Frontend state → How are values held?
3. API request → What's sent to backend?
4. Calculation engine → What transformations?
5. Database → What's stored, in what format?

**Trace backward (output):**
1. Database → Raw data
2. API response → What's returned?
3. Frontend display → What's shown?
4. Exports → What appears in Excel/PDF?

---

### Phase 4: Export Mapping
**Goal:** Document what appears in each export format

**Investigate:**
- Excel export service
- PDF generation
- Column/field mapping
- Calculated fields in exports

---

### Phase 5: Verification & Cleanup
**Goal:** Compare old docs vs reality, consolidate

**Tasks:**
- Compare VARIABLES.md (44 vars) vs actual count
- Check archive docs for outdated info
- Note discrepancies
- Archive obsolete docs
- Update skill with new resources

---

## 4. Decisions Made

### Decision 1: Output Format
**Choice:** Upgrade calculation-engine-guidelines skill + quick reference
**Rationale:** Skills auto-activate, survives autocompact, already partially exists

### Decision 2: Investigation Method
**Choice:** Read actual code, not comments/docs
**Rationale:** User confirmed docs may be wrong, need ground truth

### Decision 3: Scope
**Choice:** Thorough (1-2 days)
**Rationale:** Need complete picture for reliable feature development

### Decision 4: Priority
**Choice:** Currency handling first
**Rationale:** User's biggest pain point, affects all calculations

---

## 5. Key Files to Investigate

### Backend (Python)
- `backend/calculation_models.py` - Variable definitions ✓ READ
- `backend/calculation_engine.py` - 13 phases, actual calculations
- `backend/routes/quotes_calc.py` - API endpoint, mapping
- `backend/routes/quotes.py` - CRUD, JSONB storage
- `backend/services/multi_currency_service.py` - Currency conversion
- `backend/services/export_service.py` - Excel/PDF exports

### Frontend (TypeScript)
- `frontend/src/app/quotes/create/page.tsx` - Creation form
- `frontend/src/types/` - TypeScript interfaces
- `frontend/src/components/` - Input components

### Database
- `docs/DATABASE_SCHEMA.md` - Schema reference
- Actual tables: quotes, quote_items, quote_calculation_variables, calculation_settings
