/**
 * Feedback API Service
 * Handles submission and retrieval of user feedback/bug reports
 */

import { createClient } from '@/lib/supabase/client';
import { config, getApiEndpoint } from '@/lib/config';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface Feedback {
  id: string;
  organization_id: string;
  user_id: string;
  page_url: string;
  description: string;
  browser_info: Record<string, any>;
  status: 'open' | 'resolved';
  created_at: string;
  updated_at: string;
  user_email?: string;
  user_full_name?: string;
}

export interface FeedbackSubmitData {
  page_url: string;
  description: string;
  browser_info: Record<string, any>;
}

export interface FeedbackListResponse {
  feedback: Feedback[];
  total: number;
  page: number;
  per_page: number;
}

export interface FeedbackStats {
  total: number;
  open: number;
  resolved: number;
}

export const FeedbackService = {
  /**
   * Submit new feedback/bug report
   */
  async submit(data: FeedbackSubmitData): Promise<Feedback> {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${config.apiUrl}/api/feedback/`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to submit feedback');
    }

    return response.json();
  },

  /**
   * List feedback with optional filters
   */
  async list(
    status?: 'open' | 'resolved',
    page: number = 1,
    perPage: number = 20
  ): Promise<FeedbackListResponse> {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      throw new Error('Not authenticated');
    }

    const params = new URLSearchParams({
      page: page.toString(),
      per_page: perPage.toString(),
    });

    if (status) {
      params.append('status_filter', status);
    }

    const response = await fetch(`${config.apiUrl}/api/feedback/?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch feedback');
    }

    return response.json();
  },

  /**
   * Mark feedback as resolved (Admin only)
   */
  async resolve(feedbackId: string): Promise<Feedback> {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${config.apiUrl}/api/feedback/${feedbackId}/resolve`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to resolve feedback');
    }

    return response.json();
  },

  /**
   * Get feedback statistics
   */
  async getStats(): Promise<FeedbackStats> {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${config.apiUrl}/api/feedback/stats`, {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch statistics');
    }

    return response.json();
  },
};
