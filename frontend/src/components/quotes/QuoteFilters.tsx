'use client';

import React from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface TeamMember {
  id: string;
  name: string;
}

interface QuoteFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusChange: (value: string) => void;
  authorFilter: string | undefined;
  onAuthorChange: (value: string | undefined) => void;
  teamMembers: TeamMember[];
  loadingMembers: boolean;
  className?: string;
}

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Черновик' },
  { value: 'awaiting_financial_approval', label: 'На утверждении' },
  { value: 'financially_approved', label: 'Утверждено' },
  { value: 'rejected_by_finance', label: 'Отклонено' },
  { value: 'sent_back_for_revision', label: 'На доработке' },
  { value: 'ready_to_send', label: 'Готово к отправке' },
  { value: 'sent_to_customer', label: 'Отправлено' },
  { value: 'accepted_by_customer', label: 'Принято' },
  { value: 'rejected_by_customer', label: 'Отклонено клиентом' },
  { value: 'expired', label: 'Истекло' },
  { value: 'cancelled', label: 'Отменено' },
];

export default function QuoteFilters({
  searchTerm,
  onSearchChange,
  statusFilter,
  onStatusChange,
  authorFilter,
  onAuthorChange,
  teamMembers,
  loadingMembers,
  className,
}: QuoteFiltersProps) {
  const hasActiveFilters = searchTerm || statusFilter || authorFilter;

  const clearFilters = () => {
    onSearchChange('');
    onStatusChange('');
    onAuthorChange(undefined);
  };

  return (
    <div className={cn('flex flex-wrap items-center gap-3', className)}>
      {/* Search */}
      <div className="relative flex-1 min-w-[200px] max-w-[300px]">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Поиск по номеру, клиенту..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Status filter */}
      <Select value={statusFilter} onValueChange={onStatusChange}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Статус" />
        </SelectTrigger>
        <SelectContent>
          {STATUS_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Author filter */}
      <Select
        value={authorFilter || ''}
        onValueChange={(v: string) => onAuthorChange(v || undefined)}
        disabled={loadingMembers}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Автор" />
        </SelectTrigger>
        <SelectContent>
          {teamMembers.map((member) => (
            <SelectItem key={member.id} value={member.id}>
              {member.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Clear filters */}
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearFilters}
          className="h-9 px-2 text-muted-foreground"
        >
          <X className="mr-1 h-4 w-4" />
          Сбросить
        </Button>
      )}
    </div>
  );
}
