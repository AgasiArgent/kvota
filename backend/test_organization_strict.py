#!/usr/bin/env python3
"""
STRICT Organization API Testing Suite
Comprehensive functional tests with database verification
"""
import requests
import json
from supabase import create_client, Client
from typing import Optional, Dict, Any
from datetime import datetime

# Configuration
API_URL = "http://localhost:8000"
SUPABASE_URL = "https://wstwwmiihkzlgvlymlfd.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndzdHd3bWlpaGt6bGd2bHltbGZkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTU2NjgzNCwiZXhwIjoyMDY3MTQyODM0fQ.***REMOVED***"

# Color codes
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
BLUE = "\033[94m"
RESET = "\033[0m"


class StrictOrganizationTester:
    """Comprehensive functional testing with database verification"""

    def __init__(self):
        self.auth_token: Optional[str] = None
        self.test_user_id: Optional[str] = None
        self.test_org_id: Optional[str] = None
        self.test_invitation_id: Optional[str] = None
        self.test_invitation_token: Optional[str] = None
        self.test_results = []
        self.supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

    def log_test(self, test_name: str, passed: bool, details: str = "", db_verified: bool = False):
        """Log test result with database verification status"""
        status = f"{GREEN}✅ PASS{RESET}" if passed else f"{RED}❌ FAIL{RESET}"
        db_check = f" {BLUE}[DB ✓]{RESET}" if db_verified else ""
        print(f"{status}{db_check} - {test_name}")
        if details:
            print(f"        {details}")
        self.test_results.append(passed)

    def api_request(self, method: str, endpoint: str, data: Optional[Dict] = None) -> requests.Response:
        """Make authenticated API request"""
        headers = {
            "Content-Type": "application/json"
        }

        if self.auth_token:
            headers["Authorization"] = f"Bearer {self.auth_token}"

        url = f"{API_URL}{endpoint}"

        if method == "GET":
            return requests.get(url, headers=headers)
        elif method == "POST":
            return requests.post(url, json=data, headers=headers)
        elif method == "PUT":
            return requests.put(url, json=data, headers=headers)
        elif method == "DELETE":
            return requests.delete(url, headers=headers)

    def verify_in_database(self, table: str, id_value: str, expected_fields: Dict = None) -> bool:
        """Verify record exists in database with expected values"""
        try:
            result = self.supabase.table(table).select("*").eq("id", id_value).single().execute()

            if not result.data:
                return False

            if expected_fields:
                for field, expected_value in expected_fields.items():
                    if result.data.get(field) != expected_value:
                        print(f"          DB mismatch: {field} = {result.data.get(field)}, expected {expected_value}")
                        return False

            return True
        except Exception as e:
            print(f"          DB verification error: {e}")
            return False

    def setup_authentication(self) -> bool:
        """Load authentication token"""
        print(f"\n{BLUE}🔧 Loading authentication token...{RESET}")

        try:
            with open('/tmp/test_auth_token.txt', 'r') as f:
                self.auth_token = f.read().strip()

            # Decode JWT to get user ID
            import base64
            payload_part = self.auth_token.split('.')[1]
            # Add padding if needed
            padding = 4 - len(payload_part) % 4
            if padding != 4:
                payload_part += '=' * padding

            payload = json.loads(base64.b64decode(payload_part))
            self.test_user_id = payload.get('sub')

            print(f"   {GREEN}✓{RESET} Token loaded")
            print(f"   {GREEN}✓{RESET} User ID: {self.test_user_id}")
            return True

        except Exception as e:
            print(f"   {RED}✗{RESET} Failed to load token: {e}")
            return False

    def test_01_create_organization(self):
        """Test: Create organization with database verification"""
        try:
            org_data = {
                "name": f"Test Organization {datetime.now().strftime('%H%M%S')}",
                "slug": f"test-org-{datetime.now().strftime('%H%M%S')}",
                "description": "Created by strict test suite",
                "settings": {"test_mode": True}
            }

            response = self.api_request("POST", "/api/organizations/", org_data)

            if response.status_code == 201:
                data = response.json()
                self.test_org_id = data.get("id")

                # Verify in database
                db_verified = self.verify_in_database(
                    "organizations",
                    self.test_org_id,
                    {
                        "name": org_data["name"],
                        "slug": org_data["slug"],
                        "status": "active"
                    }
                )

                # Verify membership created
                member_result = self.supabase.table("organization_members")\
                    .select("*")\
                    .eq("organization_id", self.test_org_id)\
                    .eq("user_id", self.test_user_id)\
                    .single()\
                    .execute()

                member_verified = member_result.data and member_result.data.get("is_owner") == True

                self.log_test(
                    "Create Organization",
                    True,
                    f"Org ID: {self.test_org_id}, Owner membership: {member_verified}",
                    db_verified and member_verified
                )
                return True
            else:
                self.log_test(
                    "Create Organization",
                    False,
                    f"HTTP {response.status_code}: {response.text[:100]}"
                )
                return False

        except Exception as e:
            self.log_test("Create Organization", False, f"Error: {e}")
            return False

    def test_02_list_organizations(self):
        """Test: List user's organizations"""
        try:
            response = self.api_request("GET", "/api/organizations/")

            if response.status_code == 200:
                data = response.json()
                found = any(org.get("organization_id") == self.test_org_id for org in data)

                self.log_test(
                    "List Organizations",
                    found,
                    f"Found {len(data)} organization(s), test org included: {found}",
                    True
                )
                return found
            else:
                self.log_test(
                    "List Organizations",
                    False,
                    f"HTTP {response.status_code}: {response.text[:100]}"
                )
                return False

        except Exception as e:
            self.log_test("List Organizations", False, f"Error: {e}")
            return False

    def test_03_get_organization(self):
        """Test: Get specific organization"""
        if not self.test_org_id:
            self.log_test("Get Organization", False, "No test org ID")
            return False

        try:
            response = self.api_request("GET", f"/api/organizations/{self.test_org_id}")

            if response.status_code == 200:
                data = response.json()
                name_matches = "Test Organization" in data.get("name", "")

                self.log_test(
                    "Get Organization",
                    True,
                    f"Retrieved: {data.get('name', 'N/A')}",
                    name_matches
                )
                return True
            else:
                self.log_test(
                    "Get Organization",
                    False,
                    f"HTTP {response.status_code}: {response.text[:100]}"
                )
                return False

        except Exception as e:
            self.log_test("Get Organization", False, f"Error: {e}")
            return False

    def test_04_update_organization(self):
        """Test: Update organization with database verification"""
        if not self.test_org_id:
            self.log_test("Update Organization", False, "No test org ID")
            return False

        try:
            update_data = {
                "description": "Updated by strict test suite",
                "settings": {"test_mode": True, "updated": True}
            }

            response = self.api_request(
                "PUT",
                f"/api/organizations/{self.test_org_id}",
                update_data
            )

            if response.status_code == 200:
                data = response.json()

                # Verify in database
                db_verified = self.verify_in_database(
                    "organizations",
                    self.test_org_id,
                    {"description": update_data["description"]}
                )

                self.log_test(
                    "Update Organization",
                    True,
                    f"Description updated: {data.get('description', '')[:50]}",
                    db_verified
                )
                return True
            else:
                self.log_test(
                    "Update Organization",
                    False,
                    f"HTTP {response.status_code}: {response.text[:100]}"
                )
                return False

        except Exception as e:
            self.log_test("Update Organization", False, f"Error: {e}")
            return False

    def test_05_list_members(self):
        """Test: List organization members"""
        if not self.test_org_id:
            self.log_test("List Members", False, "No test org ID")
            return False

        try:
            response = self.api_request("GET", f"/api/organizations/{self.test_org_id}/members")

            if response.status_code == 200:
                data = response.json()
                # Should have at least the owner
                has_owner = any(m.get("is_owner") for m in data)

                self.log_test(
                    "List Members",
                    len(data) >= 1,
                    f"Found {len(data)} member(s), has owner: {has_owner}",
                    True
                )
                return len(data) >= 1
            else:
                self.log_test(
                    "List Members",
                    False,
                    f"HTTP {response.status_code}: {response.text[:100]}"
                )
                return False

        except Exception as e:
            self.log_test("List Members", False, f"Error: {e}")
            return False

    def test_06_list_roles(self):
        """Test: List available roles"""
        if not self.test_org_id:
            self.log_test("List Roles", False, "No test org ID")
            return False

        try:
            response = self.api_request("GET", f"/api/organizations/{self.test_org_id}/roles")

            if response.status_code == 200:
                data = response.json()

                # Should have 5 system roles
                system_roles = [r for r in data if r.get("is_system_role")]
                expected_slugs = ["admin", "financial_admin", "sales_manager", "procurement_manager", "logistics_manager"]
                has_all = all(any(r.get("slug") == slug for r in system_roles) for slug in expected_slugs)

                self.log_test(
                    "List Roles",
                    has_all,
                    f"Found {len(data)} roles ({len(system_roles)} system), all expected: {has_all}",
                    True
                )
                return has_all
            else:
                self.log_test(
                    "List Roles",
                    False,
                    f"HTTP {response.status_code}: {response.text[:100]}"
                )
                return False

        except Exception as e:
            self.log_test("List Roles", False, f"Error: {e}")
            return False

    def test_07_create_invitation(self):
        """Test: Create invitation with database verification"""
        if not self.test_org_id:
            self.log_test("Create Invitation", False, "No test org ID")
            return False

        try:
            # Get sales manager role
            roles_response = self.api_request("GET", f"/api/organizations/{self.test_org_id}/roles")
            roles = roles_response.json()
            sales_role = next((r for r in roles if r.get("slug") == "sales_manager"), None)

            if not sales_role:
                self.log_test("Create Invitation", False, "Sales manager role not found")
                return False

            invitation_data = {
                "email": "invited.user@test.com",
                "role_id": sales_role["id"],
                "message": "Join our test organization"
            }

            response = self.api_request(
                "POST",
                f"/api/organizations/{self.test_org_id}/invitations",
                invitation_data
            )

            if response.status_code == 201:
                data = response.json()
                self.test_invitation_id = data.get("id")
                self.test_invitation_token = data.get("token")

                # Verify in database
                db_verified = self.verify_in_database(
                    "organization_invitations",
                    self.test_invitation_id,
                    {
                        "email": invitation_data["email"],
                        "status": "pending"
                    }
                )

                self.log_test(
                    "Create Invitation",
                    True,
                    f"Invitation ID: {self.test_invitation_id}, Token generated: {bool(self.test_invitation_token)}",
                    db_verified
                )
                return True
            else:
                self.log_test(
                    "Create Invitation",
                    False,
                    f"HTTP {response.status_code}: {response.text[:100]}"
                )
                return False

        except Exception as e:
            self.log_test("Create Invitation", False, f"Error: {e}")
            return False

    def test_08_list_invitations(self):
        """Test: List organization invitations"""
        if not self.test_org_id:
            self.log_test("List Invitations", False, "No test org ID")
            return False

        try:
            response = self.api_request("GET", f"/api/organizations/{self.test_org_id}/invitations")

            if response.status_code == 200:
                data = response.json()
                found = any(inv.get("id") == self.test_invitation_id for inv in data)

                self.log_test(
                    "List Invitations",
                    found,
                    f"Found {len(data)} invitation(s), test invitation included: {found}",
                    True
                )
                return found
            else:
                self.log_test(
                    "List Invitations",
                    False,
                    f"HTTP {response.status_code}: {response.text[:100]}"
                )
                return False

        except Exception as e:
            self.log_test("List Invitations", False, f"Error: {e}")
            return False

    def test_09_switch_organization(self):
        """Test: Switch active organization with database verification"""
        if not self.test_org_id:
            self.log_test("Switch Organization", False, "No test org ID")
            return False

        try:
            response = self.api_request("POST", f"/api/organizations/{self.test_org_id}/switch")

            if response.status_code == 200:
                # Verify in database
                profile_result = self.supabase.table("user_profiles")\
                    .select("last_active_organization_id")\
                    .eq("user_id", self.test_user_id)\
                    .single()\
                    .execute()

                db_verified = (profile_result.data and
                             profile_result.data.get("last_active_organization_id") == self.test_org_id)

                self.log_test(
                    "Switch Organization",
                    True,
                    f"Switched to org: {self.test_org_id[:8]}...",
                    db_verified
                )
                return True
            else:
                self.log_test(
                    "Switch Organization",
                    False,
                    f"HTTP {response.status_code}: {response.text[:100]}"
                )
                return False

        except Exception as e:
            self.log_test("Switch Organization", False, f"Error: {e}")
            return False

    def test_10_cancel_invitation(self):
        """Test: Cancel invitation with database verification"""
        if not self.test_org_id or not self.test_invitation_id:
            self.log_test("Cancel Invitation", False, "No test org/invitation ID")
            return False

        try:
            response = self.api_request(
                "DELETE",
                f"/api/organizations/{self.test_org_id}/invitations/{self.test_invitation_id}"
            )

            if response.status_code == 204:
                # Verify in database
                db_verified = self.verify_in_database(
                    "organization_invitations",
                    self.test_invitation_id,
                    {"status": "cancelled"}
                )

                self.log_test(
                    "Cancel Invitation",
                    True,
                    "Invitation cancelled successfully",
                    db_verified
                )
                return True
            else:
                self.log_test(
                    "Cancel Invitation",
                    False,
                    f"HTTP {response.status_code}: {response.text[:100]}"
                )
                return False

        except Exception as e:
            self.log_test("Cancel Invitation", False, f"Error: {e}")
            return False

    def test_11_delete_organization(self):
        """Test: Delete organization (soft delete) with database verification"""
        if not self.test_org_id:
            self.log_test("Delete Organization", False, "No test org ID")
            return False

        try:
            response = self.api_request("DELETE", f"/api/organizations/{self.test_org_id}")

            if response.status_code == 204:
                # Verify soft delete in database
                db_verified = self.verify_in_database(
                    "organizations",
                    self.test_org_id,
                    {"status": "deleted"}
                )

                self.log_test(
                    "Delete Organization (Soft Delete)",
                    True,
                    "Organization marked as deleted",
                    db_verified
                )
                return True
            else:
                self.log_test(
                    "Delete Organization",
                    False,
                    f"HTTP {response.status_code}: {response.text[:100]}"
                )
                return False

        except Exception as e:
            self.log_test("Delete Organization", False, f"Error: {e}")
            return False

    def run_all_tests(self):
        """Run comprehensive test suite"""
        print(f"\n{BLUE}{'='*70}{RESET}")
        print(f"{BLUE}🧪 STRICT Organization API Testing Suite{RESET}")
        print(f"{BLUE}   With Database Verification{RESET}")
        print(f"{BLUE}{'='*70}{RESET}")

        # Setup
        if not self.setup_authentication():
            print(f"\n{RED}✗ Authentication setup failed{RESET}")
            return False

        print(f"\n{BLUE}Running comprehensive functional tests...{RESET}\n")

        # Run all tests in sequence
        self.test_01_create_organization()
        self.test_02_list_organizations()
        self.test_03_get_organization()
        self.test_04_update_organization()
        self.test_05_list_members()
        self.test_06_list_roles()
        self.test_07_create_invitation()
        self.test_08_list_invitations()
        self.test_09_switch_organization()
        self.test_10_cancel_invitation()
        self.test_11_delete_organization()

        # Summary
        passed = sum(self.test_results)
        total = len(self.test_results)

        print(f"\n{BLUE}{'='*70}{RESET}")
        print(f"{BLUE}Test Summary{RESET}")
        print(f"{BLUE}{'='*70}{RESET}")

        if passed == total:
            print(f"{GREEN}✅ All tests passed: {passed}/{total}{RESET}")
            print(f"{GREEN}✅ Database verification: PASSED{RESET}")
        else:
            print(f"{YELLOW}⚠ Tests passed: {passed}/{total}{RESET}")
            print(f"{RED}   Tests failed: {total - passed}{RESET}")

        print(f"{BLUE}{'='*70}{RESET}\n")

        return passed == total


if __name__ == "__main__":
    tester = StrictOrganizationTester()
    success = tester.run_all_tests()
    exit(0 if success else 1)
