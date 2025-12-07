'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Check, Building2, ChevronDown, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { organizationService } from '@/lib/api/organization-service';
import { UserOrganization } from '@/lib/types/organization';
import { useAuth } from '@/lib/auth/AuthProvider';
import { userService } from '@/lib/api/user-service';
import {
  getOrganizationCache,
  setOrganizationCache,
  updateCurrentOrgId,
} from '@/lib/cache/organization-cache';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface OrganizationSwitcherProps {
  onSwitch?: () => void;
  darkMode?: boolean;
}

export default function OrganizationSwitcher({ onSwitch, darkMode }: OrganizationSwitcherProps) {
  const router = useRouter();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [organizations, setOrganizations] = useState<UserOrganization[]>([]);
  const [currentOrg, setCurrentOrg] = useState<UserOrganization | null>(null);

  useEffect(() => {
    if (profile) {
      fetchOrganizations();
    }
  }, [profile?.organization_id]); // Re-fetch when profile org changes

  const fetchOrganizations = async () => {
    // Try cache first
    const cached = getOrganizationCache();
    if (cached) {
      console.log('Using cached organizations (TTL: 5 min)');
      setOrganizations(cached.organizations);

      // Set current org from cache
      const activeOrg = cached.organizations.find(
        (org) => org.organization_id === cached.currentOrgId
      );
      if (activeOrg) {
        setCurrentOrg(activeOrg);
      } else if (cached.organizations.length > 0) {
        setCurrentOrg(cached.organizations[0]);
      }

      return; // Skip API call
    }

    // Cache miss or expired - fetch from API
    console.log('Fetching organizations from API...');
    setLoading(true);
    try {
      const [orgsResult, profileResult] = await Promise.all([
        organizationService.listOrganizations(),
        userService.getProfile(),
      ]);

      console.log('Organization fetch result:', orgsResult);

      if (orgsResult.success && orgsResult.data) {
        setOrganizations(orgsResult.data);

        // Get current organization from user profile's last_active_organization_id
        let currentOrgId: string | null = null;
        if (profileResult.success && profileResult.data?.last_active_organization_id) {
          currentOrgId = profileResult.data.last_active_organization_id;
          const activeOrg = orgsResult.data.find((org) => org.organization_id === currentOrgId);
          if (activeOrg) {
            setCurrentOrg(activeOrg);
          } else if (orgsResult.data.length > 0) {
            // Fallback to first org if last_active not found
            setCurrentOrg(orgsResult.data[0]);
            currentOrgId = orgsResult.data[0].organization_id;
          }
        } else if (orgsResult.data.length > 0) {
          // Fallback to first org if no profile data
          setCurrentOrg(orgsResult.data[0]);
          currentOrgId = orgsResult.data[0].organization_id;
        }

        // Cache the result
        setOrganizationCache(orgsResult.data, currentOrgId);
      } else {
        console.error('Failed to fetch organizations:', orgsResult.error);
      }
    } catch (error: unknown) {
      console.error('Error fetching organizations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSwitch = async (organizationId: string) => {
    if (currentOrg?.organization_id === organizationId) {
      // Already on this organization
      return;
    }

    setSwitching(true);
    try {
      const result = await organizationService.switchOrganization(organizationId);

      if (result.success) {
        const newOrg = organizations.find((org) => org.organization_id === organizationId);

        if (newOrg) {
          setCurrentOrg(newOrg);

          // Update cache with new current org
          updateCurrentOrgId(organizationId);

          toast.success(`Переключено на ${newOrg.organization_name}`);

          // Callback to parent (e.g., to refresh data)
          if (onSwitch) {
            onSwitch();
          }

          // Refresh the page to reload data for new organization
          window.location.reload();
        }
      } else {
        toast.error(result.error || 'Ошибка переключения организации');
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';
      toast.error(`Ошибка: ${errorMessage}`);
    } finally {
      setSwitching(false);
    }
  };

  if (organizations.length === 0 && !loading) {
    return (
      <Button
        variant="outline"
        onClick={() => router.push('/organizations')}
        className={cn(darkMode && 'bg-white/10 border-white/20 text-white hover:bg-white/20')}
      >
        <Building2 className="h-4 w-4 mr-2" />
        Организации
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          disabled={switching || loading}
          className={cn(
            'w-full justify-between',
            darkMode && 'bg-white/10 border-white/20 text-white hover:bg-white/20'
          )}
        >
          {loading || switching ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <span className="truncate">
                {currentOrg ? currentOrg.organization_name : 'Выберите организацию'}
              </span>
              <ChevronDown className="h-4 w-4 ml-2 shrink-0" />
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[280px]">
        {organizations.map((org) => (
          <DropdownMenuItem
            key={org.organization_id}
            onClick={() => handleSwitch(org.organization_id)}
            className="flex items-center justify-between cursor-pointer"
          >
            <div className="flex flex-col">
              <span className="font-medium">{org.organization_name}</span>
              <span className="text-xs text-muted-foreground">{org.role_name}</span>
            </div>
            {currentOrg?.organization_id === org.organization_id && (
              <Check className="h-4 w-4 text-green-500" />
            )}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push('/organizations')} className="cursor-pointer">
          <Building2 className="h-4 w-4 mr-2" />
          Все организации
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
