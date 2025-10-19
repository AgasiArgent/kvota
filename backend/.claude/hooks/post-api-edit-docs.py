#!/usr/bin/env python3
"""
Post-API-Edit Documentation Hook for Russian B2B Quotation System
Automatically updates OpenAPI documentation when API routes are modified
"""
import os
import sys
import json
import asyncio
from pathlib import Path
from typing import Dict, List, Any, Optional
from datetime import datetime


class APIDocumentationGenerator:
    """Generates and updates API documentation"""

    def __init__(self):
        self.edited_file = sys.argv[1] if len(sys.argv) > 1 else None
        self.docs_dir = Path("docs")
        self.api_dir = Path("docs/api")

    def print_status(self, message: str, status: str = "info"):
        """Print colored status messages"""
        colors = {
            "success": "\033[0;32m✅",
            "error": "\033[0;31m❌",
            "warning": "\033[1;33m⚠️ ",
            "info": "\033[0;34mℹ️ ",
        }
        print(f"{colors.get(status, colors['info'])} {message}\033[0m")

    def should_update_docs(self) -> bool:
        """Check if documentation should be updated"""
        if not self.edited_file:
            return False

        # Check if the edited file is a route file
        route_indicators = [
            "routes/",
            "router",
            "@app.",
            "@router.",
            "APIRouter",
            "FastAPI"
        ]

        try:
            file_path = Path(self.edited_file)
            if not file_path.exists():
                return False

            content = file_path.read_text(encoding='utf-8')

            # Check if file contains route definitions
            for indicator in route_indicators:
                if indicator in content:
                    return True

        except Exception:
            pass

        return False

    def create_docs_structure(self):
        """Create documentation directory structure"""
        directories = [
            self.docs_dir,
            self.api_dir,
            self.docs_dir / "examples",
            self.docs_dir / "schemas"
        ]

        for directory in directories:
            directory.mkdir(exist_ok=True)

        self.print_status("Documentation directory structure created", "success")

    def extract_route_info(self, file_path: Path) -> List[Dict[str, Any]]:
        """Extract route information from Python file"""
        routes = []

        try:
            content = file_path.read_text(encoding='utf-8')

            # Simple regex patterns to extract route information
            import re

            # Pattern for @router.method() or @app.method()
            route_pattern = r'@(?:router|app)\.(get|post|put|delete|patch)\s*\(\s*["\']([^"\']+)["\']'
            matches = re.finditer(route_pattern, content, re.IGNORECASE)

            for match in matches:
                method = match.group(1).upper()
                path = match.group(2)

                # Try to find the function definition after this decorator
                start_pos = match.end()
                function_match = re.search(r'async\s+def\s+(\w+)\s*\([^)]*\):', content[start_pos:start_pos+500])

                if function_match:
                    function_name = function_match.group(1)

                    # Try to extract docstring
                    docstring_match = re.search(
                        r'"""([^"]+)"""',
                        content[start_pos:start_pos+1000]
                    )
                    description = docstring_match.group(1).strip() if docstring_match else f"{method} {path}"

                    routes.append({
                        "method": method,
                        "path": path,
                        "function": function_name,
                        "description": description,
                        "file": str(file_path)
                    })

        except Exception as e:
            self.print_status(f"Error extracting routes from {file_path}: {str(e)}", "warning")

        return routes

    def generate_openapi_spec(self) -> Dict[str, Any]:
        """Generate OpenAPI specification"""
        spec = {
            "openapi": "3.0.0",
            "info": {
                "title": "Russian B2B Quotation Platform API",
                "description": "Professional quotation system for Russian-Chinese business transactions",
                "version": "1.0.0",
                "contact": {
                    "name": "API Support",
                    "email": "api@yourcompany.ru"
                }
            },
            "servers": [
                {
                    "url": "http://localhost:8000",
                    "description": "Development server"
                }
            ],
            "paths": {},
            "components": {
                "schemas": {},
                "securitySchemes": {
                    "BearerAuth": {
                        "type": "http",
                        "scheme": "bearer",
                        "bearerFormat": "JWT"
                    }
                }
            },
            "security": [
                {"BearerAuth": []}
            ]
        }

        # Scan all Python files for routes
        route_files = []
        for pattern in ["routes/*.py", "*.py"]:
            route_files.extend(Path(".").glob(pattern))

        all_routes = []
        for file_path in route_files:
            if file_path.name != "__init__.py":
                routes = self.extract_route_info(file_path)
                all_routes.extend(routes)

        # Add routes to OpenAPI spec
        for route in all_routes:
            path = route["path"]
            method = route["method"].lower()

            if path not in spec["paths"]:
                spec["paths"][path] = {}

            spec["paths"][path][method] = {
                "summary": route["description"][:100],
                "description": route["description"],
                "tags": [self._get_tag_from_path(path)],
                "operationId": f"{method}_{route['function']}",
                "responses": {
                    "200": {
                        "description": "Successful response",
                        "content": {
                            "application/json": {
                                "schema": {"type": "object"}
                            }
                        }
                    },
                    "400": {
                        "description": "Bad request"
                    },
                    "401": {
                        "description": "Unauthorized"
                    },
                    "500": {
                        "description": "Internal server error"
                    }
                }
            }

            # Add security requirement for protected endpoints
            if not path.startswith("/api/health") and not path == "/":
                spec["paths"][path][method]["security"] = [{"BearerAuth": []}]

        return spec

    def _get_tag_from_path(self, path: str) -> str:
        """Extract tag name from API path"""
        if "/quotes" in path:
            return "Quotes"
        elif "/customers" in path:
            return "Customers"
        elif "/auth" in path:
            return "Authentication"
        elif "/users" in path:
            return "User Management"
        elif "/admin" in path:
            return "Administration"
        else:
            return "General"

    def generate_api_markdown(self, routes: List[Dict[str, Any]]) -> str:
        """Generate markdown documentation for API routes"""
        content = [
            "# Russian B2B Quotation Platform API",
            "",
            "## Overview",
            "Professional quotation system designed for Russian-Chinese business transactions.",
            "",
            "## Authentication",
            "All API endpoints (except health checks) require JWT authentication.",
            "Include the token in the Authorization header: `Bearer <token>`",
            "",
            "## Endpoints",
            ""
        ]

        # Group routes by tag
        routes_by_tag = {}
        for route in routes:
            tag = self._get_tag_from_path(route["path"])
            if tag not in routes_by_tag:
                routes_by_tag[tag] = []
            routes_by_tag[tag].append(route)

        for tag, tag_routes in routes_by_tag.items():
            content.append(f"### {tag}")
            content.append("")

            for route in sorted(tag_routes, key=lambda x: x["path"]):
                content.append(f"#### `{route['method']} {route['path']}`")
                content.append("")
                content.append(route["description"])
                content.append("")
                content.append("**Parameters:**")
                content.append("- Authentication: Required (JWT Bearer token)")
                content.append("")
                content.append("**Response:**")
                content.append("- `200 OK`: Success")
                content.append("- `400 Bad Request`: Invalid request")
                content.append("- `401 Unauthorized`: Authentication required")
                content.append("- `403 Forbidden`: Insufficient permissions")
                content.append("")

        content.append("## Russian Business Context")
        content.append("")
        content.append("This API handles Russian business requirements:")
        content.append("- **INN validation**: Russian tax identification numbers")
        content.append("- **KPP validation**: Tax registration reason codes")
        content.append("- **VAT calculations**: 20% standard Russian VAT")
        content.append("- **Multi-currency support**: RUB, CNY, USD, EUR")
        content.append("- **Import duty calculations**: For Chinese imports")
        content.append("")

        return "\\n".join(content)

    def update_documentation(self):
        """Update all documentation files"""
        if not self.should_update_docs():
            self.print_status("No API changes detected, skipping documentation update", "info")
            return

        self.print_status("Updating API documentation...", "info")

        # Create directory structure
        self.create_docs_structure()

        # Generate OpenAPI specification
        try:
            openapi_spec = self.generate_openapi_spec()

            # Save OpenAPI spec
            openapi_file = self.api_dir / "openapi.json"
            with open(openapi_file, 'w', encoding='utf-8') as f:
                json.dump(openapi_spec, f, indent=2, ensure_ascii=False)

            self.print_status(f"OpenAPI specification saved to {openapi_file}", "success")

            # Extract routes for markdown generation
            all_routes = []
            for pattern in ["routes/*.py", "*.py"]:
                for file_path in Path(".").glob(pattern):
                    if file_path.name != "__init__.py":
                        routes = self.extract_route_info(file_path)
                        all_routes.extend(routes)

            # Generate markdown documentation
            markdown_content = self.generate_api_markdown(all_routes)
            api_md_file = self.docs_dir / "API.md"
            with open(api_md_file, 'w', encoding='utf-8') as f:
                f.write(markdown_content)

            self.print_status(f"API documentation saved to {api_md_file}", "success")

            # Generate README for docs
            readme_content = f"""# API Documentation

Generated on: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

## Files

- `API.md` - Human-readable API documentation
- `api/openapi.json` - OpenAPI 3.0 specification

## Usage

The OpenAPI specification can be imported into tools like:
- Postman
- Insomnia
- Swagger UI
- Redoc

## Auto-Generation

This documentation is automatically updated when API route files are modified.
"""

            readme_file = self.docs_dir / "README.md"
            with open(readme_file, 'w', encoding='utf-8') as f:
                f.write(readme_content)

            self.print_status("Documentation generation completed successfully", "success")

        except Exception as e:
            self.print_status(f"Error generating documentation: {str(e)}", "error")
            return False

        return True


def main():
    """Main function"""
    generator = APIDocumentationGenerator()

    try:
        success = generator.update_documentation()
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f"❌ Documentation generation failed: {str(e)}")
        sys.exit(1)


if __name__ == "__main__":
    main()