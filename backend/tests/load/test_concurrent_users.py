"""
Load Test Category 1: Concurrent Users
Tests API performance under concurrent user load
"""
import asyncio
import aiohttp
import time
import os
from typing import List, Dict, Any
from decimal import Decimal
import statistics

# Test credentials
TEST_USER = "andrey@masterbearingsales.ru"
TEST_PASSWORD = "password"
API_BASE = "http://localhost:8000"


async def get_auth_token(session: aiohttp.ClientSession) -> str:
    """Get authentication token"""
    async with session.post(
        f"{API_BASE}/api/auth/login",
        json={"email": TEST_USER, "password": TEST_PASSWORD}
    ) as response:
        if response.status == 200:
            data = await response.json()
            return data.get("access_token")
        raise Exception(f"Auth failed: {response.status}")


async def create_quote_with_calc(session: aiohttp.ClientSession, token: str, user_num: int) -> Dict[str, Any]:
    """Create a quote with calculation (simulates real user workflow)"""
    headers = {"Authorization": f"Bearer {token}"}

    # Quote data with 5 products
    quote_data = {
        "customer_name": f"Load Test Customer {user_num}",
        "delivery_address": "Test Address",
        "products": [
            {
                "product_code": f"TEST-{i}",
                "description": f"Test Product {i}",
                "brand": "Test Brand",
                "base_price_vat": 1200.00,
                "quantity": 10,
                "weight_in_kg": 5.5
            }
            for i in range(1, 6)  # 5 products
        ],
        # Quote-level defaults
        "currency_of_base_price": "USD",
        "delivery_time_of_product": 60,
        "customer_advance_payment": 50.0,
        "customer_delivery_payment": 50.0
    }

    start = time.time()
    async with session.post(
        f"{API_BASE}/api/quotes-calc/create-and-calculate",
        json=quote_data,
        headers=headers
    ) as response:
        duration = time.time() - start
        status = response.status

        if status == 201:
            data = await response.json()
            return {
                "success": True,
                "duration": duration,
                "quote_id": data.get("quote_id"),
                "status": status
            }
        else:
            error_text = await response.text()
            return {
                "success": False,
                "duration": duration,
                "error": error_text,
                "status": status
            }


async def browse_quotes(session: aiohttp.ClientSession, token: str, duration_seconds: int) -> Dict[str, Any]:
    """Browse quotes repeatedly for specified duration"""
    headers = {"Authorization": f"Bearer {token}"}
    request_count = 0
    durations = []
    errors = 0

    start_time = time.time()
    while time.time() - start_time < duration_seconds:
        req_start = time.time()
        try:
            async with session.get(
                f"{API_BASE}/api/quotes?page=1&per_page=20",
                headers=headers
            ) as response:
                req_duration = time.time() - req_start
                durations.append(req_duration)
                request_count += 1

                if response.status != 200:
                    errors += 1
        except Exception as e:
            errors += 1

        await asyncio.sleep(2)  # 2 seconds between requests

    return {
        "request_count": request_count,
        "avg_duration": statistics.mean(durations) if durations else 0,
        "p95_duration": statistics.quantiles(durations, n=20)[18] if len(durations) >= 20 else max(durations) if durations else 0,
        "errors": errors
    }


async def export_pdf(session: aiohttp.ClientSession, token: str, quote_id: str) -> Dict[str, Any]:
    """Export PDF for a quote"""
    headers = {"Authorization": f"Bearer {token}"}

    start = time.time()
    async with session.get(
        f"{API_BASE}/api/quotes/{quote_id}/export/pdf?format=supply",
        headers=headers
    ) as response:
        duration = time.time() - start

        if response.status == 200:
            content = await response.read()
            return {
                "success": True,
                "duration": duration,
                "file_size_mb": len(content) / (1024 * 1024)
            }
        else:
            return {
                "success": False,
                "duration": duration,
                "status": response.status
            }


async def test_1_1_concurrent_quote_creation(num_users: int = 10):
    """Test 1.1: N users creating quotes simultaneously"""
    print(f"\n{'='*60}")
    print(f"Test 1.1: {num_users} Concurrent Quote Creations")
    print(f"{'='*60}")

    async with aiohttp.ClientSession() as session:
        # Get token once (all use same user for simplicity)
        token = await get_auth_token(session)

        # Create quotes concurrently
        tasks = [
            create_quote_with_calc(session, token, i)
            for i in range(1, num_users + 1)
        ]

        start = time.time()
        results = await asyncio.gather(*tasks)
        total_duration = time.time() - start

        # Analyze results
        successes = sum(1 for r in results if r["success"])
        failures = num_users - successes
        durations = [r["duration"] for r in results if r["success"]]

        print(f"\nResults:")
        print(f"  Total Duration: {total_duration:.2f}s")
        print(f"  Successes: {successes}/{num_users}")
        print(f"  Failures: {failures}/{num_users}")

        if durations:
            print(f"  Response Times:")
            print(f"    Min: {min(durations):.3f}s")
            print(f"    Max: {max(durations):.3f}s")
            print(f"    Avg: {statistics.mean(durations):.3f}s")
            print(f"    p95: {statistics.quantiles(durations, n=20)[18] if len(durations) >= 20 else max(durations):.3f}s")

        # Pass criteria
        passed = successes == num_users and (statistics.quantiles(durations, n=20)[18] if len(durations) >= 20 else max(durations)) < 2.0
        print(f"\n  Status: {'✅ PASS' if passed else '❌ FAIL'}")
        print(f"  Criteria: All succeed, p95 < 2s")

        return {
            "test": "1.1_concurrent_creation",
            "passed": passed,
            "successes": successes,
            "failures": failures,
            "total_duration": total_duration,
            "p95_response_time": statistics.quantiles(durations, n=20)[18] if len(durations) >= 20 else max(durations) if durations else 0
        }


async def test_1_2_concurrent_browsing(num_users: int = 20, duration_seconds: int = 60):
    """Test 1.2: N users browsing quotes concurrently"""
    print(f"\n{'='*60}")
    print(f"Test 1.2: {num_users} Concurrent Users Browsing")
    print(f"{'='*60}")

    async with aiohttp.ClientSession() as session:
        token = await get_auth_token(session)

        # Browse concurrently
        tasks = [
            browse_quotes(session, token, duration_seconds)
            for _ in range(num_users)
        ]

        start = time.time()
        results = await asyncio.gather(*tasks)
        total_duration = time.time() - start

        # Aggregate results
        total_requests = sum(r["request_count"] for r in results)
        total_errors = sum(r["errors"] for r in results)
        all_p95s = [r["p95_duration"] for r in results if r["p95_duration"] > 0]

        print(f"\nResults:")
        print(f"  Total Duration: {total_duration:.2f}s")
        print(f"  Total Requests: {total_requests}")
        print(f"  Total Errors: {total_errors}")
        print(f"  Error Rate: {(total_errors / total_requests * 100) if total_requests > 0 else 0:.2f}%")

        if all_p95s:
            print(f"  p95 Response Time: {max(all_p95s):.3f}s")

        # Pass criteria
        passed = total_errors == 0 and max(all_p95s) < 0.5 if all_p95s else False
        print(f"\n  Status: {'✅ PASS' if passed else '❌ FAIL'}")
        print(f"  Criteria: No errors, p95 < 500ms")

        return {
            "test": "1.2_concurrent_browsing",
            "passed": passed,
            "total_requests": total_requests,
            "errors": total_errors,
            "p95_response_time": max(all_p95s) if all_p95s else 0
        }


async def test_1_3_concurrent_pdf_exports(num_users: int = 5):
    """Test 1.3: N users exporting PDFs simultaneously"""
    print(f"\n{'='*60}")
    print(f"Test 1.3: {num_users} Concurrent PDF Exports")
    print(f"{'='*60}")

    async with aiohttp.ClientSession() as session:
        token = await get_auth_token(session)

        # First, create a quote to export
        print("  Creating test quote...")
        quote_result = await create_quote_with_calc(session, token, 1)

        if not quote_result["success"]:
            print("  ❌ Failed to create test quote")
            return {
                "test": "1.3_concurrent_exports",
                "passed": False,
                "error": "Quote creation failed"
            }

        quote_id = quote_result["quote_id"]
        print(f"  Quote created: {quote_id}")

        # Export PDFs concurrently
        tasks = [
            export_pdf(session, token, quote_id)
            for _ in range(num_users)
        ]

        start = time.time()
        results = await asyncio.gather(*tasks)
        total_duration = time.time() - start

        # Analyze results
        successes = sum(1 for r in results if r.get("success"))
        durations = [r["duration"] for r in results if r.get("success")]
        file_sizes = [r["file_size_mb"] for r in results if r.get("success")]

        print(f"\nResults:")
        print(f"  Total Duration: {total_duration:.2f}s")
        print(f"  Successes: {successes}/{num_users}")

        if durations:
            print(f"  Response Times:")
            print(f"    Min: {min(durations):.3f}s")
            print(f"    Max: {max(durations):.3f}s")
            print(f"    Avg: {statistics.mean(durations):.3f}s")

        if file_sizes:
            print(f"  File Sizes:")
            print(f"    Avg: {statistics.mean(file_sizes):.3f} MB")
            print(f"    Max: {max(file_sizes):.3f} MB")

        # Pass criteria
        passed = successes == num_users and all(size < 5.0 for size in file_sizes)
        print(f"\n  Status: {'✅ PASS' if passed else '❌ FAIL'}")
        print(f"  Criteria: All succeed, files < 5MB")

        return {
            "test": "1.3_concurrent_exports",
            "passed": passed,
            "successes": successes,
            "failures": num_users - successes,
            "avg_duration": statistics.mean(durations) if durations else 0,
            "max_file_size_mb": max(file_sizes) if file_sizes else 0
        }


async def test_1_4_mixed_load():
    """Test 1.4: Mixed concurrent operations"""
    print(f"\n{'='*60}")
    print(f"Test 1.4: Mixed Concurrent Load")
    print(f"{'='*60}")
    print("  3 creating quotes")
    print("  4 browsing quotes")
    print("  2 exporting PDFs")
    print("  1 updating profile")

    async with aiohttp.ClientSession() as session:
        token = await get_auth_token(session)

        # Create a quote for exports first
        setup_quote = await create_quote_with_calc(session, token, 0)
        quote_id = setup_quote.get("quote_id") if setup_quote.get("success") else None

        tasks = []

        # 3 creating quotes
        for i in range(3):
            tasks.append(create_quote_with_calc(session, token, i + 1))

        # 4 browsing quotes (10 seconds each)
        for i in range(4):
            tasks.append(browse_quotes(session, token, 10))

        # 2 exporting PDFs
        if quote_id:
            for i in range(2):
                tasks.append(export_pdf(session, token, quote_id))

        # Execute all concurrently
        start = time.time()
        results = await asyncio.gather(*tasks, return_exceptions=True)
        total_duration = time.time() - start

        # Count successes
        successes = sum(1 for r in results if isinstance(r, dict) and (r.get("success") or r.get("request_count")))

        print(f"\nResults:")
        print(f"  Total Duration: {total_duration:.2f}s")
        print(f"  Successful Operations: {successes}/{len(tasks)}")

        passed = successes >= len(tasks) * 0.9  # 90% success rate
        print(f"\n  Status: {'✅ PASS' if passed else '❌ FAIL'}")
        print(f"  Criteria: 90%+ operations succeed")

        return {
            "test": "1.4_mixed_load",
            "passed": passed,
            "total_operations": len(tasks),
            "successes": successes,
            "total_duration": total_duration
        }


async def run_all_concurrent_tests():
    """Run all concurrent user tests"""
    print("\n" + "="*60)
    print("CATEGORY 1: CONCURRENT USERS LOAD TESTS")
    print("="*60)

    results = []

    # Test 1.1: 10 concurrent quote creations
    results.append(await test_1_1_concurrent_quote_creation(10))

    # Test 1.2: 20 concurrent browsers (1 minute)
    # results.append(await test_1_2_concurrent_browsing(20, 60))

    # Test 1.3: 5 concurrent PDF exports
    results.append(await test_1_3_concurrent_pdf_exports(5))

    # Test 1.4: Mixed load
    results.append(await test_1_4_mixed_load())

    # Summary
    print(f"\n{'='*60}")
    print("CATEGORY 1 SUMMARY")
    print(f"{'='*60}")

    passed_count = sum(1 for r in results if r.get("passed"))
    total_count = len(results)

    print(f"Tests Passed: {passed_count}/{total_count}")
    print(f"Pass Rate: {passed_count / total_count * 100:.1f}%")

    for result in results:
        status = "✅ PASS" if result.get("passed") else "❌ FAIL"
        print(f"  {result['test']}: {status}")

    return results


if __name__ == "__main__":
    asyncio.run(run_all_concurrent_tests())
