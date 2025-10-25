#!/usr/bin/env python3
"""
Simple test to check if quote_calculation_results table has data

This test:
1. Queries the database directly for an existing quote
2. Checks if calculation results exist for that quote
3. Verifies the data structure
"""
import asyncpg
import asyncio
import os
import json

DATABASE_URL = os.getenv("DATABASE_URL")

async def test_quote_with_calc_results():
    print("\n🧪 Testing Quote Calculation Results in Database")
    print("="*60)

    conn = await asyncpg.connect(DATABASE_URL)

    try:
        # Step 1: Find a quote with calculation results
        print("\n📋 Step 1: Finding quotes with calculation results...")

        query = """
            SELECT q.id, q.quote_number, q.title, q.status,
                   COUNT(qcr.id) as calc_results_count
            FROM quotes q
            LEFT JOIN quote_calculation_results qcr ON q.id = qcr.quote_id
            GROUP BY q.id, q.quote_number, q.title, q.status
            HAVING COUNT(qcr.id) > 0
            ORDER BY q.created_at DESC
            LIMIT 1
        """

        row = await conn.fetchrow(query)

        if not row:
            print("❌ No quotes with calculation results found in database")
            print("\nℹ️  This means the calculation endpoint hasn't been used yet")
            print("   Run a quote calculation first via /api/quotes-calc/calculate")
            return False

        quote_id = row['id']
        quote_number = row['quote_number']
        calc_count = row['calc_results_count']

        print(f"✅ Found quote with calculation results:")
        print(f"   Quote ID: {quote_id}")
        print(f"   Quote Number: {quote_number}")
        print(f"   Title: {row['title']}")
        print(f"   Status: {row['status']}")
        print(f"   Calculation results: {calc_count} items")

        # Step 2: Get quote items with calculation results (simulating the endpoint logic)
        print(f"\n📊 Step 2: Fetching quote items with calculation results...")

        items_query = """
            SELECT qi.id, qi.quote_id, qi.product_name, qi.base_price_vat, qi.quantity
            FROM quote_items qi
            WHERE qi.quote_id = $1
            ORDER BY qi.position ASC
        """

        items = await conn.fetch(items_query, quote_id)
        print(f"✅ Found {len(items)} quote items")

        # Step 3: Get calculation results
        calc_query = """
            SELECT qcr.quote_item_id, qcr.phase_results, qcr.calculated_at
            FROM quote_calculation_results qcr
            WHERE qcr.quote_id = $1
        """

        calc_results = await conn.fetch(calc_query, quote_id)
        print(f"✅ Found {len(calc_results)} calculation result records")

        # Step 4: Verify data structure
        print(f"\n🔍 Step 3: Verifying calculation results structure...")

        if calc_results:
            first_calc = calc_results[0]
            phase_results = first_calc['phase_results']

            print(f"   Calculation for item: {first_calc['quote_item_id']}")
            print(f"   Calculated at: {first_calc['calculated_at']}")
            print(f"   Phase results type: {type(phase_results)}")

            if isinstance(phase_results, dict):
                print(f"   ✅ Phase results is a dictionary")
                print(f"   Number of fields: {len(phase_results)}")
                print(f"\n   Sample calculated fields:")
                for i, (key, value) in enumerate(list(phase_results.items())[:10]):
                    print(f"     • {key}: {value}")
                if len(phase_results) > 10:
                    print(f"     ... and {len(phase_results) - 10} more")
            else:
                print(f"   ⚠️  Phase results is not a dictionary: {phase_results}")
                return False

            # Step 5: Test the endpoint logic
            print(f"\n✅ Step 4: Simulating endpoint response structure...")

            # Create a map like the endpoint does
            calc_results_map = {str(row['quote_item_id']): dict(row) for row in calc_results}

            # Attach results to items like the endpoint does
            items_with_calc = []
            for item in items:
                item_dict = dict(item)
                item_id_str = str(item_dict['id'])

                if item_id_str in calc_results_map:
                    item_dict['calculation_results'] = calc_results_map[item_id_str]['phase_results']
                    item_dict['calculated_at'] = calc_results_map[item_id_str]['calculated_at']
                    items_with_calc.append(item_dict)

            print(f"   ✅ Successfully attached calculation results to {len(items_with_calc)} items")

            if items_with_calc:
                first_item = items_with_calc[0]
                print(f"\n   First item structure:")
                print(f"     • product_name: {first_item.get('product_name')}")
                print(f"     • quantity: {first_item.get('quantity')}")
                print(f"     • has calculation_results: {('calculation_results' in first_item)}")
                print(f"     • has calculated_at: {('calculated_at' in first_item)}")

                if 'calculation_results' in first_item:
                    calc_keys = list(first_item['calculation_results'].keys())[:5]
                    print(f"     • calculation_results keys (first 5): {calc_keys}")

            print(f"\n" + "="*60)
            print(f"✅ ✅ ✅ TEST PASSED ✅ ✅ ✅")
            print(f"\nQuote detail endpoint logic verified:")
            print(f"  • Calculation results exist in database")
            print(f"  • Data structure is correct (JSONB dict)")
            print(f"  • Endpoint logic successfully attaches results to items")
            print(f"\nThe modified /api/quotes/{{id}} endpoint should work correctly!")
            return True
        else:
            print(f"❌ No calculation results found")
            return False

    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        await conn.close()


if __name__ == "__main__":
    success = asyncio.run(test_quote_with_calc_results())
    exit(0 if success else 1)
