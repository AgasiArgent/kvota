/**
 * Russian Business Validation Utilities
 * Validates INN, KPP, and OGRN numbers according to Russian business standards
 */

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Validates Russian INN (Individual Taxpayer Number)
 * Supports both 10-digit (organizations) and 12-digit (individuals) formats
 */
export function validateINN(inn: string): ValidationResult {
  if (!inn) {
    return { isValid: false, error: 'ИНН не может быть пустым' };
  }

  // Remove spaces and non-numeric characters
  const cleanINN = inn.replace(/\D/g, '');

  if (cleanINN.length === 10) {
    return validateINN10(cleanINN);
  } else if (cleanINN.length === 12) {
    return validateINN12(cleanINN);
  }

  return {
    isValid: false,
    error: 'ИНН должен содержать 10 цифр (для организаций) или 12 цифр (для ИП)',
  };
}

/**
 * Validates 10-digit INN for organizations
 */
function validateINN10(inn: string): ValidationResult {
  const weights = [2, 4, 10, 3, 5, 9, 4, 6, 8];

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(inn[i]) * weights[i];
  }

  const checkDigit = sum % 11;
  const expectedCheckDigit = checkDigit < 10 ? checkDigit : 0;

  if (parseInt(inn[9]) !== expectedCheckDigit) {
    return { isValid: false, error: 'Неверная контрольная сумма ИНН' };
  }

  return { isValid: true };
}

/**
 * Validates 12-digit INN for individuals
 */
function validateINN12(inn: string): ValidationResult {
  // First check digit
  const weights1 = [7, 2, 4, 10, 3, 5, 9, 4, 6, 8];
  let sum1 = 0;
  for (let i = 0; i < 10; i++) {
    sum1 += parseInt(inn[i]) * weights1[i];
  }
  const checkDigit1 = sum1 % 11;
  const expectedCheckDigit1 = checkDigit1 < 10 ? checkDigit1 : 0;

  if (parseInt(inn[10]) !== expectedCheckDigit1) {
    return { isValid: false, error: 'Неверная первая контрольная сумма ИНН' };
  }

  // Second check digit
  const weights2 = [3, 7, 2, 4, 10, 3, 5, 9, 4, 6, 8];
  let sum2 = 0;
  for (let i = 0; i < 11; i++) {
    sum2 += parseInt(inn[i]) * weights2[i];
  }
  const checkDigit2 = sum2 % 11;
  const expectedCheckDigit2 = checkDigit2 < 10 ? checkDigit2 : 0;

  if (parseInt(inn[11]) !== expectedCheckDigit2) {
    return { isValid: false, error: 'Неверная вторая контрольная сумма ИНН' };
  }

  return { isValid: true };
}

/**
 * Validates Russian KPP (Tax Registration Reason Code)
 * 9-digit code for organizations only
 */
export function validateKPP(kpp: string): ValidationResult {
  if (!kpp) {
    return { isValid: false, error: 'КПП не может быть пустым' };
  }

  // Remove spaces and non-alphanumeric characters
  const cleanKPP = kpp.replace(/[^0-9A-Za-z]/g, '').toUpperCase();

  if (cleanKPP.length !== 9) {
    return { isValid: false, error: 'КПП должен содержать 9 символов' };
  }

  // First 4 characters should be digits (tax office code)
  const taxOfficeCode = cleanKPP.substring(0, 4);
  if (!/^\d{4}$/.test(taxOfficeCode)) {
    return { isValid: false, error: 'Первые 4 символа КПП должны быть цифрами' };
  }

  // Next 2 characters should be alphanumeric (reason code)
  const reasonCode = cleanKPP.substring(4, 6);
  if (!/^[0-9A-Z]{2}$/.test(reasonCode)) {
    return { isValid: false, error: 'Символы 5-6 КПП должны быть цифрами или буквами' };
  }

  // Last 3 characters should be digits (record number)
  const recordNumber = cleanKPP.substring(6, 9);
  if (!/^\d{3}$/.test(recordNumber)) {
    return { isValid: false, error: 'Последние 3 символа КПП должны быть цифрами' };
  }

  return { isValid: true };
}

/**
 * Validates Russian OGRN (Primary State Registration Number)
 * 13 digits for organizations, 15 digits for entrepreneurs (OGRNIP)
 */
export function validateOGRN(ogrn: string): ValidationResult {
  if (!ogrn) {
    return { isValid: false, error: 'ОГРН не может быть пустым' };
  }

  // Remove spaces and non-numeric characters
  const cleanOGRN = ogrn.replace(/\D/g, '');

  if (cleanOGRN.length === 13) {
    return validateOGRN13(cleanOGRN);
  } else if (cleanOGRN.length === 15) {
    return validateOGRNIP15(cleanOGRN);
  }

  return {
    isValid: false,
    error: 'ОГРН должен содержать 13 цифр (для организаций) или 15 цифр (для ИП)',
  };
}

/**
 * Validates 13-digit OGRN for organizations
 */
function validateOGRN13(ogrn: string): ValidationResult {
  const firstTwelveDigits = ogrn.substring(0, 12);
  const checkDigit = parseInt(ogrn[12]);

  const remainder = BigInt(firstTwelveDigits) % BigInt(11);
  const expectedCheckDigit = Number(remainder % BigInt(10));

  if (checkDigit !== expectedCheckDigit) {
    return { isValid: false, error: 'Неверная контрольная сумма ОГРН' };
  }

  return { isValid: true };
}

/**
 * Validates 15-digit OGRNIP for entrepreneurs
 */
function validateOGRNIP15(ogrnip: string): ValidationResult {
  const firstFourteenDigits = ogrnip.substring(0, 14);
  const checkDigit = parseInt(ogrnip[14]);

  const remainder = BigInt(firstFourteenDigits) % BigInt(13);
  const expectedCheckDigit = Number(remainder % BigInt(10));

  if (checkDigit !== expectedCheckDigit) {
    return { isValid: false, error: 'Неверная контрольная сумма ОГРНИП' };
  }

  return { isValid: true };
}

/**
 * Validates complete Russian business entity data
 */
export interface BusinessEntityData {
  inn: string;
  kpp?: string; // Optional for individuals
  ogrn: string;
  companyName: string;
}

export function validateBusinessEntity(data: BusinessEntityData): ValidationResult {
  // Validate INN
  const innResult = validateINN(data.inn);
  if (!innResult.isValid) {
    return innResult;
  }

  // Validate OGRN
  const ogrnResult = validateOGRN(data.ogrn);
  if (!ogrnResult.isValid) {
    return ogrnResult;
  }

  // For organizations (10-digit INN), KPP is required
  const cleanINN = data.inn.replace(/\D/g, '');
  if (cleanINN.length === 10) {
    if (!data.kpp) {
      return { isValid: false, error: 'КПП обязателен для организаций' };
    }

    const kppResult = validateKPP(data.kpp);
    if (!kppResult.isValid) {
      return kppResult;
    }
  }

  // Validate company name
  if (!data.companyName || data.companyName.trim().length < 2) {
    return { isValid: false, error: 'Название организации должно содержать минимум 2 символа' };
  }

  return { isValid: true };
}

/**
 * Formats INN with appropriate spacing
 */
export function formatINN(inn: string): string {
  const cleanINN = inn.replace(/\D/g, '');

  if (cleanINN.length === 10) {
    // Format as XXXX XXXXXX for organizations
    return cleanINN.replace(/(\d{4})(\d{6})/, '$1 $2');
  } else if (cleanINN.length === 12) {
    // Format as XXXX XXXX XXXX for individuals
    return cleanINN.replace(/(\d{4})(\d{4})(\d{4})/, '$1 $2 $3');
  }

  return cleanINN;
}

/**
 * Formats KPP with appropriate spacing
 */
export function formatKPP(kpp: string): string {
  const cleanKPP = kpp.replace(/[^0-9A-Za-z]/g, '').toUpperCase();

  if (cleanKPP.length === 9) {
    // Format as XXXX XX XXX
    return cleanKPP.replace(/(\d{4})([0-9A-Z]{2})(\d{3})/, '$1 $2 $3');
  }

  return cleanKPP;
}

/**
 * Formats OGRN with appropriate spacing
 */
export function formatOGRN(ogrn: string): string {
  const cleanOGRN = ogrn.replace(/\D/g, '');

  if (cleanOGRN.length === 13) {
    // Format as X XX XX XXXXXXX for organizations
    return cleanOGRN.replace(/(\d{1})(\d{2})(\d{2})(\d{7})(\d{1})/, '$1 $2 $3 $4 $5');
  } else if (cleanOGRN.length === 15) {
    // Format as X XX XX XXXXXXXXX for entrepreneurs
    return cleanOGRN.replace(/(\d{1})(\d{2})(\d{2})(\d{9})(\d{1})/, '$1 $2 $3 $4 $5');
  }

  return cleanOGRN;
}

/**
 * Determines if INN belongs to an organization or individual
 */
export function getINNType(inn: string): 'organization' | 'individual' | 'invalid' {
  const cleanINN = inn.replace(/\D/g, '');

  if (cleanINN.length === 10) {
    return 'organization';
  } else if (cleanINN.length === 12) {
    return 'individual';
  }

  return 'invalid';
}

/**
 * VAT validation for Russian business
 */
export function validateVATRate(vatRate: number): ValidationResult {
  const validRates = [0, 10, 20]; // Valid VAT rates in Russia

  if (!validRates.includes(vatRate)) {
    return {
      isValid: false,
      error: 'Недопустимая ставка НДС. Разрешенные значения: 0%, 10%, 20%',
    };
  }

  return { isValid: true };
}

/**
 * Currency validation for Russian business
 */
export function validateCurrency(currency: string): ValidationResult {
  const validCurrencies = ['RUB', 'CNY', 'USD', 'EUR']; // Supported currencies

  if (!validCurrencies.includes(currency.toUpperCase())) {
    return {
      isValid: false,
      error: 'Недопустимая валюта. Поддерживаемые валюты: RUB, CNY, USD, EUR',
    };
  }

  return { isValid: true };
}
