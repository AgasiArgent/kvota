/**
 * User Service for B2B Import Quotation Platform
 * Manages user profile information (manager contact details)
 */

import { createClient } from '@/lib/supabase/client';
import { getApiEndpoint } from '@/lib/config';

export interface UserProfile {
  user_id: string;
  manager_name?: string;
  manager_phone?: string;
  manager_email?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export class UserService {
  /**
   * Get authorization headers with JWT token from Supabase session
   */
  private async getAuthHeaders(): Promise<HeadersInit> {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token;

    return {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    };
  }

  /**
   * Get current user profile
   */
  async getProfile(): Promise<ApiResponse<UserProfile>> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${config.apiUrl}/api/users/profile`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: response.statusText }));
        return {
          success: false,
          error:
            errorData.message || errorData.error || errorData.detail || `HTTP ${response.status}`,
        };
      }

      const data = await response.json();
      return {
        success: true,
        data,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network request failed',
      };
    }
  }

  /**
   * Update user profile
   */
  async updateProfile(profileData: Partial<UserProfile>): Promise<ApiResponse<UserProfile>> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${config.apiUrl}/api/users/profile`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(profileData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: response.statusText }));
        return {
          success: false,
          error:
            errorData.message || errorData.error || errorData.detail || `HTTP ${response.status}`,
        };
      }

      const data = await response.json();
      return {
        success: true,
        data,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network request failed',
      };
    }
  }
}

// Export singleton instance
export const userService = new UserService();
