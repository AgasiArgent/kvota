'use client';

/**
 * ListGridWithPresets Component - Complete Quote List with Preset Management
 *
 * TASK-008: Quote List Constructor with Department Presets
 *
 * This component combines ListGrid with preset selection and column configuration.
 * It's the main entry point for the quote list constructor feature.
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { toast } from 'sonner';

import ListGrid from './ListGrid';
import PresetSelector from './PresetSelector';
import ColumnConfigModal from './ColumnConfigModal';

import { SALES_PRESET_COLUMNS } from './columnDefs';
import {
  usePresets,
  ListPreset,
  getColumnsFromPreset,
  getLastPresetId,
  saveLastPresetId,
  ColumnConfig,
} from '@/lib/api/preset-service';

// =============================================================================
// Types
// =============================================================================

export interface ListGridWithPresetsProps {
  /** Initial preset ID to load (overrides localStorage) */
  initialPresetId?: string;
  /** Page size (default 50) */
  pageSize?: number;
  /** Callback when row is clicked */
  onRowClick?: (quoteId: string) => void;
  /** Additional class name */
  className?: string;
}

// =============================================================================
// Component
// =============================================================================

export default function ListGridWithPresets({
  initialPresetId,
  pageSize = 50,
  onRowClick,
  className,
}: ListGridWithPresetsProps) {
  // Preset management
  const { presets, isLoading: presetsLoading, createPreset } = usePresets();

  // State
  const [selectedPreset, setSelectedPreset] = useState<ListPreset | null>(null);
  const [currentColumns, setCurrentColumns] = useState<string[]>(SALES_PRESET_COLUMNS);
  const [columnConfigOpen, setColumnConfigOpen] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Load initial preset
  useEffect(() => {
    if (presetsLoading || presets.length === 0) return;

    // Priority: initialPresetId > localStorage > first system preset
    const presetIdToLoad = initialPresetId || getLastPresetId();

    let presetToSelect: ListPreset | null = null;

    if (presetIdToLoad) {
      presetToSelect = presets.find((p) => p.id === presetIdToLoad) || null;
    }

    // Fallback to first system preset (Продажи)
    if (!presetToSelect) {
      presetToSelect =
        presets.find((p) => p.preset_type === 'system' && p.department === 'sales') ||
        presets.find((p) => p.preset_type === 'system') ||
        null;
    }

    if (presetToSelect) {
      setSelectedPreset(presetToSelect);
      setCurrentColumns(getColumnsFromPreset(presetToSelect));
      saveLastPresetId(presetToSelect.id);
    }
  }, [presets, presetsLoading, initialPresetId]);

  // Handle preset selection
  const handleSelectPreset = useCallback((preset: ListPreset) => {
    setSelectedPreset(preset);
    setCurrentColumns(getColumnsFromPreset(preset));
    setHasUnsavedChanges(false);
    saveLastPresetId(preset.id);
    toast.success(`Применен вид: ${preset.name}`);
  }, []);

  // Handle column config change
  const handleApplyColumns = useCallback((columns: string[]) => {
    setCurrentColumns(columns);
    setHasUnsavedChanges(true);
  }, []);

  // Handle save as preset
  const handleSaveAsPreset = useCallback(
    async (name: string, columns: string[]) => {
      try {
        const columnConfigs: ColumnConfig[] = columns.map((field) => ({
          field,
          hide: false,
        }));

        const newPreset = await createPreset({
          name,
          preset_type: 'personal',
          columns: columnConfigs,
          is_default: false,
        });

        setSelectedPreset(newPreset);
        setHasUnsavedChanges(false);
        saveLastPresetId(newPreset.id);
        toast.success(`Пресет "${name}" сохранен`);
      } catch (err) {
        toast.error(`Ошибка сохранения: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    },
    [createPreset]
  );

  // Open column config modal
  const handleOpenColumnConfig = useCallback(() => {
    setColumnConfigOpen(true);
  }, []);

  // Handle save current (quick save to existing preset)
  const handleSaveCurrent = useCallback(() => {
    // For now, open the column config modal with save form
    setColumnConfigOpen(true);
    toast.info('Выберите "Сохранить как пресет" чтобы сохранить текущий вид');
  }, []);

  // Wait for presets to load before rendering grid to avoid race condition
  // where the initial fetch gets cancelled when presets update columns
  if (presetsLoading) {
    return (
      <div className={className}>
        <div className="space-y-4">
          <div className="h-10 w-48 bg-muted animate-pulse rounded" />
          <div className="space-y-3">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="h-12 w-full bg-muted animate-pulse rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Header with PresetSelector */}
      <div className="flex items-center justify-between mb-4">
        <PresetSelector
          selectedPreset={selectedPreset}
          presets={presets}
          isLoading={presetsLoading}
          onSelectPreset={handleSelectPreset}
          onSaveCurrent={handleSaveCurrent}
          onManagePresets={handleOpenColumnConfig}
          hasChanges={hasUnsavedChanges}
        />
      </div>

      {/* Grid */}
      <ListGrid
        columns={currentColumns}
        pageSize={pageSize}
        onRowClick={onRowClick}
        showColumnConfig={false} // We handle this via PresetSelector
        onColumnConfigChange={(cols) => {
          setCurrentColumns(cols);
          setHasUnsavedChanges(true);
        }}
      />

      {/* Column Config Modal */}
      <ColumnConfigModal
        open={columnConfigOpen}
        onClose={() => setColumnConfigOpen(false)}
        selectedColumns={currentColumns}
        onApply={handleApplyColumns}
        onSaveAsPreset={handleSaveAsPreset}
      />
    </div>
  );
}
