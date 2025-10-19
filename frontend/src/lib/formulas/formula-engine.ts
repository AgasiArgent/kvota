/**
 * Formula Engine for Multi-Industry Quotation Platform
 * Flexible calculation system supporting custom formulas and variables
 */

import { FormulaTemplate, FormulaVariable, RoleInput } from '@/lib/types/platform';

// ============================================================================
// FORMULA EVALUATION TYPES
// ============================================================================

export interface FormulaContext {
  variables: Record<string, number>;
  roleInputs: Record<string, RoleInput>;
  systemConfig: Record<string, number>;
  userInputs: Record<string, number>;
  itemData: Record<string, unknown>;
}

export interface CalculationResult {
  success: boolean;
  result?: number;
  breakdown: CalculationStep[];
  errors: string[];
  variables_used: Record<string, number>;
  formula_applied: string;
}

export interface CalculationStep {
  step: number;
  description: string;
  formula: string;
  inputs: Record<string, number>;
  result: number;
}

export interface VariableResolution {
  name: string;
  value: number;
  source: string;
  path?: string;
  resolved: boolean;
  error?: string;
}

// ============================================================================
// FORMULA ENGINE CLASS
// ============================================================================

type MathFunction =
  | ((...args: number[]) => number)
  | ((condition: boolean, trueValue: number, falseValue: number) => number)
  | ((a: number, b: number) => boolean);

export class FormulaEngine {
  private mathFunctions: Record<string, MathFunction>;

  constructor() {
    this.mathFunctions = {
      // Basic math functions
      abs: Math.abs,
      ceil: Math.ceil,
      floor: Math.floor,
      round: Math.round,
      min: Math.min,
      max: Math.max,
      pow: Math.pow,
      sqrt: Math.sqrt,

      // Business-specific functions
      percentage: (value: number, percent: number) => value * (percent / 100),
      markup: (cost: number, markup_percent: number) => cost * (1 + markup_percent / 100),
      discount: (price: number, discount_percent: number) => price * (1 - discount_percent / 100),
      vat: (amount: number, vat_rate: number) => amount * (vat_rate / 100),
      total_with_vat: (amount: number, vat_rate: number) => amount * (1 + vat_rate / 100),

      // Currency and rounding
      currency_round: (amount: number, decimals: number = 2) =>
        Math.round(amount * Math.pow(10, decimals)) / Math.pow(10, decimals),

      // Conditional functions
      if: (condition: boolean, true_value: number, false_value: number) =>
        condition ? true_value : false_value,
      greater: (a: number, b: number) => a > b,
      less: (a: number, b: number) => a < b,
      equals: (a: number, b: number) => Math.abs(a - b) < 0.001, // Handle floating point precision
    };
  }

  // ============================================================================
  // MAIN CALCULATION METHOD
  // ============================================================================

  /**
   * Calculate price using formula template and context
   */
  async calculatePrice(
    formulaTemplate: FormulaTemplate,
    context: FormulaContext
  ): Promise<CalculationResult> {
    try {
      // Step 1: Resolve all variables
      const variableResolutions = await this.resolveVariables(formulaTemplate.variables, context);

      // Check for any unresolved variables
      const unresolvedVars = variableResolutions.filter((v) => !v.resolved);
      if (unresolvedVars.length > 0) {
        return {
          success: false,
          breakdown: [],
          errors: unresolvedVars.map((v) => `Cannot resolve variable '${v.name}': ${v.error}`),
          variables_used: {},
          formula_applied: formulaTemplate.formula,
        };
      }

      // Step 2: Create variable map for formula execution
      const variables: Record<string, number> = {};
      variableResolutions.forEach((v) => {
        variables[v.name] = v.value;
      });

      // Step 3: Execute the formula
      const result = this.evaluateFormula(formulaTemplate.formula, variables);

      // Step 4: Generate calculation breakdown
      const breakdown = this.generateBreakdown(formulaTemplate, variables, result);

      return {
        success: true,
        result,
        breakdown,
        errors: [],
        variables_used: variables,
        formula_applied: formulaTemplate.formula,
      };
    } catch (error) {
      return {
        success: false,
        breakdown: [],
        errors: [error instanceof Error ? error.message : 'Unknown calculation error'],
        variables_used: {},
        formula_applied: formulaTemplate.formula,
      };
    }
  }

  // ============================================================================
  // VARIABLE RESOLUTION
  // ============================================================================

  /**
   * Resolve all variables from their sources
   */
  private async resolveVariables(
    variables: FormulaVariable[],
    context: FormulaContext
  ): Promise<VariableResolution[]> {
    const resolutions: VariableResolution[] = [];

    for (const variable of variables) {
      const resolution = await this.resolveVariable(variable, context);
      resolutions.push(resolution);
    }

    return resolutions;
  }

  /**
   * Resolve a single variable from its source
   */
  private async resolveVariable(
    variable: FormulaVariable,
    context: FormulaContext
  ): Promise<VariableResolution> {
    try {
      let value: number;
      let source: string;
      let path: string | undefined;

      switch (variable.source) {
        case 'user_input':
          value = context.userInputs[variable.name];
          source = 'User Input';
          if (value === undefined && variable.default_value !== undefined) {
            value = variable.default_value;
            source = 'Default Value';
          }
          break;

        case 'role_input':
          if (!variable.source_path) {
            throw new Error(`Role input variable '${variable.name}' missing source_path`);
          }

          const pathResult = this.extractValueFromPath(variable.source_path, context.roleInputs);
          value = pathResult.value;
          source = `Role Input (${pathResult.role})`;
          path = variable.source_path;
          break;

        case 'system_config':
          value = context.systemConfig[variable.name];
          source = 'System Configuration';
          if (value === undefined && variable.default_value !== undefined) {
            value = variable.default_value;
            source = 'System Default';
          }
          break;

        case 'external_api':
          // Placeholder for external API calls
          value = await this.fetchExternalValue(variable.name);
          source = 'External API';
          path = variable.source_path;
          break;

        default:
          throw new Error(`Unknown variable source: ${variable.source}`);
      }

      // Validate the resolved value
      if (value === undefined || value === null || isNaN(value)) {
        throw new Error(`Value is undefined, null, or not a number`);
      }

      // Apply validation if specified
      if (variable.validation) {
        this.validateVariableValue(value, variable);
      }

      return {
        name: variable.name,
        value,
        source,
        path,
        resolved: true,
      };
    } catch (error) {
      return {
        name: variable.name,
        value: 0,
        source: 'Error',
        resolved: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Extract value from role input using dot notation path
   */
  private extractValueFromPath(
    path: string,
    roleInputs: Record<string, RoleInput>
  ): { value: number; role: string } {
    // Path format: "role_name.field_name" or "role_name.nested.field"
    const pathParts = path.split('.');
    if (pathParts.length < 2) {
      throw new Error(`Invalid path format: ${path}`);
    }

    const roleName = pathParts[0];
    const fieldPath = pathParts.slice(1);

    const roleInput = roleInputs[roleName];
    if (!roleInput) {
      throw new Error(`No input found for role: ${roleName}`);
    }

    if (roleInput.status !== 'completed') {
      throw new Error(`Role input not completed: ${roleName} (status: ${roleInput.status})`);
    }

    // Navigate through nested object path
    let value: unknown = roleInput.data;
    for (const part of fieldPath) {
      if (value && typeof value === 'object' && part in value) {
        value = (value as Record<string, unknown>)[part];
      } else {
        throw new Error(`Field not found: ${fieldPath.join('.')} in role ${roleName}`);
      }
    }

    if (typeof value !== 'number') {
      const numValue = Number(value);
      if (isNaN(numValue)) {
        throw new Error(`Value is not a number: ${value}`);
      }
      value = numValue;
    }

    return { value: value as number, role: roleName };
  }

  /**
   * Validate variable value against its constraints
   */
  private validateVariableValue(value: number, variable: FormulaVariable): void {
    if (!variable.validation) return;

    if (variable.validation.min !== undefined && value < variable.validation.min) {
      throw new Error(`Value ${value} is below minimum ${variable.validation.min}`);
    }

    if (variable.validation.max !== undefined && value > variable.validation.max) {
      throw new Error(`Value ${value} is above maximum ${variable.validation.max}`);
    }
  }

  /**
   * Fetch value from external API (placeholder)
   */
  private async fetchExternalValue(variableName: string): Promise<number> {
    // This would integrate with external APIs like currency rates, commodity prices, etc.
    // For now, return a placeholder value
    throw new Error(`External API integration not implemented for variable: ${variableName}`);
  }

  // ============================================================================
  // FORMULA EVALUATION
  // ============================================================================

  /**
   * Evaluate formula string with variables
   */
  private evaluateFormula(formula: string, variables: Record<string, number>): number {
    // Replace variables in formula
    let processedFormula = formula;

    Object.entries(variables).forEach(([name, value]) => {
      const regex = new RegExp(`\\b${name}\\b`, 'g');
      processedFormula = processedFormula.replace(regex, value.toString());
    });

    // Add math functions to evaluation context
    const evalContext = {
      ...this.mathFunctions,
      ...variables,
    };

    try {
      // Use Function constructor for safer evaluation than eval
      const evalFunc = new Function(...Object.keys(evalContext), `return ${processedFormula}`) as (
        ...args: unknown[]
      ) => number;
      const result = evalFunc(...Object.values(evalContext));

      if (typeof result !== 'number' || isNaN(result)) {
        throw new Error('Formula evaluation did not return a valid number');
      }

      return result;
    } catch (error) {
      throw new Error(
        `Formula evaluation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  // ============================================================================
  // CALCULATION BREAKDOWN
  // ============================================================================

  /**
   * Generate step-by-step calculation breakdown
   */
  private generateBreakdown(
    formulaTemplate: FormulaTemplate,
    variables: Record<string, number>,
    finalResult: number
  ): CalculationStep[] {
    const steps: CalculationStep[] = [];

    // Step 1: List all variables
    const variableEntries = Object.entries(variables);
    if (variableEntries.length > 0) {
      steps.push({
        step: 1,
        description: 'Variables',
        formula: variableEntries.map(([name, value]) => `${name} = ${value}`).join(', '),
        inputs: variables,
        result: 0,
      });
    }

    // Step 2: Show formula substitution
    let substitutedFormula = formulaTemplate.formula;
    Object.entries(variables).forEach(([name, value]) => {
      substitutedFormula = substitutedFormula.replace(
        new RegExp(`\\b${name}\\b`, 'g'),
        value.toString()
      );
    });

    steps.push({
      step: steps.length + 1,
      description: 'Formula Application',
      formula: `${formulaTemplate.formula} = ${substitutedFormula}`,
      inputs: variables,
      result: finalResult,
    });

    // Step 3: Show final result
    steps.push({
      step: steps.length + 1,
      description: 'Final Result',
      formula: `Result = ${finalResult}`,
      inputs: {},
      result: finalResult,
    });

    return steps;
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Validate formula syntax
   */
  validateFormula(
    formula: string,
    variables: FormulaVariable[]
  ): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    try {
      // Check for required variables in formula
      const variableNames = variables.map((v) => v.name);
      const formulaVars = this.extractVariablesFromFormula(formula);

      const missingVars = formulaVars.filter(
        (v) => !variableNames.includes(v) && !this.mathFunctions[v]
      );
      if (missingVars.length > 0) {
        errors.push(`Undefined variables in formula: ${missingVars.join(', ')}`);
      }

      // Test formula with sample values
      const testVariables: Record<string, number> = {};
      variableNames.forEach((name) => {
        testVariables[name] = 1; // Use 1 as test value
      });

      this.evaluateFormula(formula, testVariables);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Unknown validation error');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Extract variable names from formula string
   */
  private extractVariablesFromFormula(formula: string): string[] {
    const variablePattern = /\b[a-zA-Z_][a-zA-Z0-9_]*\b/g;
    const matches = formula.match(variablePattern) || [];
    return [...new Set(matches)]; // Remove duplicates
  }

  /**
   * Get example calculation for a formula template
   */
  getExampleCalculation(formulaTemplate: FormulaTemplate): CalculationResult {
    if (!formulaTemplate.example_calculation) {
      return {
        success: false,
        breakdown: [],
        errors: ['No example calculation provided'],
        variables_used: {},
        formula_applied: formulaTemplate.formula,
      };
    }

    try {
      const result = this.evaluateFormula(
        formulaTemplate.formula,
        formulaTemplate.example_calculation.inputs
      );

      const breakdown = this.generateBreakdown(
        formulaTemplate,
        formulaTemplate.example_calculation.inputs,
        result
      );

      return {
        success: true,
        result,
        breakdown,
        errors: [],
        variables_used: formulaTemplate.example_calculation.inputs,
        formula_applied: formulaTemplate.formula,
      };
    } catch (error) {
      return {
        success: false,
        breakdown: [],
        errors: [error instanceof Error ? error.message : 'Example calculation failed'],
        variables_used: {},
        formula_applied: formulaTemplate.formula,
      };
    }
  }
}

// ============================================================================
// FORMULA BUILDER HELPERS
// ============================================================================

export interface FormulaBuilderNode {
  type: 'variable' | 'operator' | 'function' | 'number';
  value: string | number;
  children?: FormulaBuilderNode[];
}

export class FormulaBuilder {
  private nodes: FormulaBuilderNode[] = [];

  addVariable(name: string): FormulaBuilder {
    this.nodes.push({ type: 'variable', value: name });
    return this;
  }

  addNumber(value: number): FormulaBuilder {
    this.nodes.push({ type: 'number', value });
    return this;
  }

  addOperator(operator: '+' | '-' | '*' | '/' | '(' | ')'): FormulaBuilder {
    this.nodes.push({ type: 'operator', value: operator });
    return this;
  }

  addFunction(name: string, ...args: (string | number)[]): FormulaBuilder {
    this.nodes.push({
      type: 'function',
      value: name,
      children: args.map((arg) => ({
        type: typeof arg === 'string' ? 'variable' : 'number',
        value: arg,
      })),
    });
    return this;
  }

  build(): string {
    return this.nodes
      .map((node) => {
        if (node.type === 'function' && node.children) {
          const args = node.children.map((child) => child.value).join(', ');
          return `${node.value}(${args})`;
        }
        return node.value.toString();
      })
      .join(' ');
  }

  clear(): FormulaBuilder {
    this.nodes = [];
    return this;
  }
}

// ============================================================================
// FORMULA ENGINE SINGLETON
// ============================================================================

export const formulaEngine = new FormulaEngine();
