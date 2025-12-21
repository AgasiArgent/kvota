'use client';

/**
 * Test page for List Constructor components
 * URL: /quotes/list-test
 */

import React from 'react';
import MainLayout from '@/components/layout/MainLayout';
import PageHeader from '@/components/shared/PageHeader';
import { ListGridWithPresets } from '@/components/quotes/list-constructor';
import { useRouter } from 'next/navigation';

export default function ListTestPage() {
  const router = useRouter();

  const handleRowClick = (quoteId: string) => {
    router.push(`/quotes/${quoteId}`);
  };

  return (
    <MainLayout>
      <div className="p-6">
        <PageHeader
          title="List Constructor Test"
          description="Testing the new quote list with department presets"
        />

        <div className="mt-6">
          <ListGridWithPresets pageSize={20} onRowClick={handleRowClick} />
        </div>
      </div>
    </MainLayout>
  );
}
