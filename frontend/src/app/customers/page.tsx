'use client';

import React, { useState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search as SearchIcon, X, Phone, Mail } from 'lucide-react';
import { toast } from 'sonner';

import MainLayout from '@/components/layout/MainLayout';
import PageHeader from '@/components/shared/PageHeader';
import StatCard from '@/components/shared/StatCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { customerService, Customer, CustomerContact } from '@/lib/api/customer-service';

export default function CustomersPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);

  // Filters with transition for better INP
  const [isPending, startTransition] = useTransition();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  // Contacts per customer
  const [contactsMap, setContactsMap] = useState<Record<string, CustomerContact[]>>({});

  useEffect(() => {
    fetchCustomers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, pageSize, searchTerm, statusFilter]);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const response = await customerService.listCustomers({
        page: currentPage,
        limit: pageSize,
        search: searchTerm || undefined,
        status: statusFilter || undefined,
      });

      if (response.success && response.data) {
        const customersList = response.data.customers || [];
        setCustomers(customersList);
        setTotalCount(response.data.total || 0);

        // Fetch contacts for all customers in parallel
        const contactPromises = customersList.map((customer) =>
          customerService.listContacts(customer.id).then((res) => ({
            customerId: customer.id,
            contacts: res.success && res.data ? res.data.contacts : [],
          }))
        );

        const contactResults = await Promise.all(contactPromises);
        const newContactsMap: Record<string, CustomerContact[]> = {};
        contactResults.forEach(({ customerId, contacts }) => {
          newContactsMap[customerId] = contacts;
        });
        setContactsMap(newContactsMap);
      } else {
        toast.error(`Ошибка загрузки клиентов: ${response.error}`);
        setCustomers([]);
        setTotalCount(0);
      }
    } catch (error) {
      toast.error(
        `Ошибка загрузки клиентов: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`
      );
      setCustomers([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { dotColor: string; text: string }> = {
      active: { dotColor: 'bg-emerald-400', text: 'Активный' },
      inactive: { dotColor: 'bg-zinc-400', text: 'Неактивный' },
      suspended: { dotColor: 'bg-rose-400', text: 'Приостановлен' },
    };
    const config = statusMap[status] || {
      dotColor: 'bg-zinc-400',
      text: status,
    };
    return (
      <Badge variant="secondary" className="gap-1.5">
        <span className={cn('h-1.5 w-1.5 rounded-full', config.dotColor)} />
        {config.text}
      </Badge>
    );
  };

  const getCompanyTypeDisplay = (type: string) => {
    const typeMap = {
      organization: 'ООО',
      individual_entrepreneur: 'ИП',
      individual: 'Физ. лицо',
      government: 'Гос. орган',
    };
    return typeMap[type as keyof typeof typeMap] || type;
  };

  // Stats calculation
  const activeCustomers = customers.filter((c) => c.status === 'active').length;
  const inactiveCustomers = customers.filter((c) => c.status === 'inactive').length;

  const hasActiveFilters = searchTerm || statusFilter;

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('');
    setCurrentPage(1);
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <PageHeader
          title="Клиенты"
          actions={
            <Button onClick={() => router.push('/customers/create')}>
              <Plus className="mr-2 h-4 w-4" />
              Добавить клиента
            </Button>
          }
        />

        {/* Stats */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard label="Всего клиентов" value={totalCount} />
          <StatCard label="Активные" value={activeCustomers} />
          <StatCard label="Неактивные" value={inactiveCustomers} />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border/50 bg-card/30 p-4">
          <div className="relative flex-1 min-w-[200px] max-w-[320px]">
            <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/40" />
            <Input
              placeholder="Поиск по названию, ИНН..."
              value={searchTerm}
              onChange={(e) => startTransition(() => setSearchTerm(e.target.value))}
              className="pl-9 bg-background/50 border-border/50 placeholder:text-foreground/30"
            />
          </div>

          <Select
            value={statusFilter}
            onValueChange={(v: string) => startTransition(() => setStatusFilter(v))}
          >
            <SelectTrigger className="w-[160px] bg-background/50 border-border/50">
              <SelectValue placeholder="Статус" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Активный</SelectItem>
              <SelectItem value="inactive">Неактивный</SelectItem>
              <SelectItem value="suspended">Приостановлен</SelectItem>
            </SelectContent>
          </Select>

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="h-9 px-3 text-foreground/50 hover:text-foreground hover:bg-background/50"
            >
              <X className="mr-1.5 h-4 w-4" />
              Сбросить
            </Button>
          )}
        </div>

        {/* Table */}
        <div
          className={cn(
            'rounded-lg border border-border overflow-hidden bg-card',
            isPending && 'opacity-70 transition-opacity'
          )}
        >
          {loading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 10 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : customers.length === 0 ? (
            <div className="p-8 text-center text-foreground/40">Клиенты не найдены</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-secondary/30 border-b border-border">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-foreground/60">
                      Название
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-foreground/60">
                      ИНН
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-foreground/60">
                      Город
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-foreground/60">
                      ЛПР
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-foreground/60">
                      Статус
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {customers.map((customer) => {
                    const contacts = contactsMap[customer.id] || [];
                    return (
                      <tr
                        key={customer.id}
                        onClick={() => router.push(`/customers/${customer.id}`)}
                        className="hover:bg-foreground/5 cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-3">
                          <div className="flex flex-col">
                            <span className="font-medium text-foreground/90">{customer.name}</span>
                            <span className="text-xs text-foreground/55">
                              {getCompanyTypeDisplay(customer.company_type)}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-foreground/70">
                          {customer.inn || '—'}
                        </td>
                        <td className="px-4 py-3 text-sm text-foreground/70">{customer.city}</td>
                        <td className="px-4 py-3">
                          {contacts.length === 0 ? (
                            <span className="text-sm text-foreground/40">—</span>
                          ) : (
                            <TooltipProvider>
                              <div className="flex flex-wrap gap-1">
                                {contacts.map((contact) => (
                                  <Tooltip key={contact.id}>
                                    <TooltipTrigger asChild>
                                      <Badge
                                        variant="secondary"
                                        className="cursor-help hover:bg-secondary/80"
                                      >
                                        {contact.name}
                                        {contact.is_primary && ' ⭐'}
                                      </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent className="max-w-xs">
                                      <div className="space-y-1 text-xs">
                                        <div className="font-medium">
                                          {contact.name} {contact.last_name || ''}
                                          {contact.is_primary && ' (Основной)'}
                                        </div>
                                        {contact.position && (
                                          <div className="text-foreground/70">
                                            {contact.position}
                                          </div>
                                        )}
                                        {contact.phone && (
                                          <div className="text-foreground/70">
                                            <Phone className="inline h-3 w-3 mr-1" />
                                            {contact.phone}
                                          </div>
                                        )}
                                        {contact.email && (
                                          <div className="text-foreground/70">
                                            <Mail className="inline h-3 w-3 mr-1" />
                                            {contact.email}
                                          </div>
                                        )}
                                      </div>
                                    </TooltipContent>
                                  </Tooltip>
                                ))}
                              </div>
                            </TooltipProvider>
                          )}
                        </td>
                        <td className="px-4 py-3">{getStatusBadge(customer.status)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {!loading && totalCount > 0 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-secondary/20">
              <div className="text-sm text-foreground/60">
                Показано {(currentPage - 1) * pageSize + 1}–
                {Math.min(currentPage * pageSize, totalCount)} из {totalCount} клиентов
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                >
                  Назад
                </Button>
                <span className="text-sm text-foreground/60">
                  Страница {currentPage} из {Math.ceil(totalCount / pageSize)}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage >= Math.ceil(totalCount / pageSize)}
                  onClick={() => setCurrentPage((p) => p + 1)}
                >
                  Далее
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
