/**
 * React Hooks for Russian Business Validation
 * Provides easy-to-use hooks for form validation and formatting
 */

import { useState, useCallback, useMemo } from 'react';
import {
  validateINN,
  validateKPP,
  validateOGRN,
  validateBusinessEntity,
  formatINN,
  formatKPP,
  formatOGRN,
  getINNType,
  BusinessEntityData,
  ValidationResult,
} from './russian-business';

/**
 * Hook for INN validation and formatting
 */
export function useINNValidation() {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  const validate = useCallback((innValue: string) => {
    const result = validateINN(innValue);
    setError(result.isValid ? null : result.error || null);
    return result.isValid;
  }, []);

  const handleChange = useCallback(
    (newValue: string) => {
      setValue(newValue);
      validate(newValue);
    },
    [validate]
  );

  const format = useCallback(() => {
    return formatINN(value);
  }, [value]);

  const type = useMemo(() => {
    return getINNType(value);
  }, [value]);

  return {
    value,
    setValue: handleChange,
    error,
    isValid: !error && value.length > 0,
    format,
    type,
    validate: () => validate(value),
  };
}

/**
 * Hook for KPP validation and formatting
 */
export function useKPPValidation() {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  const validate = useCallback((kppValue: string) => {
    if (!kppValue) {
      setError(null);
      return true;
    }

    const result = validateKPP(kppValue);
    setError(result.isValid ? null : result.error || null);
    return result.isValid;
  }, []);

  const handleChange = useCallback(
    (newValue: string) => {
      setValue(newValue);
      validate(newValue);
    },
    [validate]
  );

  const format = useCallback(() => {
    return formatKPP(value);
  }, [value]);

  return {
    value,
    setValue: handleChange,
    error,
    isValid: !error,
    format,
    validate: () => validate(value),
  };
}

/**
 * Hook for OGRN validation and formatting
 */
export function useOGRNValidation() {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  const validate = useCallback((ogrnValue: string) => {
    const result = validateOGRN(ogrnValue);
    setError(result.isValid ? null : result.error || null);
    return result.isValid;
  }, []);

  const handleChange = useCallback(
    (newValue: string) => {
      setValue(newValue);
      validate(newValue);
    },
    [validate]
  );

  const format = useCallback(() => {
    return formatOGRN(value);
  }, [value]);

  return {
    value,
    setValue: handleChange,
    error,
    isValid: !error && value.length > 0,
    format,
    validate: () => validate(value),
  };
}

/**
 * Hook for complete business entity validation
 */
export function useBusinessEntityValidation() {
  const [data, setData] = useState<Partial<BusinessEntityData>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateField = useCallback((field: keyof BusinessEntityData, value: string) => {
    let result: ValidationResult = { isValid: true };

    switch (field) {
      case 'inn':
        result = validateINN(value);
        break;
      case 'kpp':
        if (value) {
          result = validateKPP(value);
        }
        break;
      case 'ogrn':
        result = validateOGRN(value);
        break;
      case 'companyName':
        if (!value || value.trim().length < 2) {
          result = {
            isValid: false,
            error: 'Название организации должно содержать минимум 2 символа',
          };
        }
        break;
    }

    setErrors((prev) => ({
      ...prev,
      [field]: result.isValid ? '' : result.error || '',
    }));

    return result.isValid;
  }, []);

  const setValue = useCallback(
    (field: keyof BusinessEntityData, value: string) => {
      setData((prev) => ({
        ...prev,
        [field]: value,
      }));
      validateField(field, value);
    },
    [validateField]
  );

  const validateAll = useCallback(() => {
    if (!data.inn || !data.ogrn || !data.companyName) {
      return { isValid: false, error: 'Заполните все обязательные поля' };
    }

    const result = validateBusinessEntity(data as BusinessEntityData);

    if (!result.isValid) {
      // Set general error if validation fails
      setErrors((prev) => ({
        ...prev,
        general: result.error || 'Ошибка валидации',
      }));
    } else {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors.general;
        return newErrors;
      });
    }

    return result;
  }, [data]);

  const formatValues = useCallback(() => {
    return {
      inn: data.inn ? formatINN(data.inn) : '',
      kpp: data.kpp ? formatKPP(data.kpp) : '',
      ogrn: data.ogrn ? formatOGRN(data.ogrn) : '',
      companyName: data.companyName || '',
    };
  }, [data]);

  const isOrganization = useMemo(() => {
    return data.inn ? getINNType(data.inn) === 'organization' : false;
  }, [data.inn]);

  const isValid = useMemo(() => {
    const hasErrors = Object.values(errors).some((error) => error !== '');
    const hasRequiredFields = !!(data.inn && data.ogrn && data.companyName);
    return !hasErrors && hasRequiredFields;
  }, [errors, data]);

  return {
    data,
    setValue,
    errors,
    isValid,
    isOrganization,
    validateAll,
    formatValues,
  };
}

/**
 * Hook for currency formatting and validation
 */
export function useCurrencyFormatting(currency: string = 'RUB') {
  const formatAmount = useCallback(
    (amount: number) => {
      const formatOptions: Intl.NumberFormatOptions = {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      };

      try {
        return new Intl.NumberFormat('ru-RU', formatOptions).format(amount);
      } catch {
        // Fallback formatting if currency is not supported
        return `${amount.toLocaleString('ru-RU')} ${currency}`;
      }
    },
    [currency]
  );

  const parseAmount = useCallback((formattedAmount: string): number => {
    // Remove currency symbols and spaces, replace comma with dot
    const cleanAmount = formattedAmount.replace(/[^\d,.-]/g, '').replace(/,/g, '.');

    return parseFloat(cleanAmount) || 0;
  }, []);

  const validateAmount = useCallback(
    (amount: number): ValidationResult => {
      if (isNaN(amount) || amount <= 0) {
        return { isValid: false, error: 'Сумма должна быть положительным числом' };
      }

      const maxAmounts = {
        RUB: 1000000000,
        CNY: 100000000,
        USD: 10000000,
        EUR: 10000000,
      };

      const maxAmount = maxAmounts[currency as keyof typeof maxAmounts] || maxAmounts.RUB;

      if (amount > maxAmount) {
        return {
          isValid: false,
          error: `Максимальная сумма для ${currency}: ${formatAmount(maxAmount)}`,
        };
      }

      return { isValid: true };
    },
    [currency, formatAmount]
  );

  return {
    formatAmount,
    parseAmount,
    validateAmount,
  };
}

/**
 * Hook for VAT calculations
 */
export function useVATCalculations() {
  const calculateVAT = useCallback((amount: number, vatRate: number) => {
    const vatAmount = (amount * vatRate) / 100;
    const totalWithVAT = amount + vatAmount;

    return {
      subtotal: amount,
      vatRate,
      vatAmount,
      total: totalWithVAT,
    };
  }, []);

  const calculateWithoutVAT = useCallback((totalAmount: number, vatRate: number) => {
    const subtotal = totalAmount / (1 + vatRate / 100);
    const vatAmount = totalAmount - subtotal;

    return {
      subtotal,
      vatRate,
      vatAmount,
      total: totalAmount,
    };
  }, []);

  const getVATRateOptions = useCallback(() => {
    return [
      { value: 0, label: '0% (экспорт)' },
      { value: 10, label: '10% (льготная ставка)' },
      { value: 20, label: '20% (основная ставка)' },
    ];
  }, []);

  return {
    calculateVAT,
    calculateWithoutVAT,
    getVATRateOptions,
  };
}

/**
 * Hook for form submission with validation
 */
export function useValidatedForm<T extends Record<string, unknown>>(
  initialData: T,
  validationSchema: (data: T) => ValidationResult
) {
  const [data, setData] = useState<T>(initialData);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const setValue = useCallback(
    (field: keyof T, value: unknown) => {
      setData((prev) => ({
        ...prev,
        [field]: value,
      }));

      // Clear field error when value changes
      if (errors[field as string]) {
        setErrors((prev) => ({
          ...prev,
          [field as string]: '',
        }));
      }
    },
    [errors]
  );

  const validate = useCallback(() => {
    const result = validationSchema(data);

    if (!result.isValid) {
      setErrors({ general: result.error || 'Ошибка валидации' });
    } else {
      setErrors({});
    }

    return result.isValid;
  }, [data, validationSchema]);

  const submit = useCallback(
    async (onSubmit: (data: T) => Promise<void>) => {
      setIsSubmitting(true);

      try {
        if (!validate()) {
          return false;
        }

        await onSubmit(data);
        return true;
      } catch (error) {
        setErrors({
          general: error instanceof Error ? error.message : 'Произошла ошибка при отправке',
        });
        return false;
      } finally {
        setIsSubmitting(false);
      }
    },
    [data, validate]
  );

  const reset = useCallback(() => {
    setData(initialData);
    setErrors({});
    setIsSubmitting(false);
  }, [initialData]);

  return {
    data,
    setValue,
    errors,
    isSubmitting,
    validate,
    submit,
    reset,
  };
}
