/**
 * Customer Contracts Type Definitions
 * For specification export feature (TASK-005)
 */

// ============================================================================
// CONTRACT TYPES
// ============================================================================

export type ContractStatus = 'active' | 'expired' | 'terminated';

export interface Contract {
  id: string;
  customer_id: string;
  organization_id: string;
  contract_number: string;
  contract_date: string;
  status: ContractStatus;
  next_specification_number: number;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface ContractCreate {
  customer_id: string;
  contract_number: string;
  contract_date: string;
  notes?: string;
}

export interface ContractUpdate {
  contract_number?: string;
  contract_date?: string;
  status?: ContractStatus;
  notes?: string;
}

// Backend returns direct array from list endpoint
export type ContractListResponse = Contract[];

// ============================================================================
// WAREHOUSE ADDRESS TYPES
// ============================================================================

export interface WarehouseAddress {
  name: string;
  address: string;
}

// ============================================================================
// SPECIFICATION EXPORT TYPES
// ============================================================================

export interface SpecificationExportRequest {
  contract_id: string;
  // Either warehouse_index (legacy) or delivery_address_id (new) should be provided
  warehouse_index?: number;
  delivery_address_id?: string;
  signatory_contact_id?: string;
  additional_conditions?: string;
}

export interface SpecificationExportResponse {
  file_url: string;
  file_name: string;
  specification_number: string;
}

// ============================================================================
// CUSTOMER EXTENDED TYPES (for specification export)
// ============================================================================

export interface CustomerSignatory {
  general_director_name?: string;
  general_director_position?: string;
}

export interface CustomerWithSignatory {
  id: string;
  name: string;
  inn?: string;
  kpp?: string;
  address?: string;
  general_director_name?: string;
  general_director_position?: string;
  warehouse_addresses?: WarehouseAddress[];
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Format contract status for display
 */
export function formatContractStatus(status: ContractStatus): {
  label: string;
  variant: 'default' | 'secondary' | 'destructive';
} {
  const statusMap: Record<
    ContractStatus,
    { label: string; variant: 'default' | 'secondary' | 'destructive' }
  > = {
    active: { label: 'Активен', variant: 'default' },
    expired: { label: 'Истёк', variant: 'secondary' },
    terminated: { label: 'Расторгнут', variant: 'destructive' },
  };

  return statusMap[status];
}

/**
 * Format contract date for display
 */
export function formatContractDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}
