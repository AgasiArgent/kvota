#!/usr/bin/env python3
"""
Test exchange rate service functionality
"""
import asyncio
import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Add backend to path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

# Load environment variables
load_dotenv()

from services.exchange_rate_service import ExchangeRateService


async def test_fetch_rates():
    """Test fetching exchange rates from CBR API"""
    print("=" * 60)
    print("Testing Exchange Rate Service")
    print("=" * 60)

    service = ExchangeRateService()

    # Test 1: Fetch rates from CBR
    print("\n1. Fetching rates from CBR API...")
    try:
        rates = await service.fetch_cbr_rates()
        if rates:
            print(f"✅ Successfully fetched {len(rates)} exchange rates")
            # Show sample rates
            for currency in ["USD", "EUR", "CNY", "TRY"]:
                if currency in rates:
                    print(f"   {currency}/RUB: {rates[currency]}")
        else:
            print("⚠️ No rates fetched (API might be down)")
    except Exception as e:
        print(f"❌ Error fetching rates: {e}")
        return False

    # Test 2: Get specific rate (should use cached value)
    print("\n2. Testing get_rate with caching...")
    try:
        usd_rate = await service.get_rate("USD", "RUB")
        if usd_rate:
            print(f"✅ USD/RUB rate: {usd_rate}")
        else:
            print("⚠️ No USD/RUB rate available")
    except Exception as e:
        print(f"❌ Error getting USD rate: {e}")

    # Test 3: Cross-rate calculation
    print("\n3. Testing cross-rate calculation...")
    try:
        eur_usd_rate = await service.get_rate("EUR", "USD")
        if eur_usd_rate:
            print(f"✅ EUR/USD cross-rate: {eur_usd_rate}")
        else:
            print("⚠️ No EUR/USD cross-rate available")
    except Exception as e:
        print(f"❌ Error calculating cross-rate: {e}")

    # Test 4: Same currency
    print("\n4. Testing same currency conversion...")
    try:
        rub_rub = await service.get_rate("RUB", "RUB")
        if rub_rub == 1.0:
            print(f"✅ RUB/RUB correctly returns 1.0")
        else:
            print(f"⚠️ RUB/RUB returned {rub_rub} instead of 1.0")
    except Exception as e:
        print(f"❌ Error with same currency: {e}")

    # Test 5: Cleanup old rates
    print("\n5. Testing cleanup of old rates...")
    try:
        deleted = await service.cleanup_old_rates(days_to_keep=30)
        print(f"✅ Cleaned up {deleted} old records")
    except Exception as e:
        print(f"❌ Error cleaning up rates: {e}")

    print("\n" + "=" * 60)
    print("Exchange Rate Service Test Complete")
    print("=" * 60)

    return True


async def test_scheduler():
    """Test scheduler setup"""
    print("\n6. Testing scheduler setup...")
    service = ExchangeRateService()

    try:
        service.setup_cron_job()
        print("✅ Scheduler started successfully")

        # Wait a bit to ensure it's running
        await asyncio.sleep(2)

        # Check if scheduler is running
        if service.scheduler and service.scheduler.running:
            jobs = service.scheduler.get_jobs()
            print(f"   Active jobs: {len(jobs)}")
            for job in jobs:
                print(f"   - {job.name}: Next run at {job.next_run_time}")
        else:
            print("⚠️ Scheduler not running")

        # Shutdown scheduler
        service.shutdown_scheduler()
        print("✅ Scheduler stopped successfully")

    except Exception as e:
        print(f"❌ Error with scheduler: {e}")
        if service.scheduler:
            service.shutdown_scheduler()


async def main():
    """Run all tests"""
    success = await test_fetch_rates()
    if success:
        await test_scheduler()


if __name__ == "__main__":
    print("Starting Exchange Rate Service Tests...")
    print(f"CBR API URL: https://www.cbr-xml-daily.ru/daily_json.js")
    print(f"Supabase URL: {os.getenv('SUPABASE_URL', 'NOT SET')[:30]}...")
    print()

    asyncio.run(main())