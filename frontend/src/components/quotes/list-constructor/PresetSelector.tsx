'use client';

/**
 * PresetSelector Component - Dropdown to select and manage list presets
 *
 * TASK-008: Quote List Constructor with Department Presets
 *
 * Features:
 * - Grouped dropdown by preset type (system, org, personal)
 * - Department icons
 * - Quick actions (save current, manage presets)
 */

import React, { useMemo } from 'react';
import { ChevronDown, Save, Settings2, Star, Building2, User, Layers } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';

import { ListPreset, groupPresetsByType, getPresetIcon } from '@/lib/api/preset-service';

// =============================================================================
// Types
// =============================================================================

export interface PresetSelectorProps {
  /** Currently selected preset */
  selectedPreset: ListPreset | null;
  /** All available presets */
  presets: ListPreset[];
  /** Loading state */
  isLoading?: boolean;
  /** Callback when preset is selected */
  onSelectPreset: (preset: ListPreset) => void;
  /** Callback when "Save current" is clicked */
  onSaveCurrent?: () => void;
  /** Callback when "Manage presets" is clicked */
  onManagePresets?: () => void;
  /** Whether current state has unsaved changes */
  hasChanges?: boolean;
  /** Additional class name */
  className?: string;
}

// =============================================================================
// Component
// =============================================================================

export default function PresetSelector({
  selectedPreset,
  presets,
  isLoading = false,
  onSelectPreset,
  onSaveCurrent,
  onManagePresets,
  hasChanges = false,
  className,
}: PresetSelectorProps) {
  // Group presets by type
  const groupedPresets = useMemo(() => groupPresetsByType(presets), [presets]);

  // Get display name for the button
  const displayName = selectedPreset?.name || 'Выберите вид';

  if (isLoading) {
    return <Skeleton className="h-9 w-48" />;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className={className}>
          <Layers className="h-4 w-4 mr-2" />
          <span className="max-w-[150px] truncate">{displayName}</span>
          {hasChanges && <span className="ml-2 h-2 w-2 rounded-full bg-amber-500" />}
          <ChevronDown className="h-4 w-4 ml-2" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-64">
        {/* System Presets */}
        {groupedPresets.system.length > 0 && (
          <>
            <DropdownMenuLabel className="flex items-center gap-2">
              <Star className="h-3 w-3" />
              Системные
            </DropdownMenuLabel>
            {groupedPresets.system.map((preset) => (
              <PresetMenuItem
                key={preset.id}
                preset={preset}
                isSelected={selectedPreset?.id === preset.id}
                onClick={() => onSelectPreset(preset)}
              />
            ))}
            <DropdownMenuSeparator />
          </>
        )}

        {/* Organization Presets */}
        {groupedPresets.org.length > 0 && (
          <>
            <DropdownMenuLabel className="flex items-center gap-2">
              <Building2 className="h-3 w-3" />
              Общие
            </DropdownMenuLabel>
            {groupedPresets.org.map((preset) => (
              <PresetMenuItem
                key={preset.id}
                preset={preset}
                isSelected={selectedPreset?.id === preset.id}
                onClick={() => onSelectPreset(preset)}
              />
            ))}
            <DropdownMenuSeparator />
          </>
        )}

        {/* Personal Presets */}
        {groupedPresets.personal.length > 0 && (
          <>
            <DropdownMenuLabel className="flex items-center gap-2">
              <User className="h-3 w-3" />
              Личные
            </DropdownMenuLabel>
            {groupedPresets.personal.map((preset) => (
              <PresetMenuItem
                key={preset.id}
                preset={preset}
                isSelected={selectedPreset?.id === preset.id}
                onClick={() => onSelectPreset(preset)}
              />
            ))}
            <DropdownMenuSeparator />
          </>
        )}

        {/* Actions */}
        {onSaveCurrent && (
          <DropdownMenuItem onClick={onSaveCurrent}>
            <Save className="h-4 w-4 mr-2" />
            Сохранить текущий вид
          </DropdownMenuItem>
        )}

        {onManagePresets && (
          <DropdownMenuItem onClick={onManagePresets}>
            <Settings2 className="h-4 w-4 mr-2" />
            Настроить колонки
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// =============================================================================
// Subcomponents
// =============================================================================

interface PresetMenuItemProps {
  preset: ListPreset;
  isSelected: boolean;
  onClick: () => void;
}

function PresetMenuItem({ preset, isSelected, onClick }: PresetMenuItemProps) {
  const icon = getPresetIcon(preset.department);

  return (
    <DropdownMenuItem onClick={onClick} className={isSelected ? 'bg-accent' : ''}>
      <span className="mr-2">{icon}</span>
      <span className="flex-1 truncate">{preset.name}</span>
      {preset.is_default && <Star className="h-3 w-3 text-amber-500 fill-amber-500" />}
    </DropdownMenuItem>
  );
}
