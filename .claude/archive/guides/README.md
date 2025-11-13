# Testing Guides Archive

**Archived:** 2025-10-29 (Session 34)

**Reason:** Testing workflows evolved, guides superseded by scripts/README.md

## Archived Files

1. **MANUAL_TESTING_GUIDE.md** - Manual testing scenarios for quote creation (Session 15)
2. **TIERED_TESTING_GUIDE.md** - Tiered testing strategy (Sessions 16-17)

## Status

### MANUAL_TESTING_GUIDE.md

**Original Purpose:** Step-by-step manual testing for quote creation + calculation engine

**Why Archived:**
- Guide created in Session 15 (calculation engine integration)
- Now superseded by automated testing workflows
- Chrome DevTools MCP automation replaced manual testing
- Current testing: See AUTOMATED_TESTING_WITH_CHROME_DEVTOOLS.md (active)

**Historical Value:**
Documents expected behavior and test scenarios from Session 15 when calculation engine was first integrated.

### TIERED_TESTING_GUIDE.md

**Original Purpose:** 4-tier testing strategy to prevent WSL2 freezing

**Why Archived:**
- Content 90% duplicated in `.claude/scripts/README.md`
- Scripts README is more actively maintained and comprehensive
- Created in Sessions 16-17 during WSL2 resource management work
- All unique content has been consolidated into scripts/README.md

**Current Testing Approach:**
- Automated: Chrome DevTools MCP (Tier 3-4 testing)
- Backend: pytest (Tier 1-2 testing)
- Tiered strategy: `.claude/scripts/README.md` (active)
- TDD practices: TESTING_WORKFLOW.md (active)

**Historical Value:**
Documents the discovery of WSL2 freezing problem and development of tiered testing solution.
