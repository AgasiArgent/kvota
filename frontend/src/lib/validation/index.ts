/**
 * Russian Business Validation Utilities
 * Comprehensive validation system for Russian B2B quotation platform
 */

import {
  validateINN as _validateINN,
  validateKPP as _validateKPP,
  validateOGRN as _validateOGRN,
  validateBusinessEntity as _validateBusinessEntity,
  validateVATRate as _validateVATRate,
  validateCurrency as _validateCurrency,
  formatINN as _formatINN,
  formatKPP as _formatKPP,
  formatOGRN as _formatOGRN,
  getINNType as _getINNType,
  type ValidationResult,
  type BusinessEntityData,
} from './russian-business';

// Core validation functions
export {
  _validateINN as validateINN,
  _validateKPP as validateKPP,
  _validateOGRN as validateOGRN,
  _validateBusinessEntity as validateBusinessEntity,
  _validateVATRate as validateVATRate,
  _validateCurrency as validateCurrency,
  _formatINN as formatINN,
  _formatKPP as formatKPP,
  _formatOGRN as formatOGRN,
  _getINNType as getINNType,
  type ValidationResult,
  type BusinessEntityData,
};

// Ant Design form validation rules
export {
  emailRule,
  requiredRule,
  phoneRule,
  innRule,
  kppRule,
  ogrnRule,
  kppConditionalRule,
  vatRateRule,
  currencyRule,
  positiveNumberRule,
  quoteAmountRule,
  companyNameRule,
  addressRule,
  futureDateRule,
  passwordRule,
  confirmPasswordRule,
  fullNameRule,
  combineRules,
  createBusinessEntityRules,
  createQuoteRules,
} from './form-rules';

// React hooks for validation
export {
  useINNValidation,
  useKPPValidation,
  useOGRNValidation,
  useBusinessEntityValidation,
  useCurrencyFormatting,
  useVATCalculations,
  useValidatedForm,
} from './hooks';

// Constants and utilities
export const SUPPORTED_CURRENCIES = ['RUB', 'CNY', 'USD', 'EUR'] as const;
export const VAT_RATES = [0, 10, 20] as const;

export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];
export type VATRate = (typeof VAT_RATES)[number];

/**
 * Quick validation utility for common use cases
 */
export const quickValidate = {
  /**
   * Validates Russian business data quickly
   */
  businessEntity: (inn: string, kpp: string | undefined, ogrn: string, companyName: string) => {
    return _validateBusinessEntity({ inn, kpp, ogrn, companyName });
  },

  /**
   * Validates email format
   */
  email: (email: string): ValidationResult => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return { isValid: false, error: 'Неверный формат email' };
    }
    return { isValid: true };
  },

  /**
   * Validates Russian phone number
   */
  phone: (phone: string): ValidationResult => {
    const phoneRegex =
      /^(\+7|7|8)?[\s\-]?\(?[489][0-9]{2}\)?[\s\-]?[0-9]{3}[\s\-]?[0-9]{2}[\s\-]?[0-9]{2}$/;
    if (!phoneRegex.test(phone)) {
      return { isValid: false, error: 'Неверный формат номера телефона' };
    }
    return { isValid: true };
  },
};

/**
 * Quick formatting utility for common use cases
 */
export const quickFormat = {
  /**
   * Formats all Russian business identifiers
   */
  businessIdentifiers: (inn: string, kpp?: string, ogrn?: string) => {
    return {
      inn: _formatINN(inn),
      kpp: kpp ? _formatKPP(kpp) : undefined,
      ogrn: ogrn ? _formatOGRN(ogrn) : undefined,
    };
  },

  /**
   * Formats currency amount
   */
  currency: (amount: number, currency: SupportedCurrency = 'RUB') => {
    try {
      return new Intl.NumberFormat('ru-RU', {
        style: 'currency',
        currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(amount);
    } catch {
      return `${amount.toLocaleString('ru-RU')} ${currency}`;
    }
  },

  /**
   * Formats phone number
   */
  phone: (phone: string) => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 11 && digits.startsWith('8')) {
      return `+7 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7, 9)}-${digits.slice(9, 11)}`;
    } else if (digits.length === 11 && digits.startsWith('7')) {
      return `+${digits.slice(0, 1)} (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7, 9)}-${digits.slice(9, 11)}`;
    }
    return phone;
  },
};

/**
 * Utility to get user-friendly messages for validation errors
 */
export const getValidationMessage = (field: string, error: string): string => {
  const fieldMessages: Record<string, string> = {
    inn: 'ИНН',
    kpp: 'КПП',
    ogrn: 'ОГРН',
    companyName: 'Название организации',
    email: 'Email',
    phone: 'Телефон',
    address: 'Адрес',
    amount: 'Сумма',
    currency: 'Валюта',
    vatRate: 'Ставка НДС',
  };

  const fieldName = fieldMessages[field] || field;
  return `${fieldName}: ${error}`;
};

/**
 * Check if a field requires special formatting
 */
export const shouldFormatField = (field: string): boolean => {
  return ['inn', 'kpp', 'ogrn', 'phone'].includes(field);
};

/**
 * Apply formatting to a field value
 */
export const applyFieldFormatting = (field: string, value: string): string => {
  switch (field) {
    case 'inn':
      return _formatINN(value);
    case 'kpp':
      return _formatKPP(value);
    case 'ogrn':
      return _formatOGRN(value);
    case 'phone':
      return quickFormat.phone(value);
    default:
      return value;
  }
};
