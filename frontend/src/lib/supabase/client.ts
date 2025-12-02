import { createClient as createSupabaseClient, SupabaseClient } from '@supabase/supabase-js';

// Singleton client - created once in browser
let _supabase: SupabaseClient | null = null;
let _initialized = false;

// Helper to get session data from cookie (set by middleware)
function getSessionFromCookie(): { access_token: string; refresh_token: string } | null {
  if (typeof document === 'undefined') return null;

  const cookieName = 'sb-wstwwmiihkzlgvlymlfd-auth-token';
  const cookies = document.cookie.split(';');

  for (const cookie of cookies) {
    const trimmed = cookie.trim();
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    const name = trimmed.substring(0, eqIndex);
    const value = trimmed.substring(eqIndex + 1);

    if (name === cookieName) {
      try {
        const decoded = decodeURIComponent(value);
        // Handle base64 prefix from SSR middleware
        const jsonStr = decoded.startsWith('base64-') ? atob(decoded.slice(7)) : decoded;
        const data = JSON.parse(jsonStr);
        return {
          access_token: data.access_token,
          refresh_token: data.refresh_token,
        };
      } catch {
        return null;
      }
    }
  }
  return null;
}

// Create a new client instance (internal use only)
function _createNewClient(): SupabaseClient {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    }
  );
}

// SINGLETON: Always returns the same client instance
// This is called by all services - MUST be singleton to avoid multiple GoTrueClient
export function createClient(): SupabaseClient {
  if (typeof window === 'undefined') {
    // During SSR, create fresh instances (they don't persist anyway)
    return _createNewClient();
  }

  // Browser: always return singleton
  if (!_supabase) {
    _supabase = _createNewClient();

    // Initialize session from cookie if available (only once)
    if (!_initialized) {
      _initialized = true;
      const sessionData = getSessionFromCookie();
      if (sessionData) {
        _supabase.auth
          .setSession({
            access_token: sessionData.access_token,
            refresh_token: sessionData.refresh_token,
          })
          .then(() => {
            console.log('[Supabase] Session initialized from cookie');
          })
          .catch((err) => {
            console.error('[Supabase] Error setting session:', err);
          });
      }
    }
  }

  return _supabase;
}

// Alias for backward compatibility
export const getSupabase = createClient;

// Database types for TypeScript support - Multi-Industry Platform
export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string;
          name: string;
          industry:
            | 'b2b_import'
            | 'ecommerce'
            | 'manufacturing'
            | 'distribution'
            | 'services'
            | 'custom';
          country: string;
          settings: Record<string, unknown>; // JSON field for OrganizationSettings
          subscription_tier: 'free' | 'basic' | 'professional' | 'enterprise';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          industry:
            | 'b2b_import'
            | 'ecommerce'
            | 'manufacturing'
            | 'distribution'
            | 'services'
            | 'custom';
          country: string;
          settings?: Record<string, unknown>;
          subscription_tier?: 'free' | 'basic' | 'professional' | 'enterprise';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          industry?:
            | 'b2b_import'
            | 'ecommerce'
            | 'manufacturing'
            | 'distribution'
            | 'services'
            | 'custom';
          country?: string;
          settings?: Record<string, unknown>;
          subscription_tier?: 'free' | 'basic' | 'professional' | 'enterprise';
          created_at?: string;
          updated_at?: string;
        };
      };
      users: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          avatar_url: string | null;
          role: string; // Flexible role system
          organization_id: string;
          specialization_brands: string[] | null;
          industry_expertise: string[] | null;
          custom_permissions: string[] | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          full_name?: string | null;
          avatar_url?: string | null;
          role: string;
          organization_id: string;
          specialization_brands?: string[] | null;
          industry_expertise?: string[] | null;
          custom_permissions?: string[] | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          avatar_url?: string | null;
          role?: string;
          organization_id?: string;
          specialization_brands?: string[] | null;
          industry_expertise?: string[] | null;
          custom_permissions?: string[] | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      customers: {
        Row: {
          id: string;
          organization_id: string;
          company_name: string;
          contact_person: string;
          email: string;
          phone: string | null;
          inn: string | null;
          kpp: string | null;
          ogrn: string | null;
          address: string;
          industry: string | null;
          custom_fields: Record<string, unknown> | null; // JSON field for flexible customer data
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          company_name: string;
          contact_person: string;
          email: string;
          phone?: string | null;
          inn?: string | null;
          kpp?: string | null;
          ogrn?: string | null;
          address: string;
          industry?: string | null;
          custom_fields?: Record<string, unknown> | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          company_name?: string;
          contact_person?: string;
          email?: string;
          phone?: string | null;
          inn?: string | null;
          kpp?: string | null;
          ogrn?: string | null;
          address?: string;
          industry?: string | null;
          custom_fields?: Record<string, unknown> | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      workflow_templates: {
        Row: {
          id: string;
          name: string;
          description: string;
          industry: string;
          steps: Record<string, unknown>; // JSON field for WorkflowStep[]
          is_default: boolean;
          organization_id: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description: string;
          industry: string;
          steps: Record<string, unknown>;
          is_default?: boolean;
          organization_id?: string | null;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string;
          industry?: string;
          steps?: Record<string, unknown>;
          is_default?: boolean;
          organization_id?: string | null;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      formula_templates: {
        Row: {
          id: string;
          name: string;
          description: string;
          industry: string;
          formula: string;
          variables: Record<string, unknown>; // JSON field for FormulaVariable[]
          example_calculation: Record<string, unknown>; // JSON field for ExampleCalculation
          is_default: boolean;
          organization_id: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description: string;
          industry: string;
          formula: string;
          variables: Record<string, unknown>;
          example_calculation: Record<string, unknown>;
          is_default?: boolean;
          organization_id?: string | null;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string;
          industry?: string;
          formula?: string;
          variables?: Record<string, unknown>;
          example_calculation?: Record<string, unknown>;
          is_default?: boolean;
          organization_id?: string | null;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      quotes: {
        Row: {
          id: string;
          quote_number: string;
          organization_id: string;
          customer_id: string;
          created_by: string;
          status: string; // Flexible status system
          industry: string;
          currency: string;
          subtotal: number;
          vat_rate: number;
          vat_amount: number;
          total: number;
          current_step: string;
          workflow_template_id: string;
          formula_template_id: string;
          calculation_variables: Record<string, unknown> | null; // JSON field
          price_breakdown: Record<string, unknown> | null; // JSON field
          valid_until: string;
          notes: string | null;
          tags: string[] | null;
          priority: 'low' | 'medium' | 'high' | 'urgent';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          quote_number: string;
          organization_id: string;
          customer_id: string;
          created_by: string;
          status?: string;
          industry: string;
          currency: string;
          subtotal?: number;
          vat_rate?: number;
          vat_amount?: number;
          total?: number;
          current_step?: string;
          workflow_template_id: string;
          formula_template_id: string;
          calculation_variables?: Record<string, unknown> | null;
          price_breakdown?: Record<string, unknown> | null;
          valid_until: string;
          notes?: string | null;
          tags?: string[] | null;
          priority?: 'low' | 'medium' | 'high' | 'urgent';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          quote_number?: string;
          organization_id?: string;
          customer_id?: string;
          created_by?: string;
          status?: string;
          industry?: string;
          currency?: string;
          subtotal?: number;
          vat_rate?: number;
          vat_amount?: number;
          total?: number;
          current_step?: string;
          workflow_template_id?: string;
          formula_template_id?: string;
          calculation_variables?: Record<string, unknown> | null;
          price_breakdown?: Record<string, unknown> | null;
          valid_until?: string;
          notes?: string | null;
          tags?: string[] | null;
          priority?: 'low' | 'medium' | 'high' | 'urgent';
          created_at?: string;
          updated_at?: string;
        };
      };
      quote_items: {
        Row: {
          id: string;
          quote_id: string;
          name: string;
          description: string | null;
          quantity: number;
          base_price: number | null;
          final_price: number | null;
          custom_fields: Record<string, unknown> | null; // JSON field for industry-specific data
          role_inputs: Record<string, unknown> | null; // JSON field for RoleInput
          calculation_inputs: Record<string, unknown> | null; // JSON field
          price_calculation: Record<string, unknown> | null; // JSON field for ItemPriceCalculation
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          quote_id: string;
          name: string;
          description?: string | null;
          quantity: number;
          base_price?: number | null;
          final_price?: number | null;
          custom_fields?: Record<string, unknown> | null;
          role_inputs?: Record<string, unknown> | null;
          calculation_inputs?: Record<string, unknown> | null;
          price_calculation?: Record<string, unknown> | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          quote_id?: string;
          name?: string;
          description?: string | null;
          quantity?: number;
          base_price?: number | null;
          final_price?: number | null;
          custom_fields?: Record<string, unknown> | null;
          role_inputs?: Record<string, unknown> | null;
          calculation_inputs?: Record<string, unknown> | null;
          price_calculation?: Record<string, unknown> | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      role_assignments: {
        Row: {
          id: string;
          quote_id: string;
          role: string;
          assigned_to: string | null;
          assigned_by: string;
          status: 'pending' | 'in_progress' | 'completed';
          due_date: string | null;
          brand_filter: string[] | null;
          assigned_at: string;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          quote_id: string;
          role: string;
          assigned_to?: string | null;
          assigned_by: string;
          status?: 'pending' | 'in_progress' | 'completed';
          due_date?: string | null;
          brand_filter?: string[] | null;
          assigned_at?: string;
          completed_at?: string | null;
        };
        Update: {
          id?: string;
          quote_id?: string;
          role?: string;
          assigned_to?: string | null;
          assigned_by?: string;
          status?: 'pending' | 'in_progress' | 'completed';
          due_date?: string | null;
          brand_filter?: string[] | null;
          assigned_at?: string;
          completed_at?: string | null;
        };
      };
      file_uploads: {
        Row: {
          id: string;
          filename: string;
          file_size: number;
          file_type: string;
          uploaded_by: string;
          uploaded_at: string;
          quote_id: string | null;
          role: string | null;
          processing_status: 'pending' | 'processing' | 'completed' | 'failed';
          processing_result: Record<string, unknown> | null; // JSON field
          url: string;
        };
        Insert: {
          id?: string;
          filename: string;
          file_size: number;
          file_type: string;
          uploaded_by: string;
          uploaded_at?: string;
          quote_id?: string | null;
          role?: string | null;
          processing_status?: 'pending' | 'processing' | 'completed' | 'failed';
          processing_result?: Record<string, unknown> | null;
          url: string;
        };
        Update: {
          id?: string;
          filename?: string;
          file_size?: number;
          file_type?: string;
          uploaded_by?: string;
          uploaded_at?: string;
          quote_id?: string | null;
          role?: string | null;
          processing_status?: 'pending' | 'processing' | 'completed' | 'failed';
          processing_result?: Record<string, unknown> | null;
          url?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
  };
}
