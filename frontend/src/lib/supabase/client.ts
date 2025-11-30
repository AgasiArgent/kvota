import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          // Use document.cookie for browser-side cookie access
          // Guard against SSR where document is not available
          if (typeof document === 'undefined') {
            return null;
          }
          const cookies = document.cookie.split(';');
          for (const cookie of cookies) {
            const [cookieName, cookieValue] = cookie.trim().split('=');
            if (cookieName === name) {
              return decodeURIComponent(cookieValue);
            }
          }
          return null;
        },
        set(name: string, value: string, options: Record<string, unknown>) {
          // Set cookie with domain=.kvotaflow.ru to work on both www and non-www
          const isProd =
            typeof window !== 'undefined' &&
            (window.location.hostname === 'kvotaflow.ru' ||
              window.location.hostname === 'www.kvotaflow.ru');

          const cookieOptions: Record<string, unknown> = {
            ...options,
            domain: isProd ? '.kvotaflow.ru' : undefined, // Root domain for production
            path: '/',
            sameSite: 'lax',
          };

          let cookieString = `${name}=${encodeURIComponent(value)}`;

          if (cookieOptions.domain) {
            cookieString += `; domain=${cookieOptions.domain}`;
          }
          if (cookieOptions.path) {
            cookieString += `; path=${cookieOptions.path}`;
          }
          if (cookieOptions.maxAge) {
            cookieString += `; max-age=${cookieOptions.maxAge}`;
          }
          if (cookieOptions.sameSite) {
            cookieString += `; samesite=${cookieOptions.sameSite}`;
          }
          if (cookieOptions.secure) {
            cookieString += '; secure';
          }

          document.cookie = cookieString;
        },
        remove(name: string, options: Record<string, unknown>) {
          const isProd =
            typeof window !== 'undefined' &&
            (window.location.hostname === 'kvotaflow.ru' ||
              window.location.hostname === 'www.kvotaflow.ru');

          this.set(name, '', {
            ...options,
            domain: isProd ? '.kvotaflow.ru' : undefined,
            maxAge: 0,
          });
        },
      },
    }
  );
}

// Lazy-initialized singleton to avoid SSR issues
// createBrowserClient accesses document during construction
let _supabase: ReturnType<typeof createClient> | null = null;

export function getSupabase() {
  if (typeof window === 'undefined') {
    // During SSR, create a fresh instance (will have limited functionality)
    return createClient();
  }
  // In browser, use singleton
  if (!_supabase) {
    _supabase = createClient();
  }
  return _supabase;
}

// For backward compatibility - but prefer getSupabase()
export const supabase = typeof window !== 'undefined' ? createClient() : (null as any);

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
