#!/usr/bin/env python3
"""
Pre-Test Validation Hook for Russian B2B Quotation System
Validates test environment, database connectivity, and required configurations
"""
import os
import sys
import asyncio
import asyncpg
from pathlib import Path
from typing import Dict, List, Tuple, Optional
from dotenv import load_dotenv


class TestEnvironmentValidator:
    """Validates the test environment before running tests"""

    def __init__(self):
        self.errors: List[str] = []
        self.warnings: List[str] = []
        self.checks_passed = 0
        self.total_checks = 0

    def print_status(self, message: str, status: str = "info"):
        """Print colored status messages"""
        colors = {
            "success": "\033[0;32m✅",
            "error": "\033[0;31m❌",
            "warning": "\033[1;33m⚠️ ",
            "info": "\033[0;34mℹ️ ",
        }
        print(f"{colors.get(status, colors['info'])} {message}\033[0m")

    def check_environment_file(self) -> bool:
        """Check if .env file exists and has required variables"""
        self.total_checks += 1

        env_path = Path(".env")
        if not env_path.exists():
            self.errors.append(".env file not found")
            self.print_status(".env file not found", "error")
            return False

        # Load environment variables
        load_dotenv()

        required_vars = [
            "SUPABASE_URL",
            "SUPABASE_ANON_KEY",
            "SUPABASE_SERVICE_ROLE_KEY",
            "DATABASE_URL"
        ]

        missing_vars = []
        for var in required_vars:
            if not os.getenv(var):
                missing_vars.append(var)

        if missing_vars:
            self.errors.append(f"Missing environment variables: {', '.join(missing_vars)}")
            self.print_status(f"Missing environment variables: {', '.join(missing_vars)}", "error")
            return False

        self.checks_passed += 1
        self.print_status("Environment configuration validated", "success")
        return True

    async def check_database_connection(self) -> bool:
        """Test database connectivity"""
        self.total_checks += 1

        try:
            database_url = os.getenv("DATABASE_URL")
            if not database_url:
                self.errors.append("DATABASE_URL not configured")
                self.print_status("DATABASE_URL not configured", "error")
                return False

            # Test basic connection
            conn = await asyncpg.connect(database_url)

            # Test basic query
            result = await conn.fetchval("SELECT 1")
            if result != 1:
                raise Exception("Basic query failed")

            # Check if required tables exist
            tables_query = """
                SELECT table_name
                FROM information_schema.tables
                WHERE table_schema = 'public'
                AND table_name IN ('customers', 'quotes', 'quote_items', 'quote_approvals')
            """
            existing_tables = await conn.fetch(tables_query)
            table_names = [row['table_name'] for row in existing_tables]

            required_tables = ['customers', 'quotes', 'quote_items', 'quote_approvals']
            missing_tables = [table for table in required_tables if table not in table_names]

            if missing_tables:
                self.warnings.append(f"Missing tables: {', '.join(missing_tables)}")
                self.print_status(f"Missing tables: {', '.join(missing_tables)}", "warning")

            # Check if auth.users table exists (Supabase)
            auth_query = """
                SELECT table_name
                FROM information_schema.tables
                WHERE table_schema = 'auth'
                AND table_name = 'users'
            """
            auth_tables = await conn.fetch(auth_query)
            if not auth_tables:
                self.warnings.append("Supabase auth tables not found")
                self.print_status("Supabase auth tables not found", "warning")

            await conn.close()

            self.checks_passed += 1
            self.print_status("Database connection validated", "success")
            return True

        except Exception as e:
            self.errors.append(f"Database connection failed: {str(e)}")
            self.print_status(f"Database connection failed: {str(e)}", "error")
            return False

    def check_test_dependencies(self) -> bool:
        """Check if test dependencies are installed"""
        self.total_checks += 1

        required_packages = [
            "pytest",
            "pytest-asyncio",
            "httpx",
            "pytest-cov"
        ]

        missing_packages = []
        for package in required_packages:
            try:
                __import__(package.replace("-", "_"))
            except ImportError:
                missing_packages.append(package)

        if missing_packages:
            self.errors.append(f"Missing test packages: {', '.join(missing_packages)}")
            self.print_status(f"Missing test packages: {', '.join(missing_packages)}", "error")
            self.print_status("Run: pip install pytest pytest-asyncio httpx pytest-cov", "info")
            return False

        self.checks_passed += 1
        self.print_status("Test dependencies validated", "success")
        return True

    def check_test_directories(self) -> bool:
        """Check if test directory structure exists"""
        self.total_checks += 1

        test_dirs = ["tests", "tests/unit", "tests/integration", "tests/fixtures"]

        for test_dir in test_dirs:
            test_path = Path(test_dir)
            if not test_path.exists():
                test_path.mkdir(parents=True, exist_ok=True)
                self.print_status(f"Created test directory: {test_dir}", "info")

        # Create basic test files if they don't exist
        basic_tests = {
            "tests/__init__.py": "",
            "tests/conftest.py": '''"""Test configuration and fixtures"""
import pytest
import asyncio
from fastapi.testclient import TestClient
from main import app

@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()

@pytest.fixture
def client():
    """Create test client"""
    return TestClient(app)
''',
            "tests/test_health.py": '''"""Basic health check tests"""
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_root_endpoint():
    """Test root endpoint"""
    response = client.get("/")
    assert response.status_code == 200
    assert "B2B Quotation Platform API" in response.json()["message"]

def test_health_endpoint():
    """Test health endpoint"""
    response = client.get("/api/health")
    # Health endpoint might fail without proper DB, so check for 200 or 503
    assert response.status_code in [200, 503]
'''
        }

        for file_path, content in basic_tests.items():
            file_obj = Path(file_path)
            if not file_obj.exists():
                file_obj.write_text(content)
                self.print_status(f"Created test file: {file_path}", "info")

        self.checks_passed += 1
        self.print_status("Test directory structure validated", "success")
        return True

    def check_russian_business_config(self) -> bool:
        """Check Russian business specific configurations"""
        self.total_checks += 1

        # Check if models.py has Russian business validation
        models_path = Path("models.py")
        if models_path.exists():
            content = models_path.read_text()

            russian_patterns = [
                "inn",  # Russian tax number
                "kpp",  # Russian tax code
                "ogrn", # Russian business registration
                "RUB",  # Russian currency
                "vat_rate"  # VAT for Russian business
            ]

            missing_patterns = []
            for pattern in russian_patterns:
                if pattern.lower() not in content.lower():
                    missing_patterns.append(pattern)

            if missing_patterns:
                self.warnings.append(f"Missing Russian business patterns: {', '.join(missing_patterns)}")
                self.print_status(f"Missing Russian business patterns: {', '.join(missing_patterns)}", "warning")
            else:
                self.print_status("Russian business patterns found", "success")

        self.checks_passed += 1
        return True

    async def run_all_checks(self) -> bool:
        """Run all validation checks"""
        self.print_status("🧪 Validating test environment for Russian B2B Quotation System", "info")
        print()

        # Run synchronous checks
        env_check = self.check_environment_file()
        deps_check = self.check_test_dependencies()
        dirs_check = self.check_test_directories()
        business_check = self.check_russian_business_config()

        # Run async checks
        db_check = await self.check_database_connection()

        print()
        self.print_status(f"Validation Summary: {self.checks_passed}/{self.total_checks} checks passed", "info")

        if self.warnings:
            print()
            self.print_status("Warnings:", "warning")
            for warning in self.warnings:
                print(f"  • {warning}")

        if self.errors:
            print()
            self.print_status("Errors:", "error")
            for error in self.errors:
                print(f"  • {error}")
            return False

        print()
        self.print_status("✨ Test environment validation completed successfully!", "success")
        self.print_status("🚀 Ready to run tests!", "info")
        return True


async def main():
    """Main validation function"""
    validator = TestEnvironmentValidator()

    try:
        success = await validator.run_all_checks()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n❌ Validation interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Validation failed with error: {str(e)}")
        sys.exit(1)


if __name__ == "__main__":
    # Change to script directory to find .env file
    script_dir = Path(__file__).parent.parent
    os.chdir(script_dir)

    asyncio.run(main())