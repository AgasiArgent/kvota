"""
Simplified Load Testing Script
Direct API tests without authentication complexity
"""
import asyncio
import aiohttp
import time
import statistics
import os
from supabase import create_client


API_BASE = "http://localhost:8000"

# Get Supabase token for testing
def get_supabase_token():
    """Get authentication token via Supabase"""
    supabase = create_client(
        os.getenv("SUPABASE_URL"),
        os.getenv("SUPABASE_ANON_KEY")
    )

    response = supabase.auth.sign_in_with_password({
        "email": "andrey@masterbearingsales.ru",
        "password": "password"
    })

    return response.session.access_token


async def test_concurrent_api_calls(num_requests: int = 20, endpoint: str = "/api/health"):
    """Test concurrent API calls to measure throughput"""
    print(f"\n{'='*60}")
    print(f"Concurrent API Test: {num_requests} requests to {endpoint}")
    print(f"{'='*60}")

    durations = []
    errors = 0

    async with aiohttp.ClientSession() as session:
        async def make_request():
            nonlocal errors
            start = time.time()
            try:
                async with session.get(f"{API_BASE}{endpoint}") as response:
                    duration = time.time() - start
                    if response.status == 200:
                        durations.append(duration)
                    else:
                        errors += 1
            except Exception as e:
                errors += 1

        # Execute all requests concurrently
        tasks = [make_request() for _ in range(num_requests)]
        overall_start = time.time()
        await asyncio.gather(*tasks)
        overall_duration = time.time() - overall_start

        # Results
        successes = len(durations)
        print(f"\nResults:")
        print(f"  Total Duration: {overall_duration:.2f}s")
        print(f"  Successes: {successes}/{num_requests}")
        print(f"  Errors: {errors}/{num_requests}")
        print(f"  Requests/second: {num_requests / overall_duration:.1f}")

        if durations:
            print(f"  Response Times:")
            print(f"    Min: {min(durations)*1000:.1f}ms")
            print(f"    Max: {max(durations)*1000:.1f}ms")
            print(f"    Avg: {statistics.mean(durations)*1000:.1f}ms")
            p95 = statistics.quantiles(durations, n=20)[18] if len(durations) >= 20 else max(durations)
            print(f"    p95: {p95*1000:.1f}ms")

        passed = errors == 0 and p95 < 1.0
        print(f"\n  Status: {'✅ PASS' if passed else '❌ FAIL'}")

        return {
            "test": f"concurrent_{num_requests}",
            "passed": passed,
            "successes": successes,
            "errors": errors,
            "p95_ms": p95 * 1000 if durations else 0,
            "throughput_rps": num_requests / overall_duration
        }


async def test_sustained_load(duration_seconds: int = 60, rps: int = 10):
    """Test sustained load over time"""
    print(f"\n{'='*60}")
    print(f"Sustained Load Test: {rps} req/sec for {duration_seconds}s")
    print(f"{'='*60}")

    durations = []
    errors = 0
    request_count = 0

    async with aiohttp.ClientSession() as session:
        async def make_request():
            nonlocal errors, request_count
            request_count += 1
            start = time.time()
            try:
                async with session.get(f"{API_BASE}/api/health") as response:
                    duration = time.time() - start
                    durations.append(duration)
                    if response.status != 200:
                        errors += 1
            except Exception as e:
                errors += 1

        interval = 1.0 / rps
        start_time = time.time()

        while time.time() - start_time < duration_seconds:
            await make_request()
            await asyncio.sleep(interval)

        total_duration = time.time() - start_time

        print(f"\nResults:")
        print(f"  Duration: {total_duration:.2f}s")
        print(f"  Requests: {request_count}")
        print(f"  Errors: {errors}")
        print(f"  Error Rate: {errors/request_count*100:.2f}%")
        print(f"  Actual RPS: {request_count/total_duration:.1f}")

        if durations:
            p95 = statistics.quantiles(durations, n=20)[18] if len(durations) >= 20 else max(durations)
            print(f"  p95 Response: {p95*1000:.1f}ms")

        passed = errors < request_count * 0.01  # < 1% error rate
        print(f"\n  Status: {'✅ PASS' if passed else '❌ FAIL'}")

        return {
            "test": f"sustained_{duration_seconds}s",
            "passed": passed,
            "requests": request_count,
            "errors": errors,
            "error_rate": errors/request_count*100 if request_count > 0 else 0,
            "p95_ms": p95 * 1000 if durations else 0
        }


async def test_backend_memory_usage():
    """Test backend memory over quick burst"""
    import psutil

    print(f"\n{'='*60}")
    print(f"Backend Memory Test")
    print(f"{'='*60}")

    # Find backend process
    backend_pids = []
    for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
        try:
            cmdline = ' '.join(proc.info['cmdline'] or [])
            if 'uvicorn main:app' in cmdline:
                backend_pids.append(proc.info['pid'])
        except:
            pass

    if not backend_pids:
        print("  ❌ Backend process not found")
        return {"test": "memory_usage", "passed": False, "error": "Backend not running"}

    pid = backend_pids[0]
    process = psutil.Process(pid)

    # Baseline
    mem_before = process.memory_info().rss / 1024 / 1024  # MB

    print(f"  Baseline Memory: {mem_before:.1f} MB")

    # Run burst of requests
    print("  Running 100 concurrent requests...")
    await test_concurrent_api_calls(100, "/api/health")

    # Wait for GC
    await asyncio.sleep(2)

    # Check memory after
    mem_after = process.memory_info().rss / 1024 / 1024  # MB
    mem_increase = mem_after - mem_before

    print(f"  Memory After: {mem_after:.1f} MB")
    print(f"  Increase: {mem_increase:.1f} MB")

    # Pass if memory increase is reasonable (< 50MB for 100 requests)
    passed = mem_increase < 50
    print(f"\n  Status: {'✅ PASS' if passed else '❌ FAIL'}")

    return {
        "test": "memory_usage",
        "passed": passed,
        "baseline_mb": mem_before,
        "after_mb": mem_after,
        "increase_mb": mem_increase
    }


async def test_rate_limiting():
    """Test rate limiting enforcement"""
    print(f"\n{'='*60}")
    print(f"Rate Limiting Test")
    print(f"{'='*60}")

    # Send 100 requests as fast as possible
    errors_429 = 0
    successes = 0

    async with aiohttp.ClientSession() as session:
        tasks = []

        async def make_request():
            nonlocal errors_429, successes
            try:
                async with session.get(f"{API_BASE}/api/health") as response:
                    if response.status == 429:
                        errors_429 += 1
                    elif response.status == 200:
                        successes += 1
            except:
                pass

        # 100 concurrent requests
        for _ in range(100):
            tasks.append(make_request())

        await asyncio.gather(*tasks)

        print(f"\nResults:")
        print(f"  Successes (200): {successes}")
        print(f"  Rate Limited (429): {errors_429}")

        # Should see some rate limiting (50/min limit)
        passed = errors_429 > 0
        print(f"\n  Status: {'✅ PASS' if passed else '⚠️  WARNING - No rate limiting detected'}")

        return {
            "test": "rate_limiting",
            "passed": passed,
            "successes": successes,
            "rate_limited": errors_429
        }


async def run_quick_load_tests():
    """Run quick load test suite"""
    print("\n" + "="*60)
    print("QUICK LOAD & STRESS TESTS")
    print("="*60)
    print("\nThese tests validate production readiness:")
    print("- Concurrent request handling")
    print("- Sustained load capacity")
    print("- Memory stability")
    print("- Rate limiting")

    results = []

    # Test 1: 20 concurrent requests
    results.append(await test_concurrent_api_calls(20, "/api/health"))

    # Test 2: 50 concurrent requests
    results.append(await test_concurrent_api_calls(50, "/api/health"))

    # Test 3: 100 concurrent requests
    results.append(await test_concurrent_api_calls(100, "/api/health"))

    # Test 4: Sustained load (30 seconds, 10 req/sec)
    results.append(await test_sustained_load(30, 10))

    # Test 5: Memory usage test
    results.append(await test_backend_memory_usage())

    # Test 6: Rate limiting
    results.append(await test_rate_limiting())

    # Summary
    print(f"\n{'='*60}")
    print("SUMMARY")
    print(f"{'='*60}")

    passed_count = sum(1 for r in results if r.get("passed"))
    total_count = len(results)

    print(f"\nTests Passed: {passed_count}/{total_count}")
    print(f"Pass Rate: {passed_count / total_count * 100:.1f}%\n")

    for result in results:
        status = "✅ PASS" if result.get("passed") else "❌ FAIL"
        print(f"  {result['test']}: {status}")

    # Key metrics
    print(f"\n{'='*60}")
    print("KEY METRICS")
    print(f"{'='*60}")

    for result in results:
        if "p95_ms" in result and result["p95_ms"] > 0:
            print(f"  {result['test']}: p95 = {result['p95_ms']:.1f}ms")
        if "throughput_rps" in result:
            print(f"  {result['test']}: throughput = {result['throughput_rps']:.1f} req/s")

    return results


if __name__ == "__main__":
    # Load environment variables
    from dotenv import load_dotenv
    load_dotenv()

    asyncio.run(run_quick_load_tests())
