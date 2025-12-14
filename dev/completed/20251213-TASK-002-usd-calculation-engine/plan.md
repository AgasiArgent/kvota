# TASK-002: USD-Based Calculation Engine

**Created:** 2025-12-13
**Status:** In Progress
**Estimated:** ~4 hours

---

## Objective

Change calculation engine to work in USD instead of quote currency for analytics purposes.

## Success Criteria

- [ ] All existing test scenarios produce same results (when converted to USD)
- [ ] New engine produces USD values directly
- [ ] Display values convert correctly to quote currency
- [ ] No rounding errors > 0.01

---

## Technical Approach

**Strategy:** Safe parallel implementation - new file, validate against old, then swap.

### Why USD?
- Analytics need consistent currency for comparison
- Current: Calculate in quote currency, derive USD for totals only
- New: Calculate in USD, derive quote currency for 4 display values

### Display Values (Quote Currency)
Only these need conversion for client-facing output:
1. `sales_price_per_unit_no_vat` (AJ16)
2. `sales_price_total_no_vat` (AK16)
3. `profit` (AF16)
4. `profit_per_unit` (derived)

---

## Implementation Phases

### Phase 1: Create USD Engine (~1 hour)
- Copy `calculation_engine.py` → `calculation_engine_usd.py`
- Modify Phase 1: Convert to USD instead of quote currency
- Rename: `*_quote_currency` → `*_usd`

### Phase 2: Validation Tests (~1 hour)
- Create `test_calculation_engine_comparison.py`
- Compare: old results → USD vs new results directly
- Test USD, EUR, RUB quote scenarios

### Phase 3: Input Layer (~30 min)
- `quotes_calc.py`: Exchange rate to USD
- `quotes_upload.py`: Cost conversion to USD

### Phase 4: Display Conversion (~30 min)
- Add post-calculation USD → quote currency conversion
- Only for 4 display values

### Phase 5: Storage & Swap (~30 min)
- Update storage to save USD values
- Validate suite passes
- Swap files, archive old

### Phase 6: Documentation (~30 min)
- Update skill resources
- Update SESSION_PROGRESS.md

---

## Files to Modify

| File | Change |
|------|--------|
| `backend/calculation_engine_usd.py` | NEW |
| `backend/tests/test_calculation_engine_comparison.py` | NEW |
| `backend/routes/quotes_calc.py` | Exchange rate direction |
| `backend/routes/quotes_upload.py` | Cost conversion |
| `backend/archive/calculation_engine_quote_currency.py` | Archive |

---

## Risk Mitigation

1. **Parallel development** - New file, don't touch old until validated
2. **Mathematical verification** - Compare converted old vs new
3. **Rollback ready** - Old engine preserved in archive
4. **Incremental testing** - Validate each phase

---

## References

- Currency flow: `.claude/skills/calculation-engine-guidelines/resources/currency-handling.md`
- Database mapping: `.claude/skills/calculation-engine-guidelines/resources/phase-to-database-mapping.md`
- Plan file: `.claude/plans/elegant-hugging-token.md`
