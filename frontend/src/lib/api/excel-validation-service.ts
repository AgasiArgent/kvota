/**
 * Excel Validation API Service
 * Handles validation of Excel files against calculation engine
 */

import { createClient } from '@/lib/supabase/client';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface FieldComparison {
  field: string;
  field_name: string;
  our_value: number;
  excel_value: number;
  difference: number;
  passed: boolean;
  phase: string;
}

export interface ProductComparison {
  product_index: number;
  passed: boolean;
  max_deviation: number;
  fields: FieldComparison[];
}

export interface ValidationResult {
  filename: string;
  passed: boolean;
  max_deviation?: number;
  total_products?: number;
  failed_fields?: string[];
  error?: string;
  comparisons?: ProductComparison[];
}

export interface ValidationSummary {
  total: number;
  passed: number;
  failed: number;
  pass_rate: number;
  avg_deviation: number;
  max_deviation: number;
}

export interface ValidationResponse {
  summary: ValidationSummary;
  results: ValidationResult[];
}

export const ExcelValidationService = {
  /**
   * Validate uploaded Excel files against calculation engine
   */
  async validateFiles(
    files: File[],
    mode: 'summary' | 'detailed',
    tolerance: number
  ): Promise<ValidationResponse> {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      throw new Error('Not authenticated');
    }

    const formData = new FormData();

    files.forEach((file) => {
      formData.append('files', file);
    });
    formData.append('mode', mode);
    formData.append('tolerance', tolerance.toString());

    const response = await fetch(`${API_URL}/api/admin/excel-validation/validate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to validate files');
    }

    return response.json();
  },
};
