'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';

import { contractsService } from '@/lib/api/contracts-service';
import { Contract, formatContractStatus, formatContractDate } from '@/types/contracts';
import ContractModal from './ContractModal';

interface ContractsListProps {
  customerId: string;
  onContractsChange?: () => void;
}

export default function ContractsList({ customerId, onContractsChange }: ContractsListProps) {
  const [loading, setLoading] = useState(false);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingContract, setEditingContract] = useState<Contract | null>(null);
  const [deletingContractId, setDeletingContractId] = useState<string | null>(null);

  useEffect(() => {
    fetchContracts();
  }, [customerId]);

  const fetchContracts = async () => {
    setLoading(true);
    try {
      const response = await contractsService.listContracts(customerId);

      if (response.success && response.data) {
        setContracts(response.data);
      } else {
        toast.error(`Ошибка загрузки договоров: ${response.error}`);
        setContracts([]);
      }
    } catch (error) {
      toast.error(
        `Ошибка загрузки договоров: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`
      );
      setContracts([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingContract(null);
    setModalOpen(true);
  };

  const handleEdit = (contract: Contract) => {
    setEditingContract(contract);
    setModalOpen(true);
  };

  const handleDelete = async (contractId: string) => {
    try {
      const response = await contractsService.deleteContract(contractId);

      if (response.success) {
        toast.success('Договор удалён');
        fetchContracts();
        onContractsChange?.();
      } else {
        toast.error(`Ошибка удаления: ${response.error}`);
      }
    } catch (error) {
      toast.error(
        `Ошибка удаления: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`
      );
    } finally {
      setDeletingContractId(null);
    }
  };

  const handleModalSuccess = () => {
    setModalOpen(false);
    setEditingContract(null);
    fetchContracts();
    onContractsChange?.();
  };

  return (
    <>
      <Card className="bg-card border-border">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-lg font-semibold">Договоры</CardTitle>
          <Button onClick={handleCreate} size="sm" className="bg-primary text-primary-foreground">
            <Plus className="h-4 w-4 mr-2" />
            Добавить договор
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : contracts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>Нет договоров</p>
              <p className="text-sm mt-1">Создайте договор для экспорта спецификаций</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Номер договора</TableHead>
                  <TableHead>Дата договора</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead>Спецификаций</TableHead>
                  <TableHead className="text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contracts.map((contract) => {
                  const status = formatContractStatus(contract.status);
                  return (
                    <TableRow key={contract.id}>
                      <TableCell className="font-medium">{contract.contract_number}</TableCell>
                      <TableCell>{formatContractDate(contract.contract_date)}</TableCell>
                      <TableCell>
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </TableCell>
                      <TableCell>{contract.next_specification_number - 1}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(contract)}
                            className="h-8 w-8 p-0"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeletingContractId(contract.id)}
                            className="h-8 w-8 p-0 text-rose-400 hover:text-rose-300"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Modal */}
      <ContractModal
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false);
          setEditingContract(null);
        }}
        onSuccess={handleModalSuccess}
        customerId={customerId}
        contract={editingContract}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deletingContractId}
        onOpenChange={(open: boolean) => !open && setDeletingContractId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить договор?</AlertDialogTitle>
            <AlertDialogDescription>
              Это действие нельзя отменить. Договор будет удалён из системы.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingContractId && handleDelete(deletingContractId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
