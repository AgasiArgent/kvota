# Quick Test Comparison Reference

## Tests 1-3, 6-8: ✅ PASSED (Turkey Supplier)

All within acceptable tolerance (<0.05%)

## Tests 11-15: NEW - China & EU Suppliers

### Final Price Comparison (AL16)

| Test | Supplier | Seller | Internal Markup | Final Price | vs Test 1 |
|------|----------|--------|----------------|-------------|-----------|
| **1** | Turkey | RU | 10% | 1,348,185 | Baseline |
| **11** | China | RU | 10% | 1,427,010 | +5.8% |
| **13** | China | TR | 0% | 1,163,289 | -13.7% |
| **14** | Lithuania | RU | 13% | 1,481,039 | **+9.9%** |
| **15** | Lithuania | TR | 3% | 1,205,080 | -10.6% |

### Key Insights

1. **Lithuania most expensive** (+9.9% vs Turkey) due to 13% internal markup
2. **Turkish seller saves money** (TR vs RU):
   - China: 1.16M vs 1.43M (-18.6%)
   - Lithuania: 1.21M vs 1.48M (-18.6%)
3. **China slightly more expensive** than Turkey (+5.8%) despite lower VAT (13% vs 20%)

### Purchase Price Comparison (S16)

| Test | Supplier | VAT | S16 (Purchase Price) |
|------|----------|-----|---------------------|
| 1 | Turkey | 20% | 857,142.90 |
| 11-13 | China | 13% | 910,247.60 (+6.2%) |
| 14-15 | Lithuania | 21% | 939,547.40 (+9.6%) |

**Note:** Lower VAT = Higher purchase price (VAT is removed from base_price_VAT)

---

## Tests 9-10: Multi-Product Scenarios

### Test 9 (2 Products)

```
Total Quote: AL16 = 3,202,617.00

Product 1 ($1200×10): 1,348,185.00 (42.1%)
Product 2 ($2500×5):  1,854,432.00 (57.9%)
```

### Test 10 (3 Products)

```
Total Quote: AL16 = 4,548,732.30

Product 1 ($800×20):  1,795,771.00 (39.5%)
Product 2 ($1200×10): 1,348,528.00 (29.6%)
Product 3 ($2500×5):  1,404,433.30 (30.9%)
```

---

## Validation Checklist

**Single Products (Tests 1-8, 11-15):**
- [ ] Test 1-3: Already validated ✅
- [ ] Test 6-8: Already validated ✅
- [ ] Test 11: China RU seller
- [ ] Test 12: China Transit
- [ ] Test 13: China TR seller
- [ ] Test 14: Lithuania RU seller
- [ ] Test 15: Lithuania TR seller

**Multi-Products (Tests 9-10):**
- [ ] Test 9: 2 products (distribution logic)
- [ ] Test 10: 3 products (distribution logic)

---

**File:** `all_test_values_complete.txt` contains all cell values for Excel comparison
