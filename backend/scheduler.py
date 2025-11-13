"""
Analytics Report Scheduler

Background job that runs every minute to check for due scheduled reports.
"""

import asyncio
import os
import sys
from datetime import datetime
from dotenv import load_dotenv
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
import logging

# Add parent directory to Python path to import modules
sys.path.insert(0, os.path.dirname(__file__))

load_dotenv()

from supabase import create_client, Client
from async_supabase import async_supabase_call
from routes.analytics import execute_scheduled_report_internal
from auth import User

logger = logging.getLogger(__name__)


async def check_and_run_scheduled_reports():
    """Check for due scheduled reports and execute them"""

    supabase: Client = create_client(
        os.getenv("SUPABASE_URL"),
        os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    )

    try:
        # Find due reports
        query = supabase.table("scheduled_reports") \
            .select("*, saved_report:saved_reports(*)") \
            .lte("next_run_at", datetime.now().isoformat()) \
            .eq("is_active", True)

        result = await async_supabase_call(query)

        due_reports = result.data if result.data else []

        logger.info(f"Found {len(due_reports)} scheduled reports due for execution")

        for schedule in due_reports:
            try:
                saved_report = schedule.get("saved_report")

                if not saved_report:
                    logger.warning(f"Skipping schedule {schedule['id']}: No saved report found")
                    continue

                # Create system user context
                user = User(
                    id=schedule["created_by"],
                    email="system@scheduler",
                    full_name="System Scheduler",
                    current_organization_id=schedule["organization_id"],
                    current_role="admin",
                    current_role_slug="admin",
                    is_owner=False,
                    role="admin",
                    permissions=[],
                    created_at=datetime.utcnow()
                )

                # Execute report
                execution = await execute_scheduled_report_internal(
                    schedule=schedule,
                    saved_report=saved_report,
                    user=user,
                    execution_type="scheduled"
                )

                logger.info(
                    f"✅ Executed scheduled report: {schedule['name']} "
                    f"(execution_id: {execution['id']})"
                )

            except Exception as e:
                logger.error(
                    f"❌ Failed to execute scheduled report {schedule.get('name', schedule['id'])}: {e}",
                    exc_info=True
                )

                # Failure status already updated in execute_scheduled_report_internal
                # via exception handling

    except Exception as e:
        logger.error(f"Error in check_and_run_scheduled_reports: {e}", exc_info=True)


def start_scheduler():
    """Start the scheduler background process"""

    scheduler = AsyncIOScheduler()

    # Run every minute to check for due reports
    scheduler.add_job(
        check_and_run_scheduled_reports,
        CronTrigger(minute='*'),  # Every minute
        id='scheduled_reports_check',
        name='Check and run scheduled reports',
        replace_existing=True
    )

    scheduler.start()
    logger.info("📅 Scheduler started - checking for due reports every minute")

    return scheduler


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )

    logger.info("Starting Analytics Report Scheduler...")

    scheduler = start_scheduler()

    try:
        # Keep running
        asyncio.get_event_loop().run_forever()
    except (KeyboardInterrupt, SystemExit):
        logger.info("Shutting down scheduler...")
        scheduler.shutdown()
        logger.info("Scheduler stopped")
