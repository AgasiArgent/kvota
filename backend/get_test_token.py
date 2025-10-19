"""
Helper script to get authentication token for testing
"""
import os
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

def get_token_with_credentials(email, password):
    """Get auth token by logging in with email/password"""
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_anon_key = os.getenv("SUPABASE_ANON_KEY")

    if not supabase_url or not supabase_anon_key:
        print("❌ Missing SUPABASE_URL or SUPABASE_ANON_KEY in .env")
        return None

    try:
        supabase = create_client(supabase_url, supabase_anon_key)

        # Sign in
        response = supabase.auth.sign_in_with_password({
            "email": email,
            "password": password
        })

        if response.session:
            token = response.session.access_token
            print(f"\n✅ Successfully logged in as: {email}")
            print(f"\n🔑 Access Token:")
            print(f"{token}\n")
            print(f"\n📝 To use this token in tests:")
            print(f"export TEST_AUTH_TOKEN='{token}'")
            print(f"\nOr add to backend/.env:")
            print(f"TEST_AUTH_TOKEN={token}")
            print(f"\nToken expires at: {response.session.expires_at}")
            return token
        else:
            print("❌ Login failed: No session returned")
            return None

    except Exception as e:
        print(f"❌ Error logging in: {str(e)}")
        return None

def main():
    print("="*80)
    print("  🔐 GET TEST AUTHENTICATION TOKEN")
    print("="*80)
    print("\nThis script will help you get an auth token for API testing.\n")

    email = input("Enter your email: ").strip()
    password = input("Enter your password: ").strip()

    if not email or not password:
        print("❌ Email and password are required")
        return

    token = get_token_with_credentials(email, password)

    if token:
        print("\n✅ Token retrieved successfully!")
        print("\nNow run the tests:")
        print("  export TEST_AUTH_TOKEN='<token-above>'")
        print("  python test_endpoints.py")
    else:
        print("\n❌ Could not get token")
        print("\nMake sure:")
        print("  1. You have a registered account")
        print("  2. Email and password are correct")
        print("  3. Supabase credentials in .env are correct")

if __name__ == "__main__":
    main()
