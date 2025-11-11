import openpyxl
from dataclasses import dataclass
from typing import Dict, List, Optional

@dataclass
class QuoteData:
    """Parsed quote data from Excel"""
    filename: str
    sheet_name: str
    inputs: Dict
    expected_results: Dict

class ExcelQuoteParser:
    """Parse quotes from Excel files with formula-based layout"""

    def __init__(self, filepath: str):
        self.filepath = filepath
        self.workbook = openpyxl.load_workbook(filepath, data_only=True)
        self.sheet = self._find_calculation_sheet()

    def _find_calculation_sheet(self):
        """Find calculation sheet with 3-level fallback"""
        # Strategy 1: Try exact name "Расчет"
        if "Расчет" in self.workbook.sheetnames:
            sheet = self.workbook["Расчет"]
            if self._validate_sheet_structure(sheet):
                return sheet

        # Strategy 2: Try similar names
        similar_names = ["расчет", "Расчёт", "расчёт", "Calculation", "calc"]
        for name in self.workbook.sheetnames:
            if any(similar in name.lower() for similar in similar_names):
                sheet = self.workbook[name]
                if self._validate_sheet_structure(sheet):
                    return sheet

        # Strategy 3: Search all sheets for markers
        for sheet in self.workbook.worksheets:
            if self._validate_sheet_structure(sheet):
                return sheet

        # Fail with clear error
        available = ", ".join(self.workbook.sheetnames)
        raise ValueError(
            f"Cannot find calculation sheet in {self.filepath}.\n"
            f"Available sheets: {available}\n"
            f"Expected sheet with cells D5, E16, K16"
        )

    def _validate_sheet_structure(self, sheet) -> bool:
        """Check if sheet has expected structure"""
        try:
            # Check E16 is number (quantity)
            e16 = sheet["E16"].value
            if e16 and isinstance(e16, (int, float)) and e16 > 0:
                # Check K16 is number (price)
                k16 = sheet["K16"].value
                if k16 and isinstance(k16, (int, float)) and k16 > 0:
                    return True
            return False
        except Exception:
            return False
