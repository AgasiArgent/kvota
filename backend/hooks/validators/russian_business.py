#!/usr/bin/env python3
"""
Russian Business Validation Module
Validates INN, KPP, OGRN, and other Russian business identifiers
"""
import re
import sys
from typing import Dict, List, Tuple, Optional
from pathlib import Path


class RussianBusinessValidator:
    """Russian business validation utilities"""

    @staticmethod
    def validate_inn(inn: str) -> Tuple[bool, str]:
        """
        Validate Russian INN (Individual Tax Number)

        Args:
            inn: INN string to validate

        Returns:
            Tuple of (is_valid, error_message)
        """
        if not inn:
            return False, "INN is required"

        # Remove non-digits
        inn_clean = re.sub(r'\D', '', inn)

        # Check length (10 for organizations, 12 for individuals)
        if len(inn_clean) not in [10, 12]:
            return False, f"INN must be 10 digits (organizations) or 12 digits (individuals), got {len(inn_clean)}"

        # Validate checksum for 10-digit INN (organizations)
        if len(inn_clean) == 10:
            weights = [2, 4, 10, 3, 5, 9, 4, 6, 8]
            checksum = sum(int(inn_clean[i]) * weights[i] for i in range(9)) % 11
            if checksum > 9:
                checksum = checksum % 10

            if int(inn_clean[9]) != checksum:
                return False, "Invalid INN checksum for organization"

        # Validate checksum for 12-digit INN (individuals)
        elif len(inn_clean) == 12:
            # First checksum
            weights1 = [7, 2, 4, 10, 3, 5, 9, 4, 6, 8]
            checksum1 = sum(int(inn_clean[i]) * weights1[i] for i in range(10)) % 11
            if checksum1 > 9:
                checksum1 = checksum1 % 10

            if int(inn_clean[10]) != checksum1:
                return False, "Invalid INN checksum (first digit) for individual"

            # Second checksum
            weights2 = [3, 7, 2, 4, 10, 3, 5, 9, 4, 6, 8]
            checksum2 = sum(int(inn_clean[i]) * weights2[i] for i in range(11)) % 11
            if checksum2 > 9:
                checksum2 = checksum2 % 10

            if int(inn_clean[11]) != checksum2:
                return False, "Invalid INN checksum (second digit) for individual"

        return True, ""

    @staticmethod
    def validate_kpp(kpp: str) -> Tuple[bool, str]:
        """
        Validate Russian KPP (Tax Registration Reason Code)

        Args:
            kpp: KPP string to validate

        Returns:
            Tuple of (is_valid, error_message)
        """
        if not kpp:
            return False, "KPP is required for organizations"

        # Remove non-digits
        kpp_clean = re.sub(r'\D', '', kpp)

        # KPP must be exactly 9 digits
        if len(kpp_clean) != 9:
            return False, f"KPP must be exactly 9 digits, got {len(kpp_clean)}"

        # Basic format validation (first 4 digits - tax office code, next 2 - reason code, last 3 - sequential number)
        tax_office = kpp_clean[:4]
        reason_code = kpp_clean[4:6]

        # Tax office code should not be 0000
        if tax_office == "0000":
            return False, "Invalid tax office code in KPP"

        return True, ""

    @staticmethod
    def validate_ogrn(ogrn: str) -> Tuple[bool, str]:
        """
        Validate Russian OGRN (Primary State Registration Number)

        Args:
            ogrn: OGRN string to validate

        Returns:
            Tuple of (is_valid, error_message)
        """
        if not ogrn:
            return False, "OGRN is required"

        # Remove non-digits
        ogrn_clean = re.sub(r'\D', '', ogrn)

        # OGRN can be 13 digits (organizations) or 15 digits (individual entrepreneurs)
        if len(ogrn_clean) not in [13, 15]:
            return False, f"OGRN must be 13 digits (organizations) or 15 digits (entrepreneurs), got {len(ogrn_clean)}"

        # Validate checksum
        if len(ogrn_clean) == 13:
            # For organizations: check digit is remainder of (first 12 digits mod 11) mod 10
            first_12 = int(ogrn_clean[:12])
            check_digit = (first_12 % 11) % 10
            if int(ogrn_clean[12]) != check_digit:
                return False, "Invalid OGRN checksum for organization"

        elif len(ogrn_clean) == 15:
            # For entrepreneurs: check digit is remainder of (first 14 digits mod 13) mod 10
            first_14 = int(ogrn_clean[:14])
            check_digit = (first_14 % 13) % 10
            if int(ogrn_clean[14]) != check_digit:
                return False, "Invalid OGRN checksum for entrepreneur"

        return True, ""

    @staticmethod
    def validate_russian_postal_code(postal_code: str) -> Tuple[bool, str]:
        """
        Validate Russian postal code

        Args:
            postal_code: Postal code string to validate

        Returns:
            Tuple of (is_valid, error_message)
        """
        if not postal_code:
            return False, "Postal code is required"

        # Remove non-digits
        postal_clean = re.sub(r'\D', '', postal_code)

        # Russian postal codes are exactly 6 digits
        if len(postal_clean) != 6:
            return False, f"Russian postal code must be exactly 6 digits, got {len(postal_clean)}"

        # First digit should be 1-6 (Russian postal regions)
        if postal_clean[0] not in '123456':
            return False, "Invalid Russian postal code region"

        return True, ""


def validate_file_patterns(file_path: Path) -> List[str]:
    """
    Validate Russian business patterns in a Python file

    Args:
        file_path: Path to Python file to validate

    Returns:
        List of validation errors
    """
    errors = []

    try:
        content = file_path.read_text(encoding='utf-8')

        # Check for INN validation patterns
        inn_patterns = re.findall(r'inn["\']?\s*[:=]\s*["\']?([^"\'\\s,}]+)', content, re.IGNORECASE)
        for inn in inn_patterns:
            if inn and not inn.startswith('$') and not inn.startswith('{'):  # Skip template variables
                is_valid, error = RussianBusinessValidator.validate_inn(inn)
                if not is_valid:
                    errors.append(f"{file_path}: Invalid INN '{inn}' - {error}")

        # Check for KPP validation patterns
        kpp_patterns = re.findall(r'kpp["\']?\s*[:=]\s*["\']?([^"\'\\s,}]+)', content, re.IGNORECASE)
        for kpp in kpp_patterns:
            if kpp and not kpp.startswith('$') and not kpp.startswith('{'):
                is_valid, error = RussianBusinessValidator.validate_kpp(kpp)
                if not is_valid:
                    errors.append(f"{file_path}: Invalid KPP '{kpp}' - {error}")

        # Check for OGRN validation patterns
        ogrn_patterns = re.findall(r'ogrn["\']?\s*[:=]\s*["\']?([^"\'\\s,}]+)', content, re.IGNORECASE)
        for ogrn in ogrn_patterns:
            if ogrn and not ogrn.startswith('$') and not ogrn.startswith('{'):
                is_valid, error = RussianBusinessValidator.validate_ogrn(ogrn)
                if not is_valid:
                    errors.append(f"{file_path}: Invalid OGRN '{ogrn}' - {error}")

        # Check for postal code patterns
        postal_patterns = re.findall(r'postal_code["\']?\s*[:=]\s*["\']?([^"\'\\s,}]+)', content, re.IGNORECASE)
        for postal in postal_patterns:
            if postal and not postal.startswith('$') and not postal.startswith('{'):
                is_valid, error = RussianBusinessValidator.validate_russian_postal_code(postal)
                if not is_valid:
                    errors.append(f"{file_path}: Invalid postal code '{postal}' - {error}")

        # Check for VAT rate validation (should be reasonable for Russia)
        vat_patterns = re.findall(r'vat_rate["\']?\s*[:=]\s*["\']?([^"\'\\s,}]+)', content, re.IGNORECASE)
        for vat in vat_patterns:
            if vat and not vat.startswith('$') and not vat.startswith('{'):
                try:
                    vat_value = float(vat)
                    if vat_value < 0 or vat_value > 30:
                        errors.append(f"{file_path}: Unusual VAT rate '{vat}' - expected 0-30%")
                    elif vat_value not in [0, 10, 20]:  # Common Russian VAT rates
                        # This is a warning, not an error
                        pass
                except ValueError:
                    errors.append(f"{file_path}: Invalid VAT rate format '{vat}'")

    except Exception as e:
        errors.append(f"{file_path}: Error reading file - {str(e)}")

    return errors


def main():
    """Main validation function for command line usage"""
    if len(sys.argv) < 2:
        print("Usage: python russian_business.py <file1.py> [file2.py] ...")
        sys.exit(1)

    all_errors = []

    for file_arg in sys.argv[1:]:
        file_path = Path(file_arg)
        if file_path.exists() and file_path.suffix == '.py':
            errors = validate_file_patterns(file_path)
            all_errors.extend(errors)

    if all_errors:
        print("❌ Russian business validation errors found:")
        for error in all_errors:
            print(f"  {error}")
        sys.exit(1)
    else:
        print("✅ Russian business validation passed")
        sys.exit(0)


if __name__ == "__main__":
    main()