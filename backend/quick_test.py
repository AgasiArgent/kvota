import asyncio
import asyncpg
import os
from dotenv import load_dotenv

load_dotenv()

async def quick_test():
    try:
        print("Testing connection with 10 second timeout...")
        conn = await asyncio.wait_for(
            asyncpg.connect(os.getenv("DATABASE_URL")), 
            timeout=10
        )
        result = await conn.fetchval("SELECT 1")
        await conn.close()
        print(f"SUCCESS: Got result {result}")
    except Exception as e:
        print(f"FAILED: {e}")

asyncio.run(quick_test())
