/**
 * Google Calendar Integration Service
 * Handles calendar meeting creation via n8n webhook
 */

import { createClient } from '@/lib/supabase/client';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface CreateMeetingRequest {
  meeting_title?: string;
  meeting_time: string; // ISO datetime string
  duration_minutes?: number;
  attendee_email?: string;
  notes?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Create Google Calendar meeting for a lead
 * Triggers n8n workflow that creates event and sends back event_id
 */
export async function createCalendarMeeting(
  leadId: string,
  request: CreateMeetingRequest
): Promise<ApiResponse<{ lead_id: string; message: string }>> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return {
      success: false,
      error: 'Not authenticated',
    };
  }

  try {
    const response = await fetch(`${API_URL}/api/leads/${leadId}/create-meeting`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: response.statusText }));
      return {
        success: false,
        error: errorData.detail || errorData.error || `HTTP ${response.status}`,
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
