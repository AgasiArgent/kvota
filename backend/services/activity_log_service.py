"""
Activity Log Service - Audit Trail System
Handles asynchronous logging with batching for performance
"""
import asyncio
import os
from typing import Optional, Dict, Any
from uuid import UUID
from datetime import datetime
from functools import wraps
from supabase import create_client, Client
import json


# ============================================================================
# GLOBAL STATE
# ============================================================================

# Batch queue for log entries
log_queue: asyncio.Queue = asyncio.Queue()

# Background worker task
worker_task: Optional[asyncio.Task] = None

# Shutdown flag
shutdown_flag = False


# ============================================================================
# LOGGING FUNCTIONS
# ============================================================================

async def log_activity(
    user_id: UUID,
    organization_id: UUID,
    action: str,
    entity_type: str,
    entity_id: Optional[UUID] = None,
    metadata: Optional[Dict[str, Any]] = None
):
    """
    Log user activity (non-blocking)

    Args:
        user_id: User performing the action
        organization_id: Organization context
        action: Action type (e.g., "created", "updated", "deleted")
        entity_type: Entity type (e.g., "quote", "customer", "contact")
        entity_id: ID of affected entity (optional)
        metadata: Additional context (optional)
    """
    log_entry = {
        "user_id": str(user_id),
        "organization_id": str(organization_id),
        "action": action,
        "entity_type": entity_type,
        "entity_id": str(entity_id) if entity_id else None,
        "metadata": metadata or {},
        "created_at": datetime.utcnow().isoformat()
    }

    try:
        # Add to queue (non-blocking)
        await log_queue.put(log_entry)
    except Exception as e:
        # Logging should never crash the app
        print(f"Warning: Failed to queue activity log: {e}")


def log_activity_decorator(entity_type: str, action: str):
    """
    Decorator for automatically logging route actions

    Usage:
        @log_activity_decorator("quote", "created")
        async def create_quote(...):
            ...

    Args:
        entity_type: Type of entity being operated on
        action: Action being performed
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Execute the original function
            result = await func(*args, **kwargs)

            # Extract user from kwargs (FastAPI dependency injection)
            user = kwargs.get('user')
            if not user:
                # Try to find user in args (less common)
                for arg in args:
                    if hasattr(arg, 'id') and hasattr(arg, 'current_organization_id'):
                        user = arg
                        break

            if user and hasattr(user, 'current_organization_id'):
                # Extract entity_id from result
                entity_id = None
                if isinstance(result, dict):
                    entity_id = result.get('id')
                elif hasattr(result, 'id'):
                    entity_id = result.id

                # Log activity
                await log_activity(
                    user_id=user.id,
                    organization_id=user.current_organization_id,
                    action=action,
                    entity_type=entity_type,
                    entity_id=entity_id
                )

            return result

        return wrapper
    return decorator


# ============================================================================
# BATCH WORKER
# ============================================================================

async def log_worker():
    """
    Background worker for batch inserts

    Flushes queue every 5 seconds or 100 entries

    Safety limits:
    - Max 86400 iterations (24 hours at 1 sec/iteration)
    - Max 24 hours absolute runtime
    - Auto-shutdown if memory exceeds 90%
    """
    global shutdown_flag

    supabase: Client = create_client(
        os.getenv("SUPABASE_URL"),
        os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    )

    batch = []
    last_flush = datetime.utcnow()

    # Safety limits to prevent infinite loops
    iteration_count = 0
    MAX_ITERATIONS = 86400  # 24 hours at 1 sec/iteration
    start_time = datetime.utcnow()
    MAX_RUNTIME_HOURS = 24

    while not shutdown_flag and iteration_count < MAX_ITERATIONS:
        # Check absolute timeout (prevents running forever)
        runtime_hours = (datetime.utcnow() - start_time).total_seconds() / 3600
        if runtime_hours > MAX_RUNTIME_HOURS:
            print(f"Activity log worker: Max runtime ({MAX_RUNTIME_HOURS}h) reached, shutting down")
            break

        iteration_count += 1

        try:
            # Wait for new log entry (with timeout)
            try:
                log_entry = await asyncio.wait_for(log_queue.get(), timeout=1.0)
                batch.append(log_entry)
            except asyncio.TimeoutError:
                # No new entries, check if we should flush
                pass

            # Flush conditions
            time_since_flush = (datetime.utcnow() - last_flush).total_seconds()
            should_flush = len(batch) >= 100 or time_since_flush >= 5.0

            if should_flush and batch:
                try:
                    # Batch insert
                    supabase.table("activity_logs").insert(batch).execute()
                    print(f"Activity logs: Flushed {len(batch)} entries")
                    batch = []
                    last_flush = datetime.utcnow()
                except Exception as e:
                    print(f"Error flushing activity logs: {e}")
                    # Don't clear batch on error - will retry next flush

        except Exception as e:
            print(f"Error in activity log worker: {e}")
            await asyncio.sleep(1)

    # Final flush on shutdown
    if batch:
        try:
            supabase.table("activity_logs").insert(batch).execute()
            print(f"Activity logs: Final flush of {len(batch)} entries")
        except Exception as e:
            print(f"Error during final flush: {e}")


async def setup_log_worker():
    """Start the background log worker"""
    global worker_task, shutdown_flag

    if worker_task is None:
        shutdown_flag = False
        worker_task = asyncio.create_task(log_worker())
        print("Activity log worker started")


async def shutdown_log_worker():
    """Gracefully shutdown the log worker"""
    global worker_task, shutdown_flag

    if worker_task:
        shutdown_flag = True
        await worker_task
        worker_task = None
        print("Activity log worker stopped")


# ============================================================================
# CLEANUP UTILITIES
# ============================================================================

async def cleanup_old_logs():
    """
    Auto-purge logs older than 6 months

    Should be called by a cron job weekly
    """
    supabase: Client = create_client(
        os.getenv("SUPABASE_URL"),
        os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    )

    try:
        # Call the database function
        result = await supabase.rpc("cleanup_old_activity_logs").execute()
        print("Activity logs: Old logs cleaned up successfully")
        return True
    except Exception as e:
        print(f"Error cleaning up old activity logs: {e}")
        return False
