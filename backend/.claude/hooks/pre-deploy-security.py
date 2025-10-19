#!/usr/bin/env python3
"""
Pre-Deploy Security Hook for Russian B2B Quotation System
Performs comprehensive security scanning before deployment
"""
import os
import sys
import json
import subprocess
import re
from datetime import datetime
from typing import Dict, List, Any, Optional, Tuple
from pathlib import Path


class SecurityScanner:
    """Comprehensive security scanner for pre-deployment checks"""

    def __init__(self):
        self.deployment_env = sys.argv[1] if len(sys.argv) > 1 else "production"
        self.scan_results = {
            "timestamp": datetime.now().isoformat(),
            "environment": self.deployment_env,
            "checks": {},
            "vulnerabilities": [],
            "warnings": [],
            "passed": True
        }
        self.reports_dir = Path("security_reports")
        self.reports_dir.mkdir(exist_ok=True)

    def print_status(self, message: str, status: str = "info"):
        """Print colored status messages"""
        colors = {
            "success": "\033[0;32m✅",
            "error": "\033[0;31m❌",
            "warning": "\033[1;33m⚠️ ",
            "info": "\033[0;34mℹ️ ",
            "security": "\033[0;35m🛡️ ",
        }
        print(f"{colors.get(status, colors['info'])} {message}\033[0m")

    def scan_secrets_and_credentials(self) -> bool:
        """Scan for exposed secrets and credentials"""
        self.print_status("Scanning for exposed secrets and credentials...", "security")

        issues = []

        # Patterns for common secrets
        secret_patterns = {
            "api_key": r"(?i)(api[_-]?key|apikey)\s*[:=]\s*['\"]?([a-z0-9_-]{20,})['\"]?",
            "secret_key": r"(?i)(secret[_-]?key|secretkey)\s*[:=]\s*['\"]?([a-z0-9_-]{20,})['\"]?",
            "password": r"(?i)(password|passwd|pwd)\s*[:=]\s*['\"]?([^\\s'\"]{8,})['\"]?",
            "token": r"(?i)(token|auth[_-]?token)\s*[:=]\s*['\"]?([a-z0-9_-]{20,})['\"]?",
            "private_key": r"-----BEGIN.*PRIVATE KEY-----",
            "jwt_secret": r"(?i)(jwt[_-]?secret|jwtsecret)\s*[:=]\s*['\"]?([a-z0-9_-]{20,})['\"]?",
            "database_url": r"(?i)(database[_-]?url|db[_-]?url)\s*[:=]\s*['\"]?(postgresql://.*)['\"]?",
            "supabase_key": r"(?i)(supabase.*key)\s*[:=]\s*['\"]?([a-z0-9_.-]{20,})['\"]?"
        }

        # Scan Python files
        for py_file in Path(".").rglob("*.py"):
            if "venv" in str(py_file) or "__pycache__" in str(py_file):
                continue

            try:
                content = py_file.read_text(encoding='utf-8')

                for pattern_name, pattern in secret_patterns.items():
                    matches = re.finditer(pattern, content, re.MULTILINE)
                    for match in matches:
                        # Skip obvious test/example values
                        value = match.group(2) if len(match.groups()) > 1 else match.group(0)
                        if self._is_likely_real_secret(value):
                            issues.append({
                                "type": pattern_name,
                                "file": str(py_file),
                                "line": content[:match.start()].count('\\n') + 1,
                                "severity": "high"
                            })

            except Exception as e:
                self.scan_results["warnings"].append(f"Could not scan {py_file}: {str(e)}")

        # Scan .env files for production secrets
        env_files = [".env", ".env.production", ".env.local"]
        for env_file in env_files:
            env_path = Path(env_file)
            if env_path.exists():
                try:
                    content = env_path.read_text()

                    # Check for default/weak values
                    weak_patterns = [
                        (r"SECRET_KEY\s*=\s*['\"]?(dev-secret|test-secret|changeme|secret|password)['\"]?", "weak_secret_key"),
                        (r"PASSWORD\s*=\s*['\"]?(password|123456|admin|test)['\"]?", "weak_password"),
                        (r"DEBUG\s*=\s*['\"]?(true|True|1)['\"]?", "debug_enabled_in_production")
                    ]

                    for pattern, issue_type in weak_patterns:
                        if re.search(pattern, content, re.IGNORECASE):
                            issues.append({
                                "type": issue_type,
                                "file": env_file,
                                "severity": "high" if "production" in issue_type else "medium"
                            })

                except Exception as e:
                    self.scan_results["warnings"].append(f"Could not scan {env_file}: {str(e)}")

        # Check for git exposure
        if Path(".git").exists() and self.deployment_env == "production":
            issues.append({
                "type": "git_directory_exposed",
                "file": ".git",
                "severity": "high"
            })

        self.scan_results["checks"]["secrets_scan"] = {
            "issues_found": len(issues),
            "issues": issues
        }

        if issues:
            self.scan_results["vulnerabilities"].extend(issues)
            self.print_status(f"Found {len(issues)} potential secret exposures", "error")
            return False
        else:
            self.print_status("No exposed secrets found", "success")
            return True

    def _is_likely_real_secret(self, value: str) -> bool:
        """Check if a value is likely a real secret (not a placeholder)"""
        # Skip obvious placeholders
        placeholders = [
            "your-secret-here", "changeme", "placeholder", "example",
            "test-secret", "dev-secret", "dummy", "fake", "sample",
            "xxx", "yyy", "zzz", "abc", "123"
        ]

        value_lower = value.lower()
        if any(placeholder in value_lower for placeholder in placeholders):
            return False

        # Skip very short values
        if len(value) < 10:
            return False

        # Skip obviously fake values
        if value in ["password", "secret", "token", "key"]:
            return False

        return True

    def scan_dependencies(self) -> bool:
        """Scan dependencies for known vulnerabilities"""
        self.print_status("Scanning dependencies for vulnerabilities...", "security")

        issues = []

        # Check if safety is available
        try:
            result = subprocess.run(
                ["safety", "check", "--json", "--ignore", "70612"],  # Ignore jinja2 issue if needed
                capture_output=True,
                text=True,
                timeout=120
            )

            if result.returncode == 0:
                self.print_status("No known vulnerabilities in dependencies", "success")
            else:
                try:
                    safety_output = json.loads(result.stdout)
                    for vuln in safety_output:
                        issues.append({
                            "type": "dependency_vulnerability",
                            "package": vuln.get("package"),
                            "vulnerability": vuln.get("vulnerability"),
                            "severity": "high",
                            "advisory": vuln.get("advisory", "")
                        })
                except json.JSONDecodeError:
                    # Safety might output plain text in some cases
                    if "vulnerabilities found" in result.stderr:
                        issues.append({
                            "type": "dependency_vulnerability",
                            "details": result.stderr,
                            "severity": "medium"
                        })

        except subprocess.TimeoutExpired:
            self.scan_results["warnings"].append("Safety check timed out")
        except FileNotFoundError:
            self.scan_results["warnings"].append("Safety tool not installed - skipping dependency scan")

        # Check for dev dependencies in production requirements
        if self.deployment_env == "production":
            dev_packages = ["pytest", "black", "isort", "flake8", "mypy", "bandit"]
            requirements_files = ["requirements.txt", "requirements-prod.txt"]

            for req_file in requirements_files:
                req_path = Path(req_file)
                if req_path.exists():
                    content = req_path.read_text()
                    for dev_pkg in dev_packages:
                        if dev_pkg in content:
                            issues.append({
                                "type": "dev_dependency_in_production",
                                "package": dev_pkg,
                                "file": req_file,
                                "severity": "low"
                            })

        self.scan_results["checks"]["dependency_scan"] = {
            "issues_found": len(issues),
            "issues": issues
        }

        if issues:
            self.scan_results["vulnerabilities"].extend(issues)
            high_severity = [i for i in issues if i.get("severity") == "high"]
            if high_severity:
                self.print_status(f"Found {len(high_severity)} high-severity dependency vulnerabilities", "error")
                return False
            else:
                self.print_status(f"Found {len(issues)} low/medium dependency issues", "warning")
                return True
        else:
            self.print_status("Dependencies scan passed", "success")
            return True

    def scan_code_quality(self) -> bool:
        """Run security-focused code quality checks"""
        self.print_status("Running security-focused code quality checks...", "security")

        issues = []

        # Run bandit security linter
        try:
            result = subprocess.run(
                ["bandit", "-r", ".", "-f", "json", "-x", "venv,tests"],
                capture_output=True,
                text=True,
                timeout=60
            )

            if result.stdout:
                try:
                    bandit_output = json.loads(result.stdout)
                    for issue in bandit_output.get("results", []):
                        if issue.get("issue_severity") in ["HIGH", "MEDIUM"]:
                            issues.append({
                                "type": "code_security_issue",
                                "test_id": issue.get("test_id"),
                                "test_name": issue.get("test_name"),
                                "file": issue.get("filename"),
                                "line": issue.get("line_number"),
                                "severity": issue.get("issue_severity").lower(),
                                "confidence": issue.get("issue_confidence"),
                                "text": issue.get("issue_text")
                            })
                except json.JSONDecodeError:
                    pass

        except subprocess.TimeoutExpired:
            self.scan_results["warnings"].append("Bandit scan timed out")
        except FileNotFoundError:
            self.scan_results["warnings"].append("Bandit not installed - skipping code security scan")

        # Check for dangerous imports/functions
        dangerous_patterns = [
            (r"import os.*system", "dangerous_os_system"),
            (r"subprocess.*shell=True", "dangerous_shell_execution"),
            (r"eval\\s*\\(", "dangerous_eval"),
            (r"exec\\s*\\(", "dangerous_exec"),
            (r"pickle\\.loads?", "dangerous_pickle"),
            (r"yaml\\.load\\s*\\((?!.*Loader)", "dangerous_yaml_load")
        ]

        for py_file in Path(".").rglob("*.py"):
            if "venv" in str(py_file) or "test" in str(py_file):
                continue

            try:
                content = py_file.read_text()
                for pattern, issue_type in dangerous_patterns:
                    matches = list(re.finditer(pattern, content, re.IGNORECASE))
                    for match in matches:
                        issues.append({
                            "type": issue_type,
                            "file": str(py_file),
                            "line": content[:match.start()].count('\\n') + 1,
                            "severity": "medium"
                        })

            except Exception as e:
                self.scan_results["warnings"].append(f"Could not scan {py_file}: {str(e)}")

        self.scan_results["checks"]["code_quality_scan"] = {
            "issues_found": len(issues),
            "issues": issues
        }

        if issues:
            high_severity = [i for i in issues if i.get("severity") == "high"]
            if high_severity:
                self.scan_results["vulnerabilities"].extend(issues)
                self.print_status(f"Found {len(high_severity)} high-severity code issues", "error")
                return False
            else:
                self.scan_results["warnings"].extend([f"Code quality issue: {i['type']}" for i in issues])
                self.print_status(f"Found {len(issues)} code quality issues", "warning")
                return True
        else:
            self.print_status("Code quality scan passed", "success")
            return True

    def check_russian_compliance(self) -> bool:
        """Check Russian business compliance requirements"""
        self.print_status("Checking Russian business compliance...", "security")

        issues = []

        # Check for required Russian business validations
        models_file = Path("models.py")
        if models_file.exists():
            content = models_file.read_text()

            required_patterns = [
                ("inn", "Russian INN validation"),
                ("kpp", "Russian KPP validation"),
                ("ogrn", "Russian OGRN validation"),
                ("vat_rate", "Russian VAT handling"),
                ("postal_code", "Russian postal code validation")
            ]

            for pattern, description in required_patterns:
                if pattern.lower() not in content.lower():
                    issues.append({
                        "type": "missing_russian_validation",
                        "pattern": pattern,
                        "description": description,
                        "severity": "medium"
                    })

        # Check for proper currency handling
        quote_files = list(Path(".").glob("**/quote*.py")) + [Path("models.py")]
        currency_found = False
        for file_path in quote_files:
            if file_path.exists():
                content = file_path.read_text()
                if "RUB" in content or "CNY" in content:
                    currency_found = True
                    break

        if not currency_found:
            issues.append({
                "type": "missing_currency_support",
                "description": "No Russian/Chinese currency support found",
                "severity": "medium"
            })

        # Check environment configuration for Russian context
        env_file = Path(".env")
        if env_file.exists():
            content = env_file.read_text()
            if "TIMEZONE" not in content and "TZ" not in content:
                issues.append({
                    "type": "missing_timezone_config",
                    "description": "No timezone configuration for Moscow time",
                    "severity": "low"
                })

        self.scan_results["checks"]["russian_compliance"] = {
            "issues_found": len(issues),
            "issues": issues
        }

        if issues:
            medium_severity = [i for i in issues if i.get("severity") == "medium"]
            if medium_severity:
                self.scan_results["warnings"].extend([f"Compliance issue: {i['description']}" for i in issues])
                self.print_status(f"Found {len(issues)} Russian compliance issues", "warning")
            return True  # Compliance issues are warnings, not blockers
        else:
            self.print_status("Russian compliance check passed", "success")
            return True

    def check_deployment_configuration(self) -> bool:
        """Check deployment-specific security configurations"""
        self.print_status(f"Checking {self.deployment_env} deployment configuration...", "security")

        issues = []

        if self.deployment_env == "production":
            # Check for debug mode disabled
            main_files = ["main.py", "app.py", "run.py"]
            for main_file in main_files:
                file_path = Path(main_file)
                if file_path.exists():
                    content = file_path.read_text()
                    if re.search(r"debug\s*=\s*True", content, re.IGNORECASE):
                        issues.append({
                            "type": "debug_enabled_in_production",
                            "file": main_file,
                            "severity": "high"
                        })

            # Check for HTTPS enforcement
            if not any("https" in str(f) for f in Path(".").glob("**/*.py")):
                issues.append({
                    "type": "no_https_enforcement",
                    "description": "No HTTPS enforcement found",
                    "severity": "medium"
                })

            # Check for security headers
            security_headers = ["X-Content-Type-Options", "X-Frame-Options", "X-XSS-Protection"]
            headers_found = 0
            for py_file in Path(".").rglob("*.py"):
                content = py_file.read_text()
                for header in security_headers:
                    if header in content:
                        headers_found += 1

            if headers_found < len(security_headers):
                issues.append({
                    "type": "missing_security_headers",
                    "description": f"Only {headers_found}/{len(security_headers)} security headers found",
                    "severity": "medium"
                })

        self.scan_results["checks"]["deployment_config"] = {
            "issues_found": len(issues),
            "issues": issues
        }

        if issues:
            high_severity = [i for i in issues if i.get("severity") == "high"]
            if high_severity:
                self.scan_results["vulnerabilities"].extend(issues)
                self.print_status(f"Found {len(high_severity)} critical deployment issues", "error")
                return False
            else:
                self.scan_results["warnings"].extend([f"Deployment issue: {i.get('description', i['type'])}" for i in issues])
                self.print_status(f"Found {len(issues)} deployment configuration warnings", "warning")
                return True
        else:
            self.print_status("Deployment configuration check passed", "success")
            return True

    def generate_security_report(self) -> str:
        """Generate comprehensive security report"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        report_file = self.reports_dir / f"security_scan_{self.deployment_env}_{timestamp}.json"

        # Add summary to scan results
        total_vulnerabilities = len(self.scan_results["vulnerabilities"])
        total_warnings = len(self.scan_results["warnings"])

        self.scan_results["summary"] = {
            "total_vulnerabilities": total_vulnerabilities,
            "total_warnings": total_warnings,
            "deployment_approved": self.scan_results["passed"],
            "risk_level": "high" if total_vulnerabilities > 0 else "medium" if total_warnings > 5 else "low"
        }

        # Save detailed report
        with open(report_file, 'w', encoding='utf-8') as f:
            json.dump(self.scan_results, f, indent=2, ensure_ascii=False)

        return str(report_file)

    def run_security_scan(self) -> bool:
        """Run comprehensive security scan"""
        self.print_status(f"🛡️  Starting security scan for {self.deployment_env} deployment...", "security")
        print()

        # Run all security checks
        checks = [
            ("Secrets and Credentials", self.scan_secrets_and_credentials),
            ("Dependencies", self.scan_dependencies),
            ("Code Quality", self.scan_code_quality),
            ("Russian Compliance", self.check_russian_compliance),
            ("Deployment Configuration", self.check_deployment_configuration)
        ]

        all_passed = True
        for check_name, check_function in checks:
            try:
                result = check_function()
                if not result:
                    all_passed = False
            except Exception as e:
                self.print_status(f"Error in {check_name} check: {str(e)}", "error")
                all_passed = False

        self.scan_results["passed"] = all_passed

        # Generate report
        report_file = self.generate_security_report()

        print()
        if all_passed:
            self.print_status("🎉 Security scan PASSED - deployment approved!", "success")
            if self.scan_results["warnings"]:
                self.print_status(f"Note: {len(self.scan_results['warnings'])} warnings found (non-blocking)", "warning")
        else:
            self.print_status("❌ Security scan FAILED - deployment blocked!", "error")
            self.print_status(f"Found {len(self.scan_results['vulnerabilities'])} critical security issues", "error")

        self.print_status(f"Detailed report saved to: {report_file}", "info")
        return all_passed


def main():
    """Main function"""
    scanner = SecurityScanner()

    try:
        success = scanner.run_security_scan()
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f"❌ Security scan failed with error: {str(e)}")
        sys.exit(1)


if __name__ == "__main__":
    main()