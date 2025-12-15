'use client';

import React, { useState, useEffect } from 'react';
import { Loader2, ChevronRight, ChevronLeft, Plus } from 'lucide-react';
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
import { Separator } from '@/components/ui/separator';

import { contractsService } from '@/lib/api/contracts-service';
import { customerService } from '@/lib/api/customer-service';
import { Contract, formatContractDate } from '@/types/contracts';
import ContractModal from '../customers/ContractModal';

interface SpecificationExportModalProps {
  open: boolean;
  onCancel: () => void;
  quoteId: string;
  customerId: string;
  quoteNumber: string;
}

type Step = 'contract' | 'warehouse' | 'review';

interface MissingData {
  signatory_name?: boolean;
  signatory_position?: boolean;
  warehouse_address?: boolean;
}

interface WarehouseEntry {
  name?: string;
  address: string;
}

interface CustomerData {
  general_director_name?: string;
  general_director_position?: string;
  warehouse_addresses?: WarehouseEntry[] | string[];
}

export default function SpecificationExportModal({
  open,
  onCancel,
  quoteId,
  customerId,
  quoteNumber,
}: SpecificationExportModalProps) {
  const [step, setStep] = useState<Step>('contract');
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Data
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [selectedContractId, setSelectedContractId] = useState<string>('');
  const [warehouseAddresses, setWarehouseAddresses] = useState<string[]>([]);
  const [selectedWarehouseIndex, setSelectedWarehouseIndex] = useState<number>(0);
  const [additionalConditions, setAdditionalConditions] = useState('');

  // Missing data form
  const [missingData, setMissingData] = useState<MissingData>({});
  const [signatoryName, setSignatoryName] = useState('');
  const [signatoryPosition, setSignatoryPosition] = useState('Руководитель');
  const [newWarehouseAddress, setNewWarehouseAddress] = useState('');
  const [isAddingWarehouse, setIsAddingWarehouse] = useState(false);

  // Customer data for suggestions
  const [customerData, setCustomerData] = useState<CustomerData>({});

  // Contract creation modal
  const [contractModalOpen, setContractModalOpen] = useState(false);

  useEffect(() => {
    if (open) {
      fetchContracts();
      checkMissingData();
      setStep('contract');
      setSelectedContractId('');
      setSelectedWarehouseIndex(0);
      setAdditionalConditions('');
      setIsAddingWarehouse(false);
      setNewWarehouseAddress('');
    }
  }, [open, customerId]);

  const fetchContracts = async () => {
    setLoading(true);
    try {
      const response = await contractsService.listContracts(customerId);

      if (response.success && response.data) {
        const activeContracts = response.data.filter((c: Contract) => c.status === 'active');
        setContracts(activeContracts);

        if (activeContracts.length === 1) {
          setSelectedContractId(activeContracts[0].id);
        }
      } else {
        toast.error(`Ошибка загрузки договоров: ${response.error}`);
      }
    } catch (error) {
      toast.error(`Ошибка: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
    } finally {
      setLoading(false);
    }
  };

  const checkMissingData = async () => {
    try {
      const response = await customerService.getCustomer(customerId);

      if (response.success && response.data) {
        const customer = response.data;
        const missing: MissingData = {};

        // Store customer data for suggestions
        setCustomerData({
          general_director_name: customer.general_director_name,
          general_director_position: customer.general_director_position,
          warehouse_addresses: customer.warehouse_addresses,
        });

        // Pre-fill from existing customer data
        if (customer.general_director_name) {
          setSignatoryName(customer.general_director_name);
        } else {
          missing.signatory_name = true;
        }

        if (customer.general_director_position) {
          setSignatoryPosition(customer.general_director_position);
        } else {
          // Default to Руководитель if not set
          setSignatoryPosition('Руководитель');
        }

        // Parse warehouse addresses - handle both old format and new format
        let addresses: string[] = [];
        if (customer.warehouse_addresses && Array.isArray(customer.warehouse_addresses)) {
          addresses = customer.warehouse_addresses
            .map((w: any) => {
              // Handle old format {name, address} or new format (just string)
              if (typeof w === 'string') return w;
              if (typeof w === 'object' && w.address) return w.address;
              return '';
            })
            .filter(Boolean);
        }

        if (addresses.length === 0) {
          missing.warehouse_address = true;
          setIsAddingWarehouse(true);
        } else {
          setWarehouseAddresses(addresses);
        }

        setMissingData(missing);
      }
    } catch (error) {
      console.error('Error checking missing data:', error);
    }
  };

  const saveMissingData = async () => {
    try {
      const updates: any = {};

      // Always save signatory info if different from stored
      if (signatoryName && signatoryName !== customerData.general_director_name) {
        updates.general_director_name = signatoryName;
      }
      if (signatoryPosition && signatoryPosition !== customerData.general_director_position) {
        updates.general_director_position = signatoryPosition;
      }

      // Save new warehouse if adding
      if (isAddingWarehouse && newWarehouseAddress) {
        // Combine existing addresses with new one
        const allAddresses = [...warehouseAddresses, newWarehouseAddress];
        // Convert to backend format (for compatibility, use address-only objects)
        updates.warehouse_addresses = allAddresses.map((addr) => ({ name: '', address: addr }));
      }

      if (Object.keys(updates).length > 0) {
        const response = await customerService.updateCustomer(customerId, updates);

        if (!response.success) {
          toast.error(`Ошибка сохранения данных: ${response.error}`);
          return false;
        }

        // Update local state
        if (updates.warehouse_addresses) {
          const newAddresses = updates.warehouse_addresses.map((w: any) => w.address);
          setWarehouseAddresses(newAddresses);
          // Select the newly added warehouse
          setSelectedWarehouseIndex(newAddresses.length - 1);
          setIsAddingWarehouse(false);
          setNewWarehouseAddress('');
        }
      }

      return true;
    } catch (error) {
      toast.error(`Ошибка: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
      return false;
    }
  };

  const handleNext = async () => {
    if (step === 'contract') {
      if (!selectedContractId) {
        toast.error('Выберите договор');
        return;
      }

      // Validate signatory name
      if (!signatoryName.trim()) {
        toast.error('Укажите ФИО подписанта');
        return;
      }

      // Validate warehouse
      if (warehouseAddresses.length === 0 && !newWarehouseAddress.trim()) {
        toast.error('Укажите адрес склада');
        return;
      }

      // Save data if needed
      const saved = await saveMissingData();
      if (!saved) return;

      setStep('warehouse');
    } else if (step === 'warehouse') {
      setStep('review');
    }
  };

  const handleBack = () => {
    if (step === 'warehouse') {
      setStep('contract');
    } else if (step === 'review') {
      setStep('warehouse');
    }
  };

  const handleAddWarehouse = async () => {
    if (!newWarehouseAddress.trim()) {
      toast.error('Введите адрес склада');
      return;
    }

    // Save the new warehouse to customer profile
    const allAddresses = [...warehouseAddresses, newWarehouseAddress];
    const updates = {
      warehouse_addresses: allAddresses.map((addr) => ({ name: '', address: addr })),
    };

    const response = await customerService.updateCustomer(customerId, updates);

    if (response.success) {
      setWarehouseAddresses(allAddresses);
      setSelectedWarehouseIndex(allAddresses.length - 1);
      setNewWarehouseAddress('');
      setIsAddingWarehouse(false);
      toast.success('Адрес склада добавлен');
    } else {
      toast.error(`Ошибка: ${response.error}`);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const response = await contractsService.exportSpecification(quoteId, {
        contract_id: selectedContractId,
        warehouse_index: selectedWarehouseIndex,
        additional_conditions: additionalConditions || undefined,
      });

      if (response.success && response.blob && response.filename) {
        contractsService.downloadSpecification(response.blob, response.filename);
        toast.success('Спецификация экспортирована');
        onCancel();
      } else {
        toast.error(`Ошибка экспорта: ${response.error}`);
      }
    } catch (error) {
      toast.error(`Ошибка: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
    } finally {
      setExporting(false);
    }
  };

  const selectedContract = contracts.find((c) => c.id === selectedContractId);

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      onCancel();
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Экспорт спецификации {quoteNumber}</DialogTitle>
            <DialogDescription>
              {step === 'contract' && 'Шаг 1: Выберите договор и подписанта'}
              {step === 'warehouse' && 'Шаг 2: Выберите адрес склада'}
              {step === 'review' && 'Шаг 3: Проверка и экспорт'}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {/* Step 1: Contract Selection */}
            {step === 'contract' && (
              <div className="space-y-4">
                {loading ? (
                  <div className="text-center py-4">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                  </div>
                ) : contracts.length === 0 ? (
                  <div className="text-center py-6 space-y-3">
                    <p className="text-muted-foreground">Нет активных договоров с клиентом</p>
                    <Button
                      variant="outline"
                      onClick={() => setContractModalOpen(true)}
                      className="bg-primary text-primary-foreground"
                    >
                      Создать договор
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label>Выберите договор</Label>
                      <Select value={selectedContractId} onValueChange={setSelectedContractId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Выберите договор..." />
                        </SelectTrigger>
                        <SelectContent>
                          {contracts.map((contract) => (
                            <SelectItem key={contract.id} value={contract.id}>
                              {contract.contract_number} от{' '}
                              {formatContractDate(contract.contract_date)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {selectedContract && (
                      <div className="p-3 bg-secondary/50 rounded-lg space-y-1">
                        <p className="text-sm font-medium">
                          Номер договора: {selectedContract.contract_number}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Дата: {formatContractDate(selectedContract.contract_date)}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Следующая спецификация: № {selectedContract.next_specification_number}
                        </p>
                      </div>
                    )}

                    <Separator />

                    {/* Signatory Section */}
                    <div className="space-y-3">
                      <p className="text-sm font-medium">Подписант клиента</p>

                      <div className="space-y-1">
                        <Label htmlFor="signatory-name">
                          ФИО подписанта <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="signatory-name"
                          value={signatoryName}
                          onChange={(e) => setSignatoryName(e.target.value)}
                          placeholder="Иванов Иван Иванович"
                        />
                        {customerData.general_director_name &&
                          customerData.general_director_name !== signatoryName && (
                            <button
                              type="button"
                              className="text-xs text-primary hover:underline"
                              onClick={() =>
                                setSignatoryName(customerData.general_director_name || '')
                              }
                            >
                              Использовать из профиля: {customerData.general_director_name}
                            </button>
                          )}
                      </div>

                      <div className="space-y-1">
                        <Label htmlFor="signatory-position">Должность подписанта</Label>
                        <Input
                          id="signatory-position"
                          value={signatoryPosition}
                          onChange={(e) => setSignatoryPosition(e.target.value)}
                          placeholder="Руководитель"
                        />
                      </div>
                    </div>

                    <Separator />

                    {/* Warehouse Section */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">Адрес склада клиента</p>
                        {warehouseAddresses.length > 0 && !isAddingWarehouse && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setIsAddingWarehouse(true)}
                            className="text-xs h-7"
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            Добавить
                          </Button>
                        )}
                      </div>

                      {warehouseAddresses.length > 0 && !isAddingWarehouse ? (
                        <Select
                          value={selectedWarehouseIndex.toString()}
                          onValueChange={(val: string) => setSelectedWarehouseIndex(parseInt(val))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {warehouseAddresses.map((address, index) => (
                              <SelectItem key={index} value={index.toString()}>
                                {address}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <div className="space-y-2">
                          <Input
                            placeholder="Адрес склада (например: г. Москва, ул. Ленина, д. 1)"
                            value={newWarehouseAddress}
                            onChange={(e) => setNewWarehouseAddress(e.target.value)}
                          />
                          {warehouseAddresses.length > 0 && (
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setIsAddingWarehouse(false);
                                  setNewWarehouseAddress('');
                                }}
                              >
                                Отмена
                              </Button>
                              <Button size="sm" onClick={handleAddWarehouse}>
                                Сохранить
                              </Button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Step 2: Additional Conditions */}
            {step === 'warehouse' && (
              <div className="space-y-4">
                <div className="p-3 bg-secondary/50 rounded-lg space-y-2">
                  <p className="text-sm">
                    <span className="text-muted-foreground">Склад:</span>{' '}
                    {warehouseAddresses[selectedWarehouseIndex] || newWarehouseAddress}
                  </p>
                  <p className="text-sm">
                    <span className="text-muted-foreground">Подписант:</span> {signatoryName},{' '}
                    {signatoryPosition}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="additional-conditions">
                    Дополнительные условия (опционально)
                  </Label>
                  <Textarea
                    id="additional-conditions"
                    rows={4}
                    value={additionalConditions}
                    onChange={(e) => setAdditionalConditions(e.target.value)}
                    placeholder="Укажите дополнительные условия поставки, если требуется..."
                  />
                </div>
              </div>
            )}

            {/* Step 3: Review */}
            {step === 'review' && (
              <div className="space-y-4">
                <div className="p-4 bg-secondary/50 rounded-lg space-y-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                      Договор
                    </p>
                    <p className="text-sm">
                      {selectedContract?.contract_number} от{' '}
                      {selectedContract && formatContractDate(selectedContract.contract_date)}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                      Номер спецификации
                    </p>
                    <p className="text-sm">№ {selectedContract?.next_specification_number}</p>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                      Подписант клиента
                    </p>
                    <p className="text-sm">
                      {signatoryName}, {signatoryPosition}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                      Адрес склада
                    </p>
                    <p className="text-sm">
                      {warehouseAddresses[selectedWarehouseIndex] || newWarehouseAddress}
                    </p>
                  </div>

                  {additionalConditions && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                        Дополнительные условия
                      </p>
                      <p className="text-sm whitespace-pre-wrap">{additionalConditions}</p>
                    </div>
                  )}
                </div>

                <p className="text-sm text-muted-foreground">
                  После экспорта номер спецификации автоматически увеличится на 1.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            {step !== 'contract' && (
              <Button variant="outline" onClick={handleBack} disabled={exporting}>
                <ChevronLeft className="h-4 w-4 mr-2" />
                Назад
              </Button>
            )}

            {step !== 'review' ? (
              <Button
                onClick={handleNext}
                disabled={loading || (step === 'contract' && contracts.length === 0)}
                className="bg-primary text-primary-foreground"
              >
                Далее
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <Button
                onClick={handleExport}
                disabled={exporting}
                className="bg-primary text-primary-foreground"
              >
                {exporting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Экспортировать
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Contract Creation Modal */}
      <ContractModal
        open={contractModalOpen}
        onCancel={() => setContractModalOpen(false)}
        onSuccess={() => {
          setContractModalOpen(false);
          fetchContracts();
        }}
        customerId={customerId}
      />
    </>
  );
}
