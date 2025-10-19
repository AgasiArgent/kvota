/**
 * Ant Design Form Validation Rules for Russian Business
 * Integrates Russian business validation with Ant Design forms
 */

import { Rule } from 'antd/es/form';
import {
  validateINN,
  validateKPP,
  validateOGRN,
  validateVATRate,
  validateCurrency,
  getINNType,
} from './russian-business';

/**
 * Email validation rule
 */
export const emailRule: Rule = {
  type: 'email',
  message: 'Введите корректный email адрес',
};

/**
 * Required field validation rule
 */
export const requiredRule: Rule = {
  required: true,
  message: 'Это поле обязательно для заполнения',
};

/**
 * Phone number validation rule for Russian format
 */
export const phoneRule: Rule = {
  pattern: /^(\+7|7|8)?[\s\-]?\(?[489][0-9]{2}\)?[\s\-]?[0-9]{3}[\s\-]?[0-9]{2}[\s\-]?[0-9]{2}$/,
  message: 'Введите корректный номер телефона (+7XXXXXXXXXX)',
};

/**
 * INN validation rule
 */
export const innRule: Rule = {
  validator: (_, value) => {
    if (!value) {
      return Promise.resolve();
    }

    const result = validateINN(value);
    if (result.isValid) {
      return Promise.resolve();
    }

    return Promise.reject(new Error(result.error));
  },
};

/**
 * KPP validation rule
 */
export const kppRule: Rule = {
  validator: (_, value) => {
    if (!value) {
      return Promise.resolve();
    }

    const result = validateKPP(value);
    if (result.isValid) {
      return Promise.resolve();
    }

    return Promise.reject(new Error(result.error));
  },
};

/**
 * OGRN validation rule
 */
export const ogrnRule: Rule = {
  validator: (_, value) => {
    if (!value) {
      return Promise.resolve();
    }

    const result = validateOGRN(value);
    if (result.isValid) {
      return Promise.resolve();
    }

    return Promise.reject(new Error(result.error));
  },
};

/**
 * KPP conditional requirement rule (required for organizations)
 */
export const kppConditionalRule = (innValue: string): Rule => ({
  validator: (_, value) => {
    const innType = getINNType(innValue);

    if (innType === 'organization' && !value) {
      return Promise.reject(new Error('КПП обязателен для организаций'));
    }

    if (value) {
      const result = validateKPP(value);
      if (!result.isValid) {
        return Promise.reject(new Error(result.error));
      }
    }

    return Promise.resolve();
  },
});

/**
 * VAT rate validation rule
 */
export const vatRateRule: Rule = {
  validator: (_, value) => {
    if (value === undefined || value === null) {
      return Promise.resolve();
    }

    const result = validateVATRate(Number(value));
    if (result.isValid) {
      return Promise.resolve();
    }

    return Promise.reject(new Error(result.error));
  },
};

/**
 * Currency validation rule
 */
export const currencyRule: Rule = {
  validator: (_, value) => {
    if (!value) {
      return Promise.resolve();
    }

    const result = validateCurrency(value);
    if (result.isValid) {
      return Promise.resolve();
    }

    return Promise.reject(new Error(result.error));
  },
};

/**
 * Positive number validation rule
 */
export const positiveNumberRule: Rule = {
  validator: (_, value) => {
    if (value === undefined || value === null || value === '') {
      return Promise.resolve();
    }

    const num = Number(value);
    if (isNaN(num) || num <= 0) {
      return Promise.reject(new Error('Значение должно быть положительным числом'));
    }

    return Promise.resolve();
  },
};

/**
 * Quote amount validation rule with currency-specific limits
 */
export const quoteAmountRule = (currency: string = 'RUB'): Rule => ({
  validator: (_, value) => {
    if (value === undefined || value === null || value === '') {
      return Promise.resolve();
    }

    const num = Number(value);
    if (isNaN(num) || num <= 0) {
      return Promise.reject(new Error('Сумма должна быть положительным числом'));
    }

    // Set maximum limits based on currency
    const limits = {
      RUB: 1000000000, // 1 billion rubles
      CNY: 100000000, // 100 million yuan
      USD: 10000000, // 10 million dollars
      EUR: 10000000, // 10 million euros
    };

    const maxAmount = limits[currency as keyof typeof limits] || limits.RUB;

    if (num > maxAmount) {
      return Promise.reject(
        new Error(`Максимальная сумма для ${currency}: ${maxAmount.toLocaleString('ru-RU')}`)
      );
    }

    return Promise.resolve();
  },
});

/**
 * Company name validation rule
 */
export const companyNameRule: Rule = {
  validator: (_, value) => {
    if (!value) {
      return Promise.resolve();
    }

    const trimmedValue = value.trim();

    if (trimmedValue.length < 2) {
      return Promise.reject(new Error('Название организации должно содержать минимум 2 символа'));
    }

    if (trimmedValue.length > 200) {
      return Promise.reject(new Error('Название организации не должно превышать 200 символов'));
    }

    // Check for valid company suffixes for Russian organizations
    const validSuffixes = [
      'ООО',
      'ОАО',
      'ЗАО',
      'НАО',
      'ПАО',
      'АО',
      'ИП',
      'СПК',
      'ТСЖ',
      'НКО',
      'ГУП',
      'МУП',
      'LLC',
      'Ltd',
      'Inc',
      'Corp',
      'Co',
    ];

    const hasValidSuffix = validSuffixes.some(
      (suffix) =>
        trimmedValue.includes(suffix) || trimmedValue.toLowerCase().includes(suffix.toLowerCase())
    );

    if (!hasValidSuffix) {
      console.warn('Company name does not contain a recognized legal form suffix');
    }

    return Promise.resolve();
  },
};

/**
 * Russian address validation rule
 */
export const addressRule: Rule = {
  validator: (_, value) => {
    if (!value) {
      return Promise.resolve();
    }

    const trimmedValue = value.trim();

    if (trimmedValue.length < 10) {
      return Promise.reject(new Error('Адрес должен содержать минимум 10 символов'));
    }

    if (trimmedValue.length > 500) {
      return Promise.reject(new Error('Адрес не должен превышать 500 символов'));
    }

    // Basic check for Russian postal code pattern
    const postalCodePattern = /\b\d{6}\b/;
    if (!postalCodePattern.test(trimmedValue)) {
      console.warn('Address does not contain a valid Russian postal code (6 digits)');
    }

    return Promise.resolve();
  },
};

/**
 * Date validation rule for quote validity
 */
export const futureDateRule: Rule = {
  validator: (_, value) => {
    if (!value) {
      return Promise.resolve();
    }

    const selectedDate = new Date(value);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (selectedDate <= today) {
      return Promise.reject(new Error('Дата должна быть в будущем'));
    }

    const maxDate = new Date();
    maxDate.setFullYear(maxDate.getFullYear() + 1); // Max 1 year in future

    if (selectedDate > maxDate) {
      return Promise.reject(new Error('Дата не может быть более чем через год'));
    }

    return Promise.resolve();
  },
};

/**
 * Password strength validation rule
 */
export const passwordRule: Rule = {
  validator: (_, value) => {
    if (!value) {
      return Promise.resolve();
    }

    if (value.length < 8) {
      return Promise.reject(new Error('Пароль должен содержать минимум 8 символов'));
    }

    if (value.length > 128) {
      return Promise.reject(new Error('Пароль не должен превышать 128 символов'));
    }

    // Check for at least one number
    if (!/\d/.test(value)) {
      return Promise.reject(new Error('Пароль должен содержать хотя бы одну цифру'));
    }

    // Check for at least one letter
    if (!/[a-zA-Zа-яА-Я]/.test(value)) {
      return Promise.reject(new Error('Пароль должен содержать хотя бы одну букву'));
    }

    return Promise.resolve();
  },
};

/**
 * Confirm password validation rule
 */
export const confirmPasswordRule = (originalPassword: string): Rule => ({
  validator: (_, value) => {
    if (!value) {
      return Promise.resolve();
    }

    if (value !== originalPassword) {
      return Promise.reject(new Error('Пароли не совпадают'));
    }

    return Promise.resolve();
  },
});

/**
 * Full name validation rule
 */
export const fullNameRule: Rule = {
  validator: (_, value) => {
    if (!value) {
      return Promise.resolve();
    }

    const trimmedValue = value.trim();

    if (trimmedValue.length < 2) {
      return Promise.reject(new Error('Имя должно содержать минимум 2 символа'));
    }

    if (trimmedValue.length > 100) {
      return Promise.reject(new Error('Имя не должно превышать 100 символов'));
    }

    // Check for at least two words (first name and last name)
    const words = trimmedValue.split(/\s+/).filter((word: string) => word.length > 0);
    if (words.length < 2) {
      return Promise.reject(new Error('Введите имя и фамилию'));
    }

    // Check for valid characters (letters, spaces, hyphens)
    if (!/^[a-zA-Zа-яА-ЯёЁ\s\-]+$/.test(trimmedValue)) {
      return Promise.reject(new Error('Имя может содержать только буквы, пробелы и дефисы'));
    }

    return Promise.resolve();
  },
};

/**
 * Combines multiple validation rules
 */
export function combineRules(...rules: Rule[]): Rule[] {
  return rules;
}

/**
 * Creates rules for Russian business entity form
 */
export function createBusinessEntityRules(innValue?: string) {
  return {
    companyName: [requiredRule, companyNameRule],
    inn: [requiredRule, innRule],
    kpp: innValue ? [kppConditionalRule(innValue)] : [kppRule],
    ogrn: [requiredRule, ogrnRule],
    email: [requiredRule, emailRule],
    phone: [phoneRule],
    address: [requiredRule, addressRule],
  };
}

/**
 * Creates rules for quote form
 */
export function createQuoteRules(currency?: string) {
  return {
    customer: [requiredRule],
    currency: [requiredRule, currencyRule],
    validUntil: [requiredRule, futureDateRule],
    vatRate: [requiredRule, vatRateRule],
    amount: [requiredRule, positiveNumberRule, quoteAmountRule(currency)],
    description: [requiredRule],
  };
}
