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
import { customerService, CustomerContact, DeliveryAddress } from '@/lib/api/customer-service';
import { Contract, formatContractDate } from '@/types/contracts';
import ContractModal from '../customers/ContractModal';

// Helper to format Russian name as "Фамилия Имя Отчество"
function formatFullName(contact: CustomerContact): string {
  const parts: string[] = [];
  if (contact.last_name) parts.push(contact.last_name);
  if (contact.name) parts.push(contact.name);
  if (contact.patronymic) parts.push(contact.patronymic);
  return parts.join(' ') || contact.name;
}

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
  const [additionalConditions, setAdditionalConditions] = useState('');

  // Signatories from customer_contacts (is_signatory=true)
  const [signatoryContacts, setSignatoryContacts] = useState<CustomerContact[]>([]);
  const [selectedSignatoryId, setSelectedSignatoryId] = useState<string>('');
  const [signatoryName, setSignatoryName] = useState('');
  const [signatoryPosition, setSignatoryPosition] = useState('Руководитель');
  const [isAddingSignatory, setIsAddingSignatory] = useState(false);
  const [newSignatoryName, setNewSignatoryName] = useState('');
  const [newSignatoryPosition, setNewSignatoryPosition] = useState('Руководитель');

  // Delivery addresses from customer_delivery_addresses table
  const [deliveryAddresses, setDeliveryAddresses] = useState<DeliveryAddress[]>([]);
  const [selectedDeliveryAddressId, setSelectedDeliveryAddressId] = useState<string>('');
  const [isAddingWarehouse, setIsAddingWarehouse] = useState(false);
  const [newWarehouseAddress, setNewWarehouseAddress] = useState('');

  // Missing data form
  const [missingData, setMissingData] = useState<MissingData>({});

  // Customer data for backward compatibility fallback
  const [customerData, setCustomerData] = useState<CustomerData>({});

  // Contract creation modal
  const [contractModalOpen, setContractModalOpen] = useState(false);

  useEffect(() => {
    if (open) {
      fetchContracts();
      fetchSignatoriesAndAddresses();
      setStep('contract');
      setSelectedContractId('');
      setAdditionalConditions('');
      // Reset signatory state
      setSelectedSignatoryId('');
      setSignatoryName('');
      setSignatoryPosition('Руководитель');
      setIsAddingSignatory(false);
      setNewSignatoryName('');
      setNewSignatoryPosition('Руководитель');
      // Reset delivery address state
      setSelectedDeliveryAddressId('');
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

  const fetchSignatoriesAndAddresses = async () => {
    try {
      const missing: MissingData = {};

      // Fetch contacts and filter signatories
      const contactsResponse = await customerService.listContacts(customerId);
      if (contactsResponse.success && contactsResponse.data) {
        const signatories = contactsResponse.data.contacts.filter((c) => c.is_signatory);
        setSignatoryContacts(signatories);

        if (signatories.length > 0) {
          // Auto-select first signatory
          const firstSignatory = signatories[0];
          setSelectedSignatoryId(firstSignatory.id);
          // Format as "Фамилия Имя Отчество"
          setSignatoryName(formatFullName(firstSignatory));
          // Use position field (not signatory_position)
          setSignatoryPosition(firstSignatory.position || 'Генеральный директор');
          setIsAddingSignatory(false);
        } else {
          missing.signatory_name = true;
          // If no signatories, check for fallback in customer data
          const customerResponse = await customerService.getCustomer(customerId);
          if (customerResponse.success && customerResponse.data) {
            const customer = customerResponse.data;
            setCustomerData({
              general_director_name: customer.general_director_name,
              general_director_position: customer.general_director_position,
              warehouse_addresses: customer.warehouse_addresses,
            });

            // Fallback: use general_director from customer if no signatory contacts
            if (customer.general_director_name) {
              setSignatoryName(customer.general_director_name);
              setSignatoryPosition(customer.general_director_position || 'Руководитель');
            }
          }
        }
      }

      // Fetch delivery addresses from new table
      const addressesResponse = await customerService.listDeliveryAddresses(customerId);
      if (addressesResponse.success && addressesResponse.data) {
        const addresses = addressesResponse.data.addresses;
        setDeliveryAddresses(addresses);

        if (addresses.length > 0) {
          // Auto-select default address or first one
          const defaultAddr = addresses.find((a) => a.is_default);
          if (defaultAddr) {
            setSelectedDeliveryAddressId(defaultAddr.id);
          } else {
            setSelectedDeliveryAddressId(addresses[0].id);
          }
          setIsAddingWarehouse(false);
        } else {
          missing.warehouse_address = true;
          setIsAddingWarehouse(false);
        }
      }

      setMissingData(missing);
    } catch (error) {
      console.error('Error fetching signatories and addresses:', error);
    }
  };

  const saveMissingData = async () => {
    try {
      // Save new signatory as a contact if adding new
      if (isAddingSignatory && newSignatoryName) {
        const contactResponse = await customerService.createContact(customerId, {
          name: newSignatoryName,
          position: newSignatoryPosition || 'Руководитель',
          is_signatory: true,
          signatory_position: newSignatoryPosition || 'Руководитель',
        });

        if (!contactResponse.success) {
          toast.error(`Ошибка создания подписанта: ${contactResponse.error}`);
          return false;
        }

        // Update local state with new signatory
        const newContact = contactResponse.data!;
        setSignatoryContacts([...signatoryContacts, newContact]);
        setSelectedSignatoryId(newContact.id);
        setSignatoryName(newSignatoryName);
        setSignatoryPosition(newSignatoryPosition);
        setIsAddingSignatory(false);
        setNewSignatoryName('');
        setNewSignatoryPosition('Руководитель');
      }

      // Save new delivery address if adding
      if (isAddingWarehouse && newWarehouseAddress) {
        const addressResponse = await customerService.createDeliveryAddress(customerId, {
          address: newWarehouseAddress,
          is_default: deliveryAddresses.length === 0, // Default if first address
        });

        if (!addressResponse.success) {
          toast.error(`Ошибка создания адреса: ${addressResponse.error}`);
          return false;
        }

        // Update local state with new address
        const newAddress = addressResponse.data!;
        setDeliveryAddresses([...deliveryAddresses, newAddress]);
        setSelectedDeliveryAddressId(newAddress.id);
        setIsAddingWarehouse(false);
        setNewWarehouseAddress('');
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

      // Validate delivery address (check both existing and new)
      if (deliveryAddresses.length === 0 && !newWarehouseAddress.trim()) {
        toast.error('Укажите адрес склада');
        return;
      }
      if (isAddingWarehouse && !newWarehouseAddress.trim()) {
        toast.error('Укажите адрес склада');
        return;
      }

      // Save data if needed (creates new contact/address if adding)
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

  const handleAddSignatory = async () => {
    if (!newSignatoryName.trim()) {
      toast.error('Введите ФИО подписанта');
      return;
    }

    // Create new signatory contact via API
    const response = await customerService.createContact(customerId, {
      name: newSignatoryName,
      position: newSignatoryPosition || 'Руководитель',
      is_signatory: true,
      signatory_position: newSignatoryPosition || 'Руководитель',
    });

    if (response.success && response.data) {
      const newContact = response.data;
      setSignatoryContacts([...signatoryContacts, newContact]);
      setSelectedSignatoryId(newContact.id);
      setSignatoryName(newSignatoryName);
      setSignatoryPosition(newSignatoryPosition || 'Руководитель');
      setNewSignatoryName('');
      setNewSignatoryPosition('Руководитель');
      setIsAddingSignatory(false);
      toast.success('Подписант добавлен');
    } else {
      toast.error(`Ошибка: ${response.error}`);
    }
  };

  const handleAddWarehouse = async () => {
    if (!newWarehouseAddress.trim()) {
      toast.error('Введите адрес склада');
      return;
    }

    // Create new delivery address via API
    const response = await customerService.createDeliveryAddress(customerId, {
      address: newWarehouseAddress,
      is_default: deliveryAddresses.length === 0, // Default if first address
    });

    if (response.success && response.data) {
      const newAddress = response.data;
      setDeliveryAddresses([...deliveryAddresses, newAddress]);
      setSelectedDeliveryAddressId(newAddress.id);
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
        delivery_address_id: selectedDeliveryAddressId || undefined,
        signatory_contact_id: selectedSignatoryId || undefined,
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
                            value={selectedSignatoryId || 'add_new'}
                            onValueChange={(val: string) => {
                              if (val === 'add_new') {
                                setIsAddingSignatory(true);
                                setSelectedSignatoryId('');
                              } else {
                                setSelectedSignatoryId(val);
                                const selected = signatoryContacts.find((c) => c.id === val);
                                if (selected) {
                                  // Format as "Фамилия Имя Отчество"
                                  setSignatoryName(formatFullName(selected));
                                  // Use position field (not signatory_position)
                                  setSignatoryPosition(selected.position || 'Генеральный директор');
                                }
                              }
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue>
                                {selectedSignatoryId && signatoryName
                                  ? `${signatoryName}, ${signatoryPosition}`
                                  : 'Выберите или добавьте подписанта'}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {signatoryContacts.map((contact) => (
                                <SelectItem key={contact.id} value={contact.id}>
                                  {/* Russian name order: Фамилия Имя Отчество */}
                                  {formatFullName(contact)},{' '}
                                  {contact.position || 'Генеральный директор'}
                                </SelectItem>
                              ))}
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
                            <div className="flex gap-2">
                              {signatoryContacts.length > 0 && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setIsAddingSignatory(false);
                                    setNewSignatoryName('');
                                    setNewSignatoryPosition('Руководитель');
                                    // Restore previous selection if any
                                    if (signatoryContacts.length > 0) {
                                      const first = signatoryContacts[0];
                                      setSelectedSignatoryId(first.id);
                                      setSignatoryName(formatFullName(first));
                                      setSignatoryPosition(
                                        first.position || 'Генеральный директор'
                                      );
                                    }
                                  }}
                                >
                                  Отмена
                                </Button>
                              )}
                              <Button size="sm" onClick={handleAddSignatory}>
                                Сохранить
                              </Button>
                            </div>
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
                            value={selectedDeliveryAddressId || 'add_new'}
                            onValueChange={(val: string) => {
                              if (val === 'add_new') {
                                setIsAddingWarehouse(true);
                                setSelectedDeliveryAddressId('');
                              } else {
                                setSelectedDeliveryAddressId(val);
                              }
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue>
                                {selectedDeliveryAddressId
                                  ? deliveryAddresses.find(
                                      (a) => a.id === selectedDeliveryAddressId
                                    )?.address || 'Выберите адрес'
                                  : 'Выберите или добавьте адрес'}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {deliveryAddresses.map((address) => (
                                <SelectItem key={address.id} value={address.id}>
                                  {address.name ? `${address.name}: ` : ''}
                                  {address.address}
                                  {address.is_default && ' (по умолчанию)'}
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
                              {deliveryAddresses.length > 0 && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setIsAddingWarehouse(false);
                                    setNewWarehouseAddress('');
                                    // Restore previous selection if any
                                    if (deliveryAddresses.length > 0) {
                                      const defaultAddr = deliveryAddresses.find(
                                        (a) => a.is_default
                                      );
                                      setSelectedDeliveryAddressId(
                                        defaultAddr?.id || deliveryAddresses[0].id
                                      );
                                    }
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
                    {deliveryAddresses.find((a) => a.id === selectedDeliveryAddressId)?.address ||
                      newWarehouseAddress}
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
                      {deliveryAddresses.find((a) => a.id === selectedDeliveryAddressId)?.address ||
                        newWarehouseAddress}
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
