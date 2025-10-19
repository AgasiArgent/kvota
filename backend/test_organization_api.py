#!/usr/bin/env python3
"""
Organization API Testing Suite
Tests all 15 organization management endpoints
"""
import requests
import json
import os
from dotenv import load_dotenv
from typing import Optional, Dict, Any

# Load environment variables
load_dotenv()

# Configuration
API_URL = "http://localhost:8000"
TEST_EMAIL = "test@example.com"
TEST_PASSWORD = "testpassword123"

# Color codes for output
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
BLUE = "\033[94m"
RESET = "\033[0m"


class OrganizationAPITester:
    """Test suite for organization API endpoints"""

    def __init__(self):
        self.session = requests.Session()
        self.auth_token: Optional[str] = None
        self.test_org_id: Optional[str] = None
        self.test_invitation_id: Optional[str] = None
        self.test_invitation_token: Optional[str] = None
        self.test_results = []

    def log_test(self, test_num: int, test_name: str, passed: bool, details: str = ""):
        """Log test result"""
        status = f"{GREEN}✅ PASS{RESET}" if passed else f"{RED}❌ FAIL{RESET}"
        print(f"[{test_num}/15] {status} - {test_name}")
        if details:
            print(f"        {details}")
        self.test_results.append(passed)

    def make_request(
        self,
        method: str,
        endpoint: str,
        data: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, str]] = None
    ) -> requests.Response:
        """Make API request with proper headers"""
        url = f"{API_URL}{endpoint}"
        req_headers = headers or {}

        if self.auth_token:
            req_headers["Authorization"] = f"Bearer {self.auth_token}"

        if data:
            req_headers["Content-Type"] = "application/json"

        return self.session.request(
            method=method,
            url=url,
            json=data,
            headers=req_headers
        )

    def setup_authentication(self) -> bool:
        """Setup test user and authentication"""
        print(f"\n{BLUE}🔧 Setting up authentication...{RESET}")

        # Check if test user already exists, if not create
        try:
            response = self.make_request("POST", "/api/users/test")

            if response.status_code == 200:
                print(f"   {GREEN}✓{RESET} Test user created/exists")
            elif response.status_code == 403:
                # Production environment - skip test user creation
                print(f"   {YELLOW}⚠{RESET} Test user endpoint disabled (production mode)")
                return False
            else:
                print(f"   {RED}✗{RESET} Failed to create test user: {response.text}")
                return False

            # Note: In a real scenario, we would authenticate with Supabase
            # For now, we'll test endpoints that don't require auth
            # or mock the auth context
            print(f"   {YELLOW}ℹ{RESET} Auth token mocking not implemented - will test without auth")
            return True

        except Exception as e:
            print(f"   {RED}✗{RESET} Setup error: {e}")
            return False

    def test_01_create_organization(self):
        """Test: POST /api/organizations/"""
        try:
            org_data = {
                "name": "Test Organization",
                "slug": "test-org",
                "description": "Organization created by automated tests",
                "settings": {
                    "default_currency": "RUB",
                    "timezone": "Europe/Moscow"
                }
            }

            response = self.make_request("POST", "/api/organizations/", org_data)

            if response.status_code == 200:
                data = response.json()
                self.test_org_id = data.get("id")
                self.log_test(
                    1,
                    "Create Organization",
                    True,
                    f"Created org ID: {self.test_org_id}"
                )
                return True
            else:
                self.log_test(
                    1,
                    "Create Organization",
                    False,
                    f"HTTP {response.status_code}: {response.text}"
                )
                return False

        except Exception as e:
            self.log_test(1, "Create Organization", False, f"Error: {e}")
            return False

    def test_02_list_organizations(self):
        """Test: GET /api/organizations/"""
        try:
            response = self.make_request("GET", "/api/organizations/")

            if response.status_code == 200:
                data = response.json()
                org_count = len(data) if isinstance(data, list) else 0
                self.log_test(
                    2,
                    "List Organizations",
                    True,
                    f"Found {org_count} organization(s)"
                )
                return True
            else:
                self.log_test(
                    2,
                    "List Organizations",
                    False,
                    f"HTTP {response.status_code}: {response.text}"
                )
                return False

        except Exception as e:
            self.log_test(2, "List Organizations", False, f"Error: {e}")
            return False

    def test_03_get_organization(self):
        """Test: GET /api/organizations/{id}"""
        if not self.test_org_id:
            self.log_test(3, "Get Organization", False, "No test org ID")
            return False

        try:
            response = self.make_request("GET", f"/api/organizations/{self.test_org_id}")

            if response.status_code == 200:
                data = response.json()
                self.log_test(
                    3,
                    "Get Organization",
                    True,
                    f"Retrieved: {data.get('name', 'N/A')}"
                )
                return True
            else:
                self.log_test(
                    3,
                    "Get Organization",
                    False,
                    f"HTTP {response.status_code}: {response.text}"
                )
                return False

        except Exception as e:
            self.log_test(3, "Get Organization", False, f"Error: {e}")
            return False

    def test_04_update_organization(self):
        """Test: PUT /api/organizations/{id}"""
        if not self.test_org_id:
            self.log_test(4, "Update Organization", False, "No test org ID")
            return False

        try:
            update_data = {
                "description": "Updated description from test suite",
                "settings": {"test_mode": True}
            }

            response = self.make_request(
                "PUT",
                f"/api/organizations/{self.test_org_id}",
                update_data
            )

            if response.status_code == 200:
                self.log_test(4, "Update Organization", True, "Organization updated")
                return True
            else:
                self.log_test(
                    4,
                    "Update Organization",
                    False,
                    f"HTTP {response.status_code}: {response.text}"
                )
                return False

        except Exception as e:
            self.log_test(4, "Update Organization", False, f"Error: {e}")
            return False

    def test_05_list_members(self):
        """Test: GET /api/organizations/{id}/members"""
        if not self.test_org_id:
            self.log_test(5, "List Members", False, "No test org ID")
            return False

        try:
            response = self.make_request("GET", f"/api/organizations/{self.test_org_id}/members")

            if response.status_code == 200:
                data = response.json()
                member_count = len(data) if isinstance(data, list) else 0
                self.log_test(
                    5,
                    "List Members",
                    True,
                    f"Found {member_count} member(s)"
                )
                return True
            else:
                self.log_test(
                    5,
                    "List Members",
                    False,
                    f"HTTP {response.status_code}: {response.text}"
                )
                return False

        except Exception as e:
            self.log_test(5, "List Members", False, f"Error: {e}")
            return False

    def test_06_list_roles(self):
        """Test: GET /api/organizations/{id}/roles"""
        if not self.test_org_id:
            self.log_test(6, "List Roles", False, "No test org ID")
            return False

        try:
            response = self.make_request("GET", f"/api/organizations/{self.test_org_id}/roles")

            if response.status_code == 200:
                data = response.json()
                role_count = len(data) if isinstance(data, list) else 0

                # Should have 5 system roles
                expected_roles = ["admin", "financial-admin", "sales-manager",
                                "procurement-manager", "logistics-manager"]
                found_roles = [r.get("slug") for r in data] if isinstance(data, list) else []

                has_all_system_roles = all(role in found_roles for role in expected_roles)

                self.log_test(
                    6,
                    "List Roles",
                    has_all_system_roles,
                    f"Found {role_count} role(s), system roles: {'✓' if has_all_system_roles else '✗'}"
                )
                return has_all_system_roles
            else:
                self.log_test(
                    6,
                    "List Roles",
                    False,
                    f"HTTP {response.status_code}: {response.text}"
                )
                return False

        except Exception as e:
            self.log_test(6, "List Roles", False, f"Error: {e}")
            return False

    def test_07_create_invitation(self):
        """Test: POST /api/organizations/{id}/invitations"""
        if not self.test_org_id:
            self.log_test(7, "Create Invitation", False, "No test org ID")
            return False

        try:
            # First get a role ID
            roles_response = self.make_request("GET", f"/api/organizations/{self.test_org_id}/roles")
            if roles_response.status_code != 200:
                self.log_test(7, "Create Invitation", False, "Failed to get roles")
                return False

            roles = roles_response.json()
            sales_role = next((r for r in roles if r.get("slug") == "sales-manager"), None)

            if not sales_role:
                self.log_test(7, "Create Invitation", False, "Sales manager role not found")
                return False

            invitation_data = {
                "email": "invited_user@example.com",
                "role_id": sales_role["id"],
                "expires_in_hours": 72
            }

            response = self.make_request(
                "POST",
                f"/api/organizations/{self.test_org_id}/invitations",
                invitation_data
            )

            if response.status_code == 200:
                data = response.json()
                self.test_invitation_id = data.get("id")
                self.test_invitation_token = data.get("token")
                self.log_test(
                    7,
                    "Create Invitation",
                    True,
                    f"Created invitation ID: {self.test_invitation_id}"
                )
                return True
            else:
                self.log_test(
                    7,
                    "Create Invitation",
                    False,
                    f"HTTP {response.status_code}: {response.text}"
                )
                return False

        except Exception as e:
            self.log_test(7, "Create Invitation", False, f"Error: {e}")
            return False

    def test_08_list_invitations(self):
        """Test: GET /api/organizations/{id}/invitations"""
        if not self.test_org_id:
            self.log_test(8, "List Invitations", False, "No test org ID")
            return False

        try:
            response = self.make_request("GET", f"/api/organizations/{self.test_org_id}/invitations")

            if response.status_code == 200:
                data = response.json()
                invitation_count = len(data) if isinstance(data, list) else 0
                self.log_test(
                    8,
                    "List Invitations",
                    True,
                    f"Found {invitation_count} invitation(s)"
                )
                return True
            else:
                self.log_test(
                    8,
                    "List Invitations",
                    False,
                    f"HTTP {response.status_code}: {response.text}"
                )
                return False

        except Exception as e:
            self.log_test(8, "List Invitations", False, f"Error: {e}")
            return False

    def test_09_cancel_invitation(self):
        """Test: DELETE /api/organizations/{id}/invitations/{invitation_id}"""
        if not self.test_org_id or not self.test_invitation_id:
            self.log_test(9, "Cancel Invitation", False, "No test org/invitation ID")
            return False

        try:
            response = self.make_request(
                "DELETE",
                f"/api/organizations/{self.test_org_id}/invitations/{self.test_invitation_id}"
            )

            if response.status_code == 200:
                self.log_test(9, "Cancel Invitation", True, "Invitation cancelled")
                return True
            else:
                self.log_test(
                    9,
                    "Cancel Invitation",
                    False,
                    f"HTTP {response.status_code}: {response.text}"
                )
                return False

        except Exception as e:
            self.log_test(9, "Cancel Invitation", False, f"Error: {e}")
            return False

    def test_10_switch_organization(self):
        """Test: POST /api/organizations/{id}/switch"""
        if not self.test_org_id:
            self.log_test(10, "Switch Organization", False, "No test org ID")
            return False

        try:
            response = self.make_request("POST", f"/api/organizations/{self.test_org_id}/switch")

            if response.status_code == 200:
                self.log_test(10, "Switch Organization", True, "Organization switched")
                return True
            else:
                self.log_test(
                    10,
                    "Switch Organization",
                    False,
                    f"HTTP {response.status_code}: {response.text}"
                )
                return False

        except Exception as e:
            self.log_test(10, "Switch Organization", False, f"Error: {e}")
            return False

    def test_11_add_member(self):
        """Test: POST /api/organizations/{id}/members"""
        if not self.test_org_id:
            self.log_test(11, "Add Member", False, "No test org ID")
            return False

        try:
            # Get a role ID
            roles_response = self.make_request("GET", f"/api/organizations/{self.test_org_id}/roles")
            if roles_response.status_code != 200:
                self.log_test(11, "Add Member", False, "Failed to get roles")
                return False

            roles = roles_response.json()
            role_id = roles[0]["id"] if roles else None

            if not role_id:
                self.log_test(11, "Add Member", False, "No role available")
                return False

            member_data = {
                "email": "nonexistent@example.com",
                "role_id": role_id
            }

            response = self.make_request(
                "POST",
                f"/api/organizations/{self.test_org_id}/members",
                member_data
            )

            # Expected to fail (user doesn't exist) - testing error handling
            if response.status_code == 404 or response.status_code == 400:
                self.log_test(
                    11,
                    "Add Member (Error Case)",
                    True,
                    "Correctly rejected non-existent user"
                )
                return True
            elif response.status_code == 200:
                self.log_test(11, "Add Member (Error Case)", False, "Should have failed")
                return False
            else:
                self.log_test(
                    11,
                    "Add Member (Error Case)",
                    False,
                    f"HTTP {response.status_code}: {response.text}"
                )
                return False

        except Exception as e:
            self.log_test(11, "Add Member", False, f"Error: {e}")
            return False

    def test_12_update_member_role(self):
        """Test: PUT /api/organizations/{id}/members/{user_id}"""
        # This would require a second user - testing error case
        if not self.test_org_id:
            self.log_test(12, "Update Member Role", False, "No test org ID")
            return False

        try:
            fake_user_id = "00000000-0000-0000-0000-000000000000"

            # Get a role ID
            roles_response = self.make_request("GET", f"/api/organizations/{self.test_org_id}/roles")
            roles = roles_response.json() if roles_response.status_code == 200 else []
            role_id = roles[0]["id"] if roles else None

            if not role_id:
                self.log_test(12, "Update Member Role (Error Case)", False, "No role available")
                return False

            response = self.make_request(
                "PUT",
                f"/api/organizations/{self.test_org_id}/members/{fake_user_id}",
                {"role_id": role_id}
            )

            # Should fail (member not found)
            if response.status_code in [404, 403]:
                self.log_test(
                    12,
                    "Update Member Role (Error Case)",
                    True,
                    "Correctly rejected non-existent member"
                )
                return True
            else:
                self.log_test(
                    12,
                    "Update Member Role (Error Case)",
                    False,
                    f"HTTP {response.status_code}"
                )
                return False

        except Exception as e:
            self.log_test(12, "Update Member Role", False, f"Error: {e}")
            return False

    def test_13_remove_member(self):
        """Test: DELETE /api/organizations/{id}/members/{user_id}"""
        # Testing error case
        if not self.test_org_id:
            self.log_test(13, "Remove Member", False, "No test org ID")
            return False

        try:
            fake_user_id = "00000000-0000-0000-0000-000000000000"

            response = self.make_request(
                "DELETE",
                f"/api/organizations/{self.test_org_id}/members/{fake_user_id}"
            )

            # Should fail (member not found)
            if response.status_code in [404, 403]:
                self.log_test(
                    13,
                    "Remove Member (Error Case)",
                    True,
                    "Correctly rejected non-existent member"
                )
                return True
            else:
                self.log_test(
                    13,
                    "Remove Member (Error Case)",
                    False,
                    f"HTTP {response.status_code}"
                )
                return False

        except Exception as e:
            self.log_test(13, "Remove Member", False, f"Error: {e}")
            return False

    def test_14_accept_invitation(self):
        """Test: POST /api/organizations/invitations/{token}/accept"""
        # Would require a different user - testing error case
        try:
            fake_token = "00000000-0000-0000-0000-000000000000"

            response = self.make_request(
                "POST",
                f"/api/organizations/invitations/{fake_token}/accept"
            )

            # Should fail (invitation not found or expired)
            if response.status_code in [404, 400, 403]:
                self.log_test(
                    14,
                    "Accept Invitation (Error Case)",
                    True,
                    "Correctly rejected invalid token"
                )
                return True
            else:
                self.log_test(
                    14,
                    "Accept Invitation (Error Case)",
                    False,
                    f"HTTP {response.status_code}"
                )
                return False

        except Exception as e:
            self.log_test(14, "Accept Invitation", False, f"Error: {e}")
            return False

    def test_15_delete_organization(self):
        """Test: DELETE /api/organizations/{id}"""
        if not self.test_org_id:
            self.log_test(15, "Delete Organization", False, "No test org ID")
            return False

        try:
            response = self.make_request("DELETE", f"/api/organizations/{self.test_org_id}")

            if response.status_code == 200:
                self.log_test(15, "Delete Organization", True, "Organization deleted")
                return True
            else:
                self.log_test(
                    15,
                    "Delete Organization",
                    False,
                    f"HTTP {response.status_code}: {response.text}"
                )
                return False

        except Exception as e:
            self.log_test(15, "Delete Organization", False, f"Error: {e}")
            return False

    def run_all_tests(self):
        """Run all tests in sequence"""
        print(f"\n{BLUE}{'='*60}{RESET}")
        print(f"{BLUE}🧪 Organization API Testing Suite{RESET}")
        print(f"{BLUE}{'='*60}{RESET}")

        # Check if server is running
        try:
            response = requests.get(f"{API_URL}/api/health", timeout=5)
            # Accept both healthy (200) and unhealthy (503) - server is responding
            if response.status_code not in [200, 503]:
                print(f"\n{RED}✗ API server not responding (HTTP {response.status_code}){RESET}")
                return False

            if response.status_code == 503:
                print(f"{YELLOW}⚠ API server is running (database disconnected - WSL2 issue){RESET}")
            else:
                print(f"{GREEN}✓ API server is running{RESET}")
        except requests.exceptions.RequestException:
            print(f"\n{RED}✗ Cannot connect to API server at {API_URL}{RESET}")
            print(f"{YELLOW}  Make sure the backend is running: python main.py{RESET}")
            return False

        # Setup
        if not self.setup_authentication():
            print(f"{YELLOW}⚠ Continuing without authentication (some tests may fail){RESET}")

        print(f"\n{BLUE}Running tests...{RESET}\n")

        # Run all tests
        self.test_01_create_organization()
        self.test_02_list_organizations()
        self.test_03_get_organization()
        self.test_04_update_organization()
        self.test_05_list_members()
        self.test_06_list_roles()
        self.test_07_create_invitation()
        self.test_08_list_invitations()
        self.test_09_cancel_invitation()
        self.test_10_switch_organization()
        self.test_11_add_member()
        self.test_12_update_member_role()
        self.test_13_remove_member()
        self.test_14_accept_invitation()
        self.test_15_delete_organization()

        # Summary
        passed = sum(self.test_results)
        total = len(self.test_results)

        print(f"\n{BLUE}{'='*60}{RESET}")
        print(f"{BLUE}Test Summary{RESET}")
        print(f"{BLUE}{'='*60}{RESET}")

        if passed == total:
            print(f"{GREEN}✅ All tests passed: {passed}/{total}{RESET}")
        else:
            print(f"{YELLOW}⚠ Tests passed: {passed}/{total}{RESET}")
            print(f"{RED}   Tests failed: {total - passed}{RESET}")

        print(f"{BLUE}{'='*60}{RESET}\n")

        return passed == total


if __name__ == "__main__":
    tester = OrganizationAPITester()
    success = tester.run_all_tests()
    exit(0 if success else 1)
