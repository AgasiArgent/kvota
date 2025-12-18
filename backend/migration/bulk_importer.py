import asyncio
import asyncpg
import os
from typing import List, Dict
from pathlib import Path
from datetime import datetime

from excel_parser.quote_parser import ExcelQuoteParser
from migration.progress_tracker import ProgressTracker


class BulkQuoteImporter:
    """Import Excel quotes into database"""

    def __init__(
        self,
        organization_id: str,
        user_id: str,
        batch_size: int = 50,
        dry_run: bool = False
    ):
        self.organization_id = organization_id
        self.user_id = user_id
        self.batch_size = batch_size
        self.dry_run = dry_run
        self.tracker = ProgressTracker()

    async def import_files(self, file_paths: List[str]) -> Dict:
        """Import multiple Excel files"""

        total = len(file_paths)
        self.tracker.start(total)

        conn = await asyncpg.connect(os.getenv("DATABASE_URL"))

        # Set RLS context for multi-tenant security
        await conn.execute(
            "SELECT set_config('request.jwt.claims', $1, true)",
            f'{{"sub": "{self.user_id}", "role": "authenticated"}}'
        )

        try:
            results = {
                "total": total,
                "successful": 0,
                "failed": 0,
                "skipped": 0,
                "errors": []
            }

            # Process in batches
            for i in range(0, total, self.batch_size):
                batch = file_paths[i:i + self.batch_size]

                # Wrap batch in transaction (only in non-dry-run mode)
                if not self.dry_run:
                    async with conn.transaction():
                        for filepath in batch:
                            try:
                                await self._import_single_file(conn, filepath)
                                results["successful"] += 1
                                self.tracker.increment(status="✅")

                            except FileExistsError:
                                results["skipped"] += 1
                                self.tracker.increment(status="⏭️", message="Duplicate")

                            except Exception as e:
                                results["failed"] += 1
                                results["errors"].append({
                                    "file": Path(filepath).name,
                                    "error": str(e)
                                })
                                self.tracker.increment(status="❌", message=str(e))
                else:
                    # Dry-run mode - no transaction needed
                    for filepath in batch:
                        try:
                            await self._import_single_file(conn, filepath)
                            results["successful"] += 1
                            self.tracker.increment(status="✅")

                        except FileExistsError:
                            results["skipped"] += 1
                            self.tracker.increment(status="⏭️", message="Duplicate")

                        except Exception as e:
                            results["failed"] += 1
                            results["errors"].append({
                                "file": Path(filepath).name,
                                "error": str(e)
                            })
                            self.tracker.increment(status="❌", message=str(e))

                await asyncio.sleep(0.1)

            self.tracker.finish()
            return results

        finally:
            await conn.close()

    async def _import_single_file(self, conn, filepath: str):
        """Import one Excel file"""

        # Parse Excel
        parser = ExcelQuoteParser(filepath)
        excel_data = parser.parse()

        # Generate quote number
        quote_number = self._generate_quote_number(excel_data)

        # Check duplicate
        existing = await conn.fetchrow(
            "SELECT id FROM quotes WHERE organization_id = $1 AND idn_quote = $2",
            self.organization_id,
            quote_number
        )

        if existing:
            raise FileExistsError(f"Quote {quote_number} already exists")

        if self.dry_run:
            return

        # TODO(Phase 5): Parse customer info from Excel metadata
        # Currently hardcoded to "Imported Customer"
        # Create customer
        customer_id = await self._ensure_customer(conn, "Imported Customer")

        # Create quote
        quote_id = await self._create_quote(conn, excel_data, quote_number, customer_id)

        # Create products
        await self._create_products(conn, quote_id, excel_data.inputs["products"])

    def _generate_quote_number(self, excel_data) -> str:
        """Generate quote number from filename"""
        filename = Path(excel_data.filename).stem
        if filename.startswith("quote_"):
            number = filename.split("_")[1]
            return f"КП-{number}"
        return f"КП-IMP-{datetime.now().strftime('%Y%m%d%H%M%S')}"

    async def _ensure_customer(self, conn, customer_name: str) -> str:
        """Get or create customer"""
        result = await conn.fetchrow(
            "INSERT INTO customers (organization_id, name, company_type, status, created_by) "
            "VALUES ($1, $2, 'organization', 'active', $3) "
            "ON CONFLICT (organization_id, name) DO UPDATE SET name = EXCLUDED.name "
            "RETURNING id",
            self.organization_id,
            customer_name,
            self.user_id
        )
        return result["id"]

    async def _create_quote(self, conn, excel_data, quote_number: str, customer_id: str) -> str:
        """Create quote record"""
        quote_vars = excel_data.inputs["quote"]

        result = await conn.fetchrow(
            "INSERT INTO quotes (organization_id, customer_id, idn_quote, status, "
            "seller_company, created_by) VALUES ($1, $2, $3, 'draft', $4, $5) RETURNING id",
            self.organization_id,
            customer_id,
            quote_number,
            quote_vars.get("seller_company", "Unknown"),
            self.user_id
        )

        return result["id"]

    async def _create_products(self, conn, quote_id: str, products: List[Dict]):
        """Create product records"""
        # TODO(Phase 5): Parse full product fields from Excel
        # Currently only saves minimal fields (name, quantity, price)
        # Missing: SKU, brand, weight, dimensions, supplier info, etc.
        for i, product in enumerate(products):
            await conn.execute(
                "INSERT INTO quote_items (quote_id, product_name, quantity, "
                "base_price_vat, line_number) VALUES ($1, $2, $3, $4, $5)",
                quote_id,
                f"Product {i+1}",
                product.get("quantity", 1),
                product.get("base_price_VAT", 0),
                i + 1
            )
