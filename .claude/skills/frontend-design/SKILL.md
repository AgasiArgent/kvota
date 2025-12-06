This skill guides creation of distinctive, production-grade frontend interfaces for the Kvota B2B quotation platform.

## Kvota Design System

**READ FIRST:** `resources/DESIGN_SYSTEM.md` - Complete design rulebook with:
- Color palette (warm dark theme with amber accent)
- Typography scale
- Layout patterns
- Component patterns
- ag-Grid styling
- Anti-patterns to avoid

## Quick Reference

### Theme: "Warm Linear Dark"
- Background: Dark greys (`#141414`, `#1f1f1f`)
- Text: Light grey (`#d9d9d9`), NOT white
- Accent: Amber (`#f59e0b`) for PRIMARY BUTTONS ONLY
- Semantic: Emerald (success), Rose (error)

### Golden Rules

1. **Amber is sacred** - Only for primary action buttons
2. **Grey everything else** - Sidebar, stats, labels all grey
3. **No blue anywhere** - We removed it intentionally
4. **Profit is special** - Green positive, red negative
5. **Muted labels** - Use 60% grey for headers/labels

### File References

| Purpose | File |
|---------|------|
| CSS Variables | `frontend/src/app/globals.css` |
| Ant Design Theme | `frontend/src/app/layout.tsx` |
| ag-Grid Theme | `frontend/src/styles/ag-grid-dark.css` |

## Design Thinking

Before coding any new page, consider:

- **Purpose**: What problem does this interface solve?
- **Consistency**: Does it match existing pages?
- **Hierarchy**: Is the primary action clear?
- **Restraint**: Are we using color sparingly?

## Anti-Patterns

Never do:
- Colored sidebar links (always grey)
- Colored stat numbers except profit
- Blue accents (we use amber)
- White text (use 85% grey)
- Full-color badges (use grey with dot indicators)
- Multiple accent colors per view

## Checklist for New Pages

- [ ] Page background is `bg-background`
- [ ] Header with title + action buttons
- [ ] Stats use grey (profit uses green/red)
- [ ] Primary button is amber
- [ ] Other buttons are outline/ghost
- [ ] ag-Grid uses `ag-theme-custom-dark`
- [ ] No blue colors anywhere
