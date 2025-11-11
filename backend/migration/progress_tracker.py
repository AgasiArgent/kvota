import sys
from datetime import datetime


class ProgressTracker:
    """Track import progress with visual feedback"""

    def __init__(self):
        self.total = 0
        self.current = 0
        self.start_time = None
        self.successful = 0
        self.failed = 0
        self.skipped = 0

    def start(self, total: int):
        """Start tracking"""
        self.total = total
        self.current = 0
        self.start_time = datetime.now()

        print(f"\n🚀 Starting import of {total} files...")
        print("=" * 60)

    def increment(self, status: str = "✅", message: str = ""):
        """Update progress"""
        self.current += 1

        if status == "✅":
            self.successful += 1
        elif status == "❌":
            self.failed += 1
        elif status == "⏭️":
            self.skipped += 1

        # Progress bar
        progress = self.current / self.total
        bar_length = 40
        filled = int(bar_length * progress)
        bar = "█" * filled + "░" * (bar_length - filled)

        # ETA
        elapsed = datetime.now() - self.start_time
        if self.current > 0:
            avg_time = elapsed / self.current
            remaining = avg_time * (self.total - self.current)
            eta = f"ETA: {str(remaining).split('.')[0]}"
        else:
            eta = "ETA: calculating..."

        # Print status
        sys.stdout.write(
            f"\r{status} [{bar}] {self.current}/{self.total} "
            f"({progress*100:.1f}%) | {eta} | "
            f"✅ {self.successful} ❌ {self.failed} ⏭️ {self.skipped}"
        )
        sys.stdout.flush()

        if status == "❌" and message:
            print(f"\n  ⚠️  {message}")

    def finish(self):
        """Finish tracking"""
        elapsed = datetime.now() - self.start_time

        print("\n" + "=" * 60)
        print(f"✅ Import complete in {str(elapsed).split('.')[0]}")
        print(f"   Successful: {self.successful}")
        print(f"   Failed:     {self.failed}")
        print(f"   Skipped:    {self.skipped}")
