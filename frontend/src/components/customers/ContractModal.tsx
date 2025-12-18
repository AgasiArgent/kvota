'use client';

import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

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
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { contractsService } from '@/lib/api/contracts-service';
import { Contract, ContractCreate, ContractUpdate, ContractStatus } from '@/types/contracts';

interface ContractModalProps {
  open: boolean;
  onCancel: () => void;
  onSuccess: () => void;
  customerId: string;
  contract?: Contract | null;
}

export default function ContractModal({
  open,
  onCancel,
  onSuccess,
  customerId,
  contract,
}: ContractModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    contract_number: '',
    contract_date: '',
    status: 'active' as ContractStatus,
    notes: '',
  });

  const isEditing = !!contract;

  useEffect(() => {
    if (contract) {
      setFormData({
        contract_number: contract.contract_number,
        contract_date: contract.contract_date.split('T')[0], // Convert to YYYY-MM-DD
        status: contract.status,
        notes: contract.notes || '',
      });
    } else {
      setFormData({
        contract_number: '',
        contract_date: new Date().toISOString().split('T')[0],
        status: 'active',
        notes: '',
      });
    }
  }, [contract, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.contract_number.trim()) {
      toast.error('Укажите номер договора');
      return;
    }

    if (!formData.contract_date) {
      toast.error('Укажите дату договора');
      return;
    }

    setLoading(true);

    try {
      if (isEditing) {
        // Update existing contract
        const updateData: ContractUpdate = {
          contract_number: formData.contract_number,
          contract_date: formData.contract_date,
          status: formData.status,
          notes: formData.notes || undefined,
        };

        const response = await contractsService.updateContract(contract.id, updateData);

        if (response.success) {
          toast.success('Договор обновлён');
          onSuccess();
        } else {
          toast.error(`Ошибка обновления: ${response.error}`);
        }
      } else {
        // Create new contract
        const createData: ContractCreate = {
          customer_id: customerId,
          contract_number: formData.contract_number,
          contract_date: formData.contract_date,
          notes: formData.notes || undefined,
        };

        const response = await contractsService.createContract(customerId, createData);

        if (response.success) {
          toast.success('Договор создан');
          onSuccess();
        } else {
          toast.error(`Ошибка создания: ${response.error}`);
        }
      }
    } catch (error) {
      toast.error(
        `Ошибка сохранения: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`
      );
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
          <DialogTitle>{isEditing ? 'Редактировать договор' : 'Создать договор'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Измените данные договора'
              : 'Заполните информацию о договоре для экспорта спецификаций'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="contract_number">
                Номер договора <span className="text-destructive">*</span>
              </Label>
              <Input
                id="contract_number"
                value={formData.contract_number}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, contract_number: e.target.value }))
                }
                placeholder="Например: № 123/2025"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contract_date">
                Дата договора <span className="text-destructive">*</span>
              </Label>
              <Input
                id="contract_date"
                type="date"
                value={formData.contract_date}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, contract_date: e.target.value }))
                }
                required
              />
            </div>

            {isEditing && (
              <div className="space-y-2">
                <Label htmlFor="status">Статус</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value: ContractStatus) =>
                    setFormData((prev) => ({ ...prev, status: value }))
                  }
                >
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Активен</SelectItem>
                    <SelectItem value="expired">Истёк</SelectItem>
                    <SelectItem value="terminated">Расторгнут</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="notes">Примечания</Label>
              <Textarea
                id="notes"
                rows={3}
                value={formData.notes}
                onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                placeholder="Дополнительная информация о договоре..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={onCancel} type="button">
              Отмена
            </Button>
            <Button type="submit" disabled={loading} className="bg-primary text-primary-foreground">
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isEditing ? 'Сохранить' : 'Создать'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
