'use client';

/**
 * Quotes List Page - Main entry point for quote management
 *
 * Uses ListGridWithPresets for the main grid with department presets.
 * Includes header actions for creating quotes and downloading templates.
 */

import React, { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Download, Upload } from 'lucide-react';
import { toast } from 'sonner';

import MainLayout from '@/components/layout/MainLayout';
import PageHeader from '@/components/shared/PageHeader';
import CreateQuoteModal from '@/components/quotes/CreateQuoteModal';
import { ListGridWithPresets } from '@/components/quotes/list-constructor';
import { Button } from '@/components/ui/button';

import { config } from '@/lib/config';
import { getAuthToken } from '@/lib/auth/auth-helper';

export default function QuotesPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Create quote modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Refresh trigger for the grid
  const [refreshKey, setRefreshKey] = useState(0);

  const handleDownloadTemplate = async () => {
    try {
      const token = await getAuthToken();
      if (!token) {
        toast.error('Не авторизован');
        return;
      }

      const response = await fetch(`${config.apiUrl}/api/quotes/upload/download-template`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Ошибка скачивания');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'quote_template.xlsx';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Шаблон скачан');
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Ошибка');
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setCreateModalOpen(true);
    }
    e.target.value = '';
  };

  const handleCreateModalSuccess = (_quoteId: string, quoteNumber: string) => {
    setCreateModalOpen(false);
    setSelectedFile(null);
    // Trigger grid refresh
    setRefreshKey((k) => k + 1);
    toast.success(`КП ${quoteNumber} добавлено в список`);
  };

  const handleCreateModalCancel = () => {
    setCreateModalOpen(false);
    setSelectedFile(null);
  };

  const handleRowClick = (quoteId: string) => {
    router.push(`/quotes/${quoteId}`);
  };

  return (
    <MainLayout>
      <div className="p-6">
        {/* Header */}
        <PageHeader
          title="Коммерческие предложения"
          description="Управление КП с настраиваемыми пресетами для разных отделов"
          actions={
            <>
              <Button variant="outline" onClick={handleDownloadTemplate}>
                <Download className="mr-2 h-4 w-4" />
                Шаблон
              </Button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                accept=".xlsx,.xls,.xlsm"
                className="hidden"
              />
              <Button onClick={() => fileInputRef.current?.click()}>
                <Upload className="mr-2 h-4 w-4" />
                Создать КП
              </Button>
            </>
          }
        />

        {/* Grid with Presets */}
        <div className="mt-6">
          <ListGridWithPresets key={refreshKey} pageSize={50} onRowClick={handleRowClick} />
        </div>
      </div>

      {/* Create Quote Modal */}
      <CreateQuoteModal
        open={createModalOpen}
        onCancel={handleCreateModalCancel}
        onSuccess={handleCreateModalSuccess}
        selectedFile={selectedFile}
      />
    </MainLayout>
  );
}
