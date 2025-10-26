"""
CI Diagnostic Test - Prints detailed environment information
This will help us understand why tests fail in CI but pass locally
"""
import sys
import os


def test_ci_environment():
    """Print detailed CI environment information"""
    print("\n" + "=" * 80)
    print("CI ENVIRONMENT DIAGNOSTIC")
    print("=" * 80)

    print("\n### Python Information ###")
    print(f"Python version: {sys.version}")
    print(f"Python executable: {sys.executable}")
    print(f"Python path: {sys.path}")

    print("\n### Working Directory ###")
    print(f"Current directory: {os.getcwd()}")
    print(f"Directory contents: {os.listdir('.')}")

    print("\n### Environment Variables ###")
    env_vars = ['PYTHONPATH', 'SECRET_KEY', 'ENVIRONMENT', 'REDIS_URL', 'PATH']
    for var in env_vars:
        print(f"{var}: {os.getenv(var, 'NOT SET')}")

    print("\n### Import Test ###")
    try:
        import calculation_models
        print(f"✅ calculation_models imported from: {calculation_models.__file__}")
    except ImportError as e:
        print(f"❌ calculation_models import failed: {e}")
        print(f"   sys.path: {sys.path}")

    try:
        from routes.quotes_calc import safe_decimal
        print(f"✅ routes.quotes_calc imported successfully")
    except ImportError as e:
        print(f"❌ routes.quotes_calc import failed: {e}")
        # Check if routes directory exists
        routes_exists = os.path.exists('routes')
        print(f"   routes directory exists: {routes_exists}")
        if routes_exists:
            print(f"   routes contents: {os.listdir('routes')}")

    print("\n### Test Files ###")
    if os.path.exists('tests'):
        print(f"tests directory contents: {os.listdir('tests')}")

    print("\n" + "=" * 80)

    # Test should always pass - we just want the output
    assert True


if __name__ == "__main__":
    test_ci_environment()
