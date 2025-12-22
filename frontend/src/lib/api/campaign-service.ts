/**
 * Campaign Data API Service
 * Operations for campaign metrics - SmartLead sync and manual entry
 */
import { createClient } from '@/lib/supabase/client';
import type {
  CampaignData,
  CampaignDataCreate,
  CampaignDataUpdate,
  CampaignDataListResponse,
  SmartLeadCampaign,
  SmartLeadSyncRequest,
  SmartLeadSyncResult,
} from '@/types/dashboard';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

async function getAuthHeaders(): Promise<HeadersInit> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('Not authenticated');
  }

  return {
    Authorization: `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
  };
}

// ============================================================================
// Campaign Data CRUD
// ============================================================================

export async function fetchCampaignData(
  page: number = 1,
  limit: number = 50,
  source?: 'smartlead' | 'manual',
  search?: string
): Promise<CampaignDataListResponse> {
  const headers = await getAuthHeaders();
  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
  });

  if (source) {
    params.append('source', source);
  }
  if (search) {
    params.append('search', search);
  }

  const response = await fetch(`${API_BASE}/api/campaign-data?${params.toString()}`, { headers });

  if (!response.ok) {
    throw new Error('Failed to fetch campaign data');
  }

  return response.json();
}

export async function fetchCampaign(campaignId: string): Promise<CampaignData> {
  const headers = await getAuthHeaders();

  const response = await fetch(`${API_BASE}/api/campaign-data/${campaignId}`, {
    headers,
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Campaign not found');
    }
    throw new Error('Failed to fetch campaign');
  }

  return response.json();
}

export async function createCampaignData(data: CampaignDataCreate): Promise<CampaignData> {
  const headers = await getAuthHeaders();

  const response = await fetch(`${API_BASE}/api/campaign-data`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error('Failed to create campaign data');
  }

  return response.json();
}

export async function updateCampaignData(
  campaignId: string,
  data: CampaignDataUpdate
): Promise<CampaignData> {
  const headers = await getAuthHeaders();

  const response = await fetch(`${API_BASE}/api/campaign-data/${campaignId}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error('Failed to update campaign data');
  }

  return response.json();
}

export async function deleteCampaignData(campaignId: string): Promise<void> {
  const headers = await getAuthHeaders();

  const response = await fetch(`${API_BASE}/api/campaign-data/${campaignId}`, {
    method: 'DELETE',
    headers,
  });

  if (!response.ok) {
    throw new Error('Failed to delete campaign data');
  }
}

// ============================================================================
// SmartLead Sync
// ============================================================================

export async function fetchSmartLeadCampaigns(): Promise<SmartLeadCampaign[]> {
  const headers = await getAuthHeaders();

  const response = await fetch(`${API_BASE}/api/campaign-data/smartlead/campaigns`, { headers });

  if (!response.ok) {
    throw new Error('Failed to fetch SmartLead campaigns');
  }

  return response.json();
}

export async function syncCampaigns(
  request: SmartLeadSyncRequest = {}
): Promise<SmartLeadSyncResult> {
  const headers = await getAuthHeaders();

  const response = await fetch(`${API_BASE}/api/campaign-data/sync`, {
    method: 'POST',
    headers,
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Failed to sync campaigns');
  }

  return response.json();
}

export async function syncSingleCampaign(campaignId: string): Promise<CampaignData> {
  const headers = await getAuthHeaders();

  const response = await fetch(`${API_BASE}/api/campaign-data/sync/${campaignId}`, {
    method: 'POST',
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Failed to sync campaign');
  }

  return response.json();
}

// ============================================================================
// Aggregated Metrics
// ============================================================================

export interface AggregatedMetrics {
  sent_count: number;
  open_count: number;
  unique_open_count: number;
  click_count: number;
  unique_click_count: number;
  reply_count: number;
  bounce_count: number;
  unsubscribed_count: number;
  interested_count: number;
  total_leads: number;
  campaign_count: number;
  open_rate: number;
  click_rate: number;
  reply_rate: number;
  bounce_rate: number;
}

export async function fetchAggregatedMetrics(
  campaignIds?: string[],
  source?: 'smartlead' | 'manual'
): Promise<AggregatedMetrics> {
  const headers = await getAuthHeaders();
  const params = new URLSearchParams();

  if (campaignIds && campaignIds.length > 0) {
    params.append('campaign_ids', campaignIds.join(','));
  }
  if (source) {
    params.append('source', source);
  }

  const response = await fetch(`${API_BASE}/api/campaign-data/aggregate?${params.toString()}`, {
    headers,
  });

  if (!response.ok) {
    throw new Error('Failed to fetch aggregated metrics');
  }

  return response.json();
}
