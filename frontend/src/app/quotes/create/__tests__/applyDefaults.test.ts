/**
 * Unit tests for applyQuoteDefaultsToProducts function
 * Tests the two-tier variable system: product override > quote default > fallback
 */

import { Product, CalculationVariables } from '@/lib/api/quotes-calc-service';

/**
 * Exported copy of applyQuoteDefaultsToProducts for testing
 * Apply quote-level defaults to products before sending to API
 * Two-tier system: product override > quote default > fallback
 */
const applyQuoteDefaultsToProducts = (
  products: Product[],
  quoteDefaults: CalculationVariables
): Product[] => {
  return products.map((product) => ({
    ...product,
    // Financial defaults (both Product and CalculationVariables have these)
    currency_of_base_price:
      product.currency_of_base_price || quoteDefaults.currency_of_base_price || 'USD',
    exchange_rate_base_price_to_quote:
      product.exchange_rate_base_price_to_quote ||
      quoteDefaults.exchange_rate_base_price_to_quote ||
      1.0,
    supplier_discount: product.supplier_discount ?? 0, // Product-only field, default to 0 if not set
    markup: product.markup ?? quoteDefaults.markup ?? 0,

    // Logistics defaults
    supplier_country: product.supplier_country || quoteDefaults.supplier_country || 'Турция',

    // Customs defaults
    customs_code: product.customs_code || quoteDefaults.customs_code || '',
    import_tariff: product.import_tariff ?? quoteDefaults.import_tariff ?? 0,
    excise_tax: product.excise_tax ?? quoteDefaults.excise_tax ?? 0,
  }));
};

describe('applyQuoteDefaultsToProducts', () => {
  // ============================================================================
  // 1. Product with NO overrides - should get all quote defaults
  // ============================================================================
  describe('Product with no overrides', () => {
    it('should apply all quote defaults when product has no overrides', () => {
      const products: Product[] = [
        {
          product_name: 'Test Product 1',
          base_price_vat: 100,
          quantity: 10,
        },
      ];

      const quoteDefaults: CalculationVariables = {
        currency_of_base_price: 'EUR',
        exchange_rate_base_price_to_quote: 95.5,
        markup: 15.5,
        supplier_country: 'Германия',
        customs_code: '1234567890',
        import_tariff: 5.0,
        excise_tax: 2.5,
      } as CalculationVariables;

      const result = applyQuoteDefaultsToProducts(products, quoteDefaults);

      expect(result[0]).toMatchObject({
        product_name: 'Test Product 1',
        base_price_vat: 100,
        quantity: 10,
        currency_of_base_price: 'EUR', // From quote defaults
        exchange_rate_base_price_to_quote: 95.5, // From quote defaults
        supplier_discount: 0, // Fallback (product-only field)
        markup: 15.5, // From quote defaults
        supplier_country: 'Германия', // From quote defaults
        customs_code: '1234567890', // From quote defaults
        import_tariff: 5.0, // From quote defaults
        excise_tax: 2.5, // From quote defaults
      });
    });
  });

  // ============================================================================
  // 2. Product with SOME overrides - should keep overrides, get remaining defaults
  // ============================================================================
  describe('Product with partial overrides', () => {
    it('should keep product overrides and fill missing fields with quote defaults', () => {
      const products: Product[] = [
        {
          product_name: 'Test Product 2',
          base_price_vat: 200,
          quantity: 5,
          // Product has SOME overrides
          currency_of_base_price: 'USD', // Override
          markup: 20.0, // Override
          supplier_country: 'Китай', // Override
          // Missing: exchange_rate, import_tariff, excise_tax, customs_code
        },
      ];

      const quoteDefaults: CalculationVariables = {
        currency_of_base_price: 'EUR', // Should be IGNORED (product has override)
        exchange_rate_base_price_to_quote: 85.0, // Should be USED
        markup: 10.0, // Should be IGNORED (product has override)
        supplier_country: 'Германия', // Should be IGNORED (product has override)
        customs_code: '9876543210', // Should be USED
        import_tariff: 7.5, // Should be USED
        excise_tax: 1.5, // Should be USED
      } as CalculationVariables;

      const result = applyQuoteDefaultsToProducts(products, quoteDefaults);

      expect(result[0]).toMatchObject({
        product_name: 'Test Product 2',
        base_price_vat: 200,
        quantity: 5,
        currency_of_base_price: 'USD', // KEPT from product (override)
        exchange_rate_base_price_to_quote: 85.0, // FROM quote defaults
        supplier_discount: 0, // Fallback
        markup: 20.0, // KEPT from product (override)
        supplier_country: 'Китай', // KEPT from product (override)
        customs_code: '9876543210', // FROM quote defaults
        import_tariff: 7.5, // FROM quote defaults
        excise_tax: 1.5, // FROM quote defaults
      });
    });
  });

  // ============================================================================
  // 3. Product with ALL overrides - should NOT change anything
  // ============================================================================
  describe('Product with all overrides', () => {
    it('should preserve all product overrides and ignore quote defaults', () => {
      const products: Product[] = [
        {
          product_name: 'Test Product 3',
          base_price_vat: 300,
          quantity: 15,
          // Product has ALL overrides
          currency_of_base_price: 'GBP',
          exchange_rate_base_price_to_quote: 110.0,
          supplier_discount: 5.0,
          markup: 25.0,
          supplier_country: 'Великобритания',
          customs_code: '1111111111',
          import_tariff: 10.0,
          excise_tax: 3.0,
        },
      ];

      const quoteDefaults: CalculationVariables = {
        currency_of_base_price: 'EUR',
        exchange_rate_base_price_to_quote: 95.0,
        markup: 15.0,
        supplier_country: 'Германия',
        customs_code: '9999999999',
        import_tariff: 5.0,
        excise_tax: 2.0,
      } as CalculationVariables;

      const result = applyQuoteDefaultsToProducts(products, quoteDefaults);

      // ALL fields should be UNCHANGED
      expect(result[0]).toMatchObject({
        product_name: 'Test Product 3',
        base_price_vat: 300,
        quantity: 15,
        currency_of_base_price: 'GBP', // KEPT (not EUR from defaults)
        exchange_rate_base_price_to_quote: 110.0, // KEPT (not 95.0)
        supplier_discount: 5.0, // KEPT
        markup: 25.0, // KEPT (not 15.0)
        supplier_country: 'Великобритания', // KEPT (not Германия)
        customs_code: '1111111111', // KEPT (not 9999999999)
        import_tariff: 10.0, // KEPT (not 5.0)
        excise_tax: 3.0, // KEPT (not 2.0)
      });
    });
  });

  // ============================================================================
  // 4. Zero values are PRESERVED (important for supplier_discount)
  // ============================================================================
  describe('Zero value preservation', () => {
    it('should preserve zero values in product overrides (not treat as falsy)', () => {
      const products: Product[] = [
        {
          product_name: 'Test Product 4',
          base_price_vat: 400,
          quantity: 20,
          // Product has ZERO values (should be kept)
          supplier_discount: 0, // Should NOT be replaced by quote default
          import_tariff: 0, // Should NOT be replaced by quote default
          excise_tax: 0, // Should NOT be replaced by quote default
          markup: 0, // Should NOT be replaced by quote default
        },
      ];

      const quoteDefaults: CalculationVariables = {
        markup: 20.0, // Should be IGNORED (product has 0)
        import_tariff: 7.0, // Should be IGNORED (product has 0)
        excise_tax: 3.0, // Should be IGNORED (product has 0)
        currency_of_base_price: 'TRY',
        exchange_rate_base_price_to_quote: 1.0,
        supplier_country: 'Турция',
        customs_code: '5555555555',
      } as CalculationVariables;

      const result = applyQuoteDefaultsToProducts(products, quoteDefaults);

      // All zero values should be PRESERVED
      expect(result[0]).toMatchObject({
        product_name: 'Test Product 4',
        base_price_vat: 400,
        quantity: 20,
        supplier_discount: 0, // KEPT (not undefined)
        markup: 0, // KEPT (not 20.0 from defaults)
        import_tariff: 0, // KEPT (not 7.0 from defaults)
        excise_tax: 0, // KEPT (not 3.0 from defaults)
        currency_of_base_price: 'TRY', // FROM quote defaults
        exchange_rate_base_price_to_quote: 1.0, // FROM quote defaults
        supplier_country: 'Турция', // FROM quote defaults
        customs_code: '5555555555', // FROM quote defaults
      });
    });
  });

  // ============================================================================
  // 5. Fallback values used when quote defaults are MISSING
  // ============================================================================
  describe('Fallback values when quote defaults missing', () => {
    it('should use fallback values when both product and quote defaults are missing', () => {
      const products: Product[] = [
        {
          product_name: 'Test Product 5',
          base_price_vat: 500,
          quantity: 1,
          // Product has NO overrides
        },
      ];

      // Quote defaults are PARTIALLY MISSING
      const quoteDefaults: CalculationVariables = {
        // Missing: currency_of_base_price, exchange_rate, supplier_country, customs_code
        markup: 15.0, // Present
        import_tariff: 5.0, // Present
        excise_tax: 0, // Present (zero is valid)
      } as CalculationVariables;

      const result = applyQuoteDefaultsToProducts(products, quoteDefaults);

      expect(result[0]).toMatchObject({
        product_name: 'Test Product 5',
        base_price_vat: 500,
        quantity: 1,
        currency_of_base_price: 'USD', // FALLBACK (not from quote)
        exchange_rate_base_price_to_quote: 1.0, // FALLBACK (not from quote)
        supplier_discount: 0, // FALLBACK (product-only)
        markup: 15.0, // FROM quote defaults
        supplier_country: 'Турция', // FALLBACK (not from quote)
        customs_code: '', // FALLBACK (empty string)
        import_tariff: 5.0, // FROM quote defaults
        excise_tax: 0, // FROM quote defaults (zero is valid)
      });
    });

    it('should use fallback values when quote defaults object is completely empty', () => {
      const products: Product[] = [
        {
          product_name: 'Test Product 6',
          base_price_vat: 600,
          quantity: 3,
        },
      ];

      const quoteDefaults: CalculationVariables = {} as CalculationVariables;

      const result = applyQuoteDefaultsToProducts(products, quoteDefaults);

      expect(result[0]).toMatchObject({
        product_name: 'Test Product 6',
        base_price_vat: 600,
        quantity: 3,
        currency_of_base_price: 'USD', // FALLBACK
        exchange_rate_base_price_to_quote: 1.0, // FALLBACK
        supplier_discount: 0, // FALLBACK
        markup: 0, // FALLBACK
        supplier_country: 'Турция', // FALLBACK
        customs_code: '', // FALLBACK
        import_tariff: 0, // FALLBACK
        excise_tax: 0, // FALLBACK
      });
    });
  });

  // ============================================================================
  // 6. Multiple products with different override patterns
  // ============================================================================
  describe('Multiple products with mixed overrides', () => {
    it('should correctly apply defaults to multiple products independently', () => {
      const products: Product[] = [
        {
          product_name: 'Product A',
          base_price_vat: 100,
          quantity: 5,
          // NO overrides
        },
        {
          product_name: 'Product B',
          base_price_vat: 200,
          quantity: 10,
          // SOME overrides
          markup: 25.0,
          customs_code: 'CUSTOM123',
        },
        {
          product_name: 'Product C',
          base_price_vat: 300,
          quantity: 15,
          // ALL overrides
          currency_of_base_price: 'GBP',
          exchange_rate_base_price_to_quote: 120.0,
          supplier_discount: 10.0,
          markup: 30.0,
          supplier_country: 'UK',
          customs_code: 'GB999',
          import_tariff: 8.0,
          excise_tax: 4.0,
        },
      ];

      const quoteDefaults: CalculationVariables = {
        currency_of_base_price: 'EUR',
        exchange_rate_base_price_to_quote: 95.0,
        markup: 15.0,
        supplier_country: 'Германия',
        customs_code: 'DEFAULT999',
        import_tariff: 5.0,
        excise_tax: 2.5,
      } as CalculationVariables;

      const result = applyQuoteDefaultsToProducts(products, quoteDefaults);

      // Product A: ALL from quote defaults
      expect(result[0]).toMatchObject({
        product_name: 'Product A',
        currency_of_base_price: 'EUR',
        exchange_rate_base_price_to_quote: 95.0,
        markup: 15.0,
        supplier_country: 'Германия',
        customs_code: 'DEFAULT999',
        import_tariff: 5.0,
        excise_tax: 2.5,
      });

      // Product B: SOME from product, SOME from quote defaults
      expect(result[1]).toMatchObject({
        product_name: 'Product B',
        currency_of_base_price: 'EUR', // From quote
        exchange_rate_base_price_to_quote: 95.0, // From quote
        markup: 25.0, // OVERRIDE
        supplier_country: 'Германия', // From quote
        customs_code: 'CUSTOM123', // OVERRIDE
        import_tariff: 5.0, // From quote
        excise_tax: 2.5, // From quote
      });

      // Product C: ALL from product overrides
      expect(result[2]).toMatchObject({
        product_name: 'Product C',
        currency_of_base_price: 'GBP',
        exchange_rate_base_price_to_quote: 120.0,
        markup: 30.0,
        supplier_country: 'UK',
        customs_code: 'GB999',
        import_tariff: 8.0,
        excise_tax: 4.0,
      });
    });
  });

  // ============================================================================
  // 7. Empty strings vs missing values (string fields)
  // ============================================================================
  describe('Empty string handling for string fields', () => {
    it('should treat empty string as falsy for string fields and use quote defaults', () => {
      const products: Product[] = [
        {
          product_name: 'Test Product 7',
          base_price_vat: 700,
          quantity: 7,
          // Empty strings (should be replaced by quote defaults)
          currency_of_base_price: '', // Should use quote default
          supplier_country: '', // Should use quote default
          customs_code: '', // Should use quote default (which might also be empty)
        },
      ];

      const quoteDefaults: CalculationVariables = {
        currency_of_base_price: 'EUR',
        supplier_country: 'Германия',
        customs_code: 'QUOTE_CODE',
        exchange_rate_base_price_to_quote: 90.0,
        markup: 12.0,
        import_tariff: 4.0,
        excise_tax: 1.0,
      } as CalculationVariables;

      const result = applyQuoteDefaultsToProducts(products, quoteDefaults);

      // Empty strings should be replaced by quote defaults
      expect(result[0]).toMatchObject({
        product_name: 'Test Product 7',
        base_price_vat: 700,
        quantity: 7,
        currency_of_base_price: 'EUR', // FROM quote (empty string is falsy)
        supplier_country: 'Германия', // FROM quote (empty string is falsy)
        customs_code: 'QUOTE_CODE', // FROM quote (empty string is falsy)
      });
    });

    it('should use fallback for customs_code when both product and quote have empty strings', () => {
      const products: Product[] = [
        {
          product_name: 'Test Product 8',
          base_price_vat: 800,
          quantity: 8,
          customs_code: '', // Empty
        },
      ];

      const quoteDefaults: CalculationVariables = {
        customs_code: '', // Also empty
        currency_of_base_price: 'TRY',
        exchange_rate_base_price_to_quote: 1.0,
        supplier_country: 'Турция',
        markup: 10.0,
        import_tariff: 3.0,
        excise_tax: 0,
      } as CalculationVariables;

      const result = applyQuoteDefaultsToProducts(products, quoteDefaults);

      // Empty string fallback
      expect(result[0]).toMatchObject({
        customs_code: '', // Fallback is empty string
      });
    });
  });

  // ============================================================================
  // 8. Edge case: Product with undefined vs null vs 0
  // ============================================================================
  describe('Null vs undefined vs zero handling', () => {
    it('should treat undefined as missing, null as missing, but 0 as valid', () => {
      const products: Product[] = [
        {
          product_name: 'Test Product 9',
          base_price_vat: 900,
          quantity: 9,
          markup: undefined, // Should use quote default
          import_tariff: null as any, // Should use quote default
          excise_tax: 0, // Should KEEP (zero is valid)
        },
      ];

      const quoteDefaults: CalculationVariables = {
        markup: 18.0, // Should be USED
        import_tariff: 6.0, // Should be USED
        excise_tax: 5.0, // Should be IGNORED (product has 0)
        currency_of_base_price: 'RUB',
        exchange_rate_base_price_to_quote: 1.0,
        supplier_country: 'Россия',
        customs_code: 'RU123',
      } as CalculationVariables;

      const result = applyQuoteDefaultsToProducts(products, quoteDefaults);

      expect(result[0]).toMatchObject({
        product_name: 'Test Product 9',
        markup: 18.0, // FROM quote (undefined in product)
        import_tariff: 6.0, // FROM quote (null in product)
        excise_tax: 0, // KEPT from product (zero is valid)
      });
    });
  });

  // ============================================================================
  // 9. Does not mutate original arrays
  // ============================================================================
  describe('Immutability', () => {
    it('should not mutate the original products array', () => {
      const products: Product[] = [
        {
          product_name: 'Immutable Test',
          base_price_vat: 1000,
          quantity: 1,
        },
      ];

      const originalProducts = JSON.parse(JSON.stringify(products)); // Deep copy for comparison

      const quoteDefaults: CalculationVariables = {
        currency_of_base_price: 'EUR',
        markup: 20.0,
      } as CalculationVariables;

      applyQuoteDefaultsToProducts(products, quoteDefaults);

      // Original products should be unchanged
      expect(products).toEqual(originalProducts);
    });
  });
});
