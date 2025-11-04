#!/usr/bin/env python3
"""
Test that endpoints are working after asyncpg fix
"""
import asyncio
import httpx
import os
from dotenv import load_dotenv

load_dotenv()

async def test_endpoints():
    """Test both quotes and analytics endpoints"""

    # Use test credentials
    login_data = {
        "email": "andrey@masterbearingsales.ru",
        "password": "password"
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        # Login to get fresh token
        print("🔐 Logging in...")
        login_response = await client.post(
            "http://localhost:8001/api/auth/login",
            json=login_data
        )

        if login_response.status_code != 200:
            print(f"❌ Login failed: {login_response.text}")
            return

        token = login_response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        print(f"✅ Logged in successfully")

        # Test quotes endpoint
        print("\n📋 Testing /api/quotes endpoint...")
        quotes_response = await client.get(
            "http://localhost:8001/api/quotes",
            headers=headers
        )

        if quotes_response.status_code == 200:
            data = quotes_response.json()
            print(f"✅ Quotes endpoint working! Returned {len(data)} quotes")
        else:
            print(f"❌ Quotes endpoint error: {quotes_response.status_code} - {quotes_response.text}")

        # Test analytics query endpoint
        print("\n📊 Testing /api/analytics/query endpoint...")
        analytics_response = await client.post(
            "http://localhost:8001/api/analytics/query",
            headers=headers,
            json={
                "query_type": "revenue_analysis",
                "filters": {
                    "date_range": "last_30_days"
                }
            }
        )

        if analytics_response.status_code == 200:
            data = analytics_response.json()
            print(f"✅ Analytics endpoint working!")
            print(f"   Data keys: {list(data.keys())}")
        else:
            print(f"❌ Analytics endpoint error: {analytics_response.status_code} - {analytics_response.text[:500]}")

if __name__ == "__main__":
    print("=" * 60)
    print("TESTING ENDPOINTS AFTER ASYNCPG FIX")
    print("=" * 60)
    asyncio.run(test_endpoints())
