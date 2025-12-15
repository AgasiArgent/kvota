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
  const [isAddingSignatory, setIsAddingSignatory] = useState(false);
  const [newSignatoryName, setNewSignatoryName] = useState('');
  const [newSignatoryPosition, setNewSignatoryPosition] = useState('Руководитель');

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
      setIsAddingSignatory(false);
      setNewSignatoryName('');
      setNewSignatoryPosition('Руководитель');
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
          setSignatoryPosition(customer.general_director_position || 'Руководитель');
        } else {
          missing.signatory_name = true;
          setSignatoryPosition('Руководитель');
        }
        // Always start with dropdown, let user click "Add new" if needed
        setIsAddingSignatory(false);

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
          // Don't auto-show input - let user click "Add new" in dropdown
          setIsAddingWarehouse(false);
        } else {
          setWarehouseAddresses(addresses);
          setIsAddingWarehouse(false);
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

      // Determine actual signatory values (from dropdown selection or new input)
      const actualSignatoryName = isAddingSignatory ? newSignatoryName : signatoryName;
      const actualSignatoryPosition = isAddingSignatory ? newSignatoryPosition : signatoryPosition;

      // Save signatory info if different from stored (or if adding new)
      if (actualSignatoryName && actualSignatoryName !== customerData.general_director_name) {
        updates.general_director_name = actualSignatoryName;
      }
      if (
        actualSignatoryPosition &&
        actualSignatoryPosition !== customerData.general_director_position
      ) {
        updates.general_director_position = actualSignatoryPosition;
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

      // Validate signatory name (check both existing and new)
      const actualSignatoryName = isAddingSignatory ? newSignatoryName : signatoryName;
      if (!actualSignatoryName.trim()) {
        toast.error('Укажите ФИО подписанта');
        return;
      }

      // Validate warehouse (check both existing and new)
      if (warehouseAddresses.length === 0 && !newWarehouseAddress.trim()) {
        toast.error('Укажите адрес склада');
        return;
      }
      if (isAddingWarehouse && !newWarehouseAddress.trim()) {
        toast.error('Укажите адрес склада');
        return;
      }

      // Save data if needed
      const saved = await saveMissingData();
      if (!saved) return;

      // Update local signatory state if we added a new one
      if (isAddingSignatory && newSignatoryName) {
        setSignatoryName(newSignatoryName);
        setSignatoryPosition(newSignatoryPosition);
        setIsAddingSignatory(false);
      }

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

                      <div className="space-y-2">
                        <Label>
                          ФИО подписанта <span className="text-destructive">*</span>
                        </Label>

                        {!isAddingSignatory ? (
                          <Select
                            value={customerData.general_director_name ? 'existing' : 'add_new'}
                            onValueChange={(val: string) => {
                              if (val === 'add_new') {
                                setIsAddingSignatory(true);
                              }
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue>
                                {customerData.general_director_name
                                  ? `${signatoryName}, ${signatoryPosition}`
                                  : 'Выберите или добавьте подписанта'}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {customerData.general_director_name && (
                                <SelectItem value="existing">
                                  {customerData.general_director_name},{' '}
                                  {customerData.general_director_position || 'Руководитель'}
                                </SelectItem>
                              )}
                              <SelectItem value="add_new">
                                <span className="flex items-center">
                                  <Plus className="h-3 w-3 mr-1" />
                                  Добавить нового подписанта
                                </span>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <div className="space-y-2">
                            <Input
                              placeholder="ФИО подписанта (например: Иванов Иван Иванович)"
                              value={newSignatoryName}
                              onChange={(e) => setNewSignatoryName(e.target.value)}
                            />
                            <Input
                              placeholder="Должность (например: Руководитель)"
                              value={newSignatoryPosition}
                              onChange={(e) => setNewSignatoryPosition(e.target.value)}
                            />
                            {customerData.general_director_name && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setIsAddingSignatory(false);
                                  setNewSignatoryName('');
                                  setNewSignatoryPosition('Руководитель');
                                }}
                              >
                                Отмена
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <Separator />

                    {/* Warehouse Section */}
                    <div className="space-y-3">
                      <p className="text-sm font-medium">Адрес склада клиента</p>

                      <div className="space-y-2">
                        {!isAddingWarehouse ? (
                          <Select
                            value={
                              warehouseAddresses.length > 0
                                ? selectedWarehouseIndex.toString()
                                : 'add_new'
                            }
                            onValueChange={(val: string) => {
                              if (val === 'add_new') {
                                setIsAddingWarehouse(true);
                              } else {
                                setSelectedWarehouseIndex(parseInt(val));
                              }
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue>
                                {warehouseAddresses.length > 0
                                  ? warehouseAddresses[selectedWarehouseIndex]
                                  : 'Выберите или добавьте адрес'}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {warehouseAddresses.map((address, index) => (
                                <SelectItem key={index} value={index.toString()}>
                                  {address}
                                </SelectItem>
                              ))}
                              <SelectItem value="add_new">
                                <span className="flex items-center">
                                  <Plus className="h-3 w-3 mr-1" />
                                  Добавить новый адрес
                                </span>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <div className="space-y-2">
                            <Input
                              placeholder="Адрес склада (например: г. Москва, ул. Ленина, д. 1)"
                              value={newWarehouseAddress}
                              onChange={(e) => setNewWarehouseAddress(e.target.value)}
                            />
                            <div className="flex gap-2">
                              {warehouseAddresses.length > 0 && (
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
                              )}
                              <Button size="sm" onClick={handleAddWarehouse}>
                                Сохранить
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
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
