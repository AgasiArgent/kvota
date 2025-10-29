# Calculation Engine Quick Reference

**Print this page for quick lookup during development**

---

## Phase Overview (13 Phases)

```
1. Purchase Price       (N16, P16, R16, S16)
   ↓
2. Distribution Base   (S13, BD16) ← Distribution key for phases 3-9
   ↓
3. Logistics           (T16, U16, V16) + Insurance
   ↓
4. Duties & Internal   (AX16, AY16, Y16, Z16, AZ16)
   ↓
5. Supplier Payment    (BH6, BH4)
   ↓
6. Revenue Estimation  (BH2)
   ↓
7. Financing Costs     (BJ7, BJ10, BJ11)
   ↓
8. Credit Sales        (BL5)
   ↓
9. Distribute Finance  (BA16, BB16)
   ↓
10. Final COGS         (AA16, AB16)
    ↓
11. Sales Price        (AF16, AG16, AH16, AI16, AJ16, AK16)
    ↓
12. VAT Calculations   (AM16, AL16, AN16, AO16, AP16)
    ↓
13. Transit Commission (AQ16)
```

---

## Variable Quick Lookup

### Purchase & Costs (Phase 1-4)
| Var | Phase | Meaning | Formula |
|-----|-------|---------|---------|
| S16 | 1 | Total purchase price | base_price × qty ÷ (1+VAT) |
| BD16 | 2 | Distribution ratio | S16 ÷ S13 |
| T16 | 3 | First-leg logistics | W2+W3+W5+W8 × BD16 |
| U16 | 3 | Last-leg logistics | W4+W6+W7+W9 × BD16 |
| V16 | 3 | Total logistics | T16 + U16 + insurance |
| AY16 | 4 | Internal price | R16 × (1 + internal_markup) × qty |
| Y16 | 4 | Customs duty | AY16 × tariff_rate (or 0 if TR export) |
| Z16 | 4 | Excise tax | % of AY16 OR RUB/kg × weight |

### Revenue & Financing (Phase 5-8)
| Var | Phase | Meaning | Formula |
|-----|-------|---------|---------|
| BH2 | 6 | Revenue estimated | AY13 × (1 + markup + forex + dm_fee) |
| BH6 | 5 | Supplier payment | (AZ13 + T13) × (1 + advance%) × (1 + fin_comm%) |
| BJ11 | 7 | Financing interest | BH7 × FV + BH10 × FV |
| BL5 | 8 | Credit interest | (BH2 - BH3) × FV - principal |

### Pricing (Phase 10-13)
| Var | Phase | Meaning | Formula |
|-----|-------|---------|---------|
| AB16 | 10 | COGS total | S16 + V16 + Y16 + Z16 + BA16 + BB16 |
| AA16 | 10 | COGS per unit | AB16 ÷ qty |
| AJ16 | 11 | Final price per unit | (AB16 + profit + fees) ÷ qty |
| AK16 | 11 | Final price total | AJ16 × qty |
| AN16 | 12 | Sales VAT | AK16 × 18% (if DDP) |
| AO16 | 12 | Deductible VAT | (AY16 + Y16 + Z16) × 18% (if DDP+not export) |
| AP16 | 12 | Net VAT | AN16 - AO16 |

---

## Decision Tree: Which Phase Output Do I Need?

```
Need final sales price?
  └─ AJ16 (per unit) or AK16 (total) from Phase 11

Need to know COGS?
  └─ AB16 (total) or AA16 (per unit) from Phase 10

Need to know profit margin?
  └─ AF16 from Phase 11 (= AB16 × markup%)

Need to know VAT owed to Russia?
  └─ AP16 from Phase 12 (net VAT after deductions)

Need to distribute costs across products?
  └─ Use BD16 from Phase 2 as distribution key
  └─ Example: financing_per_product = BJ11 × BD16

Is this transit (resale)?
  └─ Commission = AQ16 from Phase 13
  └─ No COGS (no AB16, use profit only)

Need supplier payment amount?
  └─ BH6 from Phase 5
```

---

## Decimal Patterns

### Safe Arithmetic
```python
from decimal import Decimal, ROUND_HALF_UP

# Initialize
price = Decimal("1234.56")
rate = Decimal("0.03")

# Multiply
result = price * rate  # OK

# Divide with protection
if denominator > 0:
    result = numerator / denominator

# Round
result = result.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

# ROUNDUP behavior
result = (value * Decimal("10")).quantize(Decimal("1"), rounding=ROUND_CEILING) / Decimal("10")
```

### Common Mistakes
```python
# BAD: Never use float
price = 1234.56  # Float loses precision
rate = 0.03  # Float loses precision

# BAD: String without Decimal()
result = "1234.56" / 100  # TypeError

# BAD: Inconsistent types
result = Decimal("100") + 50  # TypeError
```

---

## Special Cases Checklist

- [ ] **Turkish seller export?** → Y16 = 0 (no customs)
- [ ] **Turkish seller region?** → AI16 = 0 (no agent fee)
- [ ] **Export sale (EXW)?** → AN16 = 0, AO16 = 0 (no VAT)
- [ ] **Transit sale?** → Use S16 for pricing base, calculate AQ16
- [ ] **China supplier?** → VAT already removed from base_price
- [ ] **Multi-product?** → Use BD16 distribution for T16, U16, BA16, BB16
- [ ] **100% client advance?** → BL5 = 0 (no credit interest)

---

## Admin Settings (Fetch From Database)

```python
# These are PER-ORGANIZATION settings in calculation_settings table
rate_forex_risk = Decimal("3.0")  # % buffer for forex
rate_fin_comm = Decimal("0.5")  # % commission on supplier payment
rate_loan_interest_daily = Decimal("0.15")  # % daily compound interest

# Russia VAT (fixed by law)
rate_vat_ru = Decimal("18.0")  # % (non-negotiable)
```

---

## Phase Input/Output Summary

| Phase | Inputs | Outputs | Loop |
|-------|--------|---------|------|
| 1 | base_price, qty, rate | S16, R16, P16, N16 | Per-product |
| 2 | S16 list | S13, BD16 | Quote-level |
| 3 | T_logistics, U_logistics, BD16 | T16, U16, V16 | Per-product |
| 4 | R16, qty, internal_markup | AY16, Y16, Z16, AX16, AZ16 | Per-product |
| 5 | AZ13, T13, advance%, rate_fin_comm | BH6, BH4 | Quote-level |
| 6 | AY13, markup%, forex%, dm_fee | BH2 | Quote-level |
| 7 | BH6, BH2, advance_from_client%, days, rate | BJ7, BJ10, BJ11 | Quote-level |
| 8 | BH2, BH3, credit_days, rate | BL5 | Quote-level |
| 9 | BJ11, BL5, BD16 | BA16, BB16 | Per-product |
| 10 | S16, V16, Y16, Z16, BA16, BB16, qty | AB16, AA16 | Per-product |
| 11 | AB16, markup%, forex%, dm_fee, rate_agent | AF16, AG16, AH16, AI16, AJ16, AK16 | Per-product |
| 12 | AJ16, AK16, AY16, Y16, Z16, incoterms | AM16, AL16, AN16, AO16, AP16 | Per-product |
| 13 | AF16, AG16, AH16, AI16, BA16, BB16 | AQ16 | Per-product |

---

## Testing Checklist

When implementing or debugging:

- [ ] All variables use Decimal type
- [ ] BD16 sums to 1.0 across all products
- [ ] Insurance distributed using BD16 (not quantity)
- [ ] Y16 = 0 for Turkish exports
- [ ] AI16 = 0 for Turkish sellers or exports
- [ ] AO16 > 0 only if DDP + not export
- [ ] Multi-product test: BA16 and BB16 properly distributed
- [ ] Phase outputs match Excel ±0.01

---

## Common Errors & Fixes

| Error | Cause | Fix |
|-------|-------|-----|
| AY16 precision loss | Using float | Use Decimal("value") |
| BD16 doesn't sum to 1.0 | Wrong calculation | BD16 = S16 ÷ S13 for each product |
| Insurance wrong | Distributed by qty | Use BD16 distribution |
| Y16 should be 0 but isn't | Missing Turkey check | Check seller_region == "TR" |
| AI16 should be 0 but isn't | Export check wrong | Check incoterms == "EXW" |
| AO16 = 0 for DDP | Missing VAT calculation | Add (AY16 + Y16 + Z16) × 0.18 |

---

## Excel Formula Reference

```
ROUNDUP(value, decimals)
  → Python: (value * 10^decimals).quantize(..., ROUND_CEILING) / 10^decimals

FV(rate, periods, pmt, pv)
  → Python: pv * (1 + rate) ^ periods

Conditional: IF(condition, true_val, false_val)
  → Python: true_val if condition else false_val

SUM(range)
  → Python: sum(list)

MULTIPLICATION: A * B
  → Python: A * B (all Decimal)
```

---

**Last Updated:** 2025-10-29
**Print Friendly:** Yes (fits on 2-3 pages)
**For:** Backend developers, QA engineers
