'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FileText, Loader2 } from 'lucide-react';
import { config } from '@/lib/config';
import { getAuthToken } from '@/lib/auth/auth-helper';
import { useAuth } from '@/lib/auth/AuthProvider';
import { toast } from 'sonner';

interface Customer {
  id: string;
  name: string;
  email?: string;
}

interface CreateQuoteModalProps {
  open: boolean;
  onCancel: () => void;
  onSuccess: (quoteId: string, quoteNumber: string) => void;
  selectedFile: File | null;
}

export default function CreateQuoteModal({
  open,
  onCancel,
  onSuccess,
  selectedFile,
}: CreateQuoteModalProps) {
  const { profile } = useAuth();
  const [customerId, setCustomerId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);

  // Fetch customers when modal opens
  useEffect(() => {
    if (open && profile?.organization_id) {
      fetchCustomers();
    }
  }, [open, profile?.organization_id]);

  // Reset form when modal closes
  useEffect(() => {
    if (!open) {
      setCustomerId('');
    }
  }, [open]);

  const fetchCustomers = async () => {
    setLoadingCustomers(true);
    try {
      const token = await getAuthToken();
      if (!token) {
        toast.error('Не авторизован');
        return;
      }

      const response = await fetch(`${config.apiUrl}/api/customers/?limit=100`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Ошибка загрузки клиентов');
      }

      const data = await response.json();
      setCustomers(data.customers || data || []);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Ошибка загрузки клиентов';
      toast.error(errorMessage);
    } finally {
      setLoadingCustomers(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedFile) {
      toast.error('Файл не выбран');
      return;
    }

    if (!customerId) {
      toast.error('Выберите клиента');
      return;
    }

    try {
      setLoading(true);

      const token = await getAuthToken();
      if (!token) {
        toast.error('Не авторизован');
        return;
      }

      // Create form data with file and customer_id
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('customer_id', customerId);

      const response = await fetch(`${config.apiUrl}/api/quotes/upload-excel-validation`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Ошибка создания КП');
      }

      // Get quote info from headers
      // Note: X-Quote-Number is URL-encoded because HTTP headers must be ASCII-safe
      const quoteId = response.headers.get('X-Quote-Id');
      const quoteNumberEncoded = response.headers.get('X-Quote-Number');
      const quoteNumber = quoteNumberEncoded ? decodeURIComponent(quoteNumberEncoded) : null;

      // Download the validation file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `validation_${selectedFile.name.replace(/\.(xlsx|xls|xlsm)$/i, '')}_${new Date().toISOString().slice(0, 10)}.xlsm`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      // Reset form
      setCustomerId('');

      if (quoteId && quoteNumber) {
        toast.success(`КП ${quoteNumber} создано и сохранено`);
        onSuccess(quoteId, quoteNumber);
      } else {
        toast.success('Расчёт выполнен. Файл скачан.');
        onCancel();
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Ошибка создания КП';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      onCancel();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Создать коммерческое предложение
          </DialogTitle>
          <DialogDescription>
            Выберите клиента для создания КП из загруженного файла
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Файл</Label>
            <div className="px-3 py-2 bg-muted rounded-md border">
              <span className="text-sm">{selectedFile?.name || 'Не выбран'}</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="customer">Клиент *</Label>
            <Select value={customerId} onValueChange={setCustomerId} disabled={loadingCustomers}>
              <SelectTrigger>
                <SelectValue placeholder={loadingCustomers ? 'Загрузка...' : 'Выберите клиента'} />
              </SelectTrigger>
              <SelectContent>
                {customers.map((customer) => (
                  <SelectItem key={customer.id} value={customer.id}>
                    {customer.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-md">
            <p className="font-medium mb-2 text-sm">После создания:</p>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
              <li>Файл с расчётом будет скачан</li>
              <li>КП будет сохранено в базу данных</li>
              <li>КП появится в списке со статусом &quot;Черновик&quot;</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Отмена
          </Button>
          <Button onClick={handleSubmit} disabled={loading || !customerId}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Создать КП
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
