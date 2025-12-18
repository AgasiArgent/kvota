'use client';

import React from 'react';
import { Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';

import { WarehouseAddress } from '@/types/contracts';

interface WarehouseAddressesProps {
  addresses: WarehouseAddress[];
  onChange: (addresses: WarehouseAddress[]) => void;
  disabled?: boolean;
}

export default function WarehouseAddresses({
  addresses,
  onChange,
  disabled = false,
}: WarehouseAddressesProps) {
  const handleAddAddress = () => {
    onChange([...addresses, { name: '', address: '' }]);
  };

  const handleRemoveAddress = (index: number) => {
    onChange(addresses.filter((_, i) => i !== index));
  };

  const handleUpdateAddress = (index: number, field: keyof WarehouseAddress, value: string) => {
    const updated = [...addresses];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Адреса складов покупателя</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAddAddress}
          disabled={disabled}
        >
          <Plus className="h-4 w-4 mr-2" />
          Добавить склад
        </Button>
      </div>

      {addresses.length === 0 ? (
        <Card className="bg-secondary/50 border-border">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground text-center">
              Нет складов. Добавьте адрес склада для спецификации.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {addresses.map((warehouse, index) => (
            <Card key={index} className="bg-card border-border">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="flex-1 space-y-3">
                    <div className="space-y-1">
                      <Label htmlFor={`warehouse-name-${index}`} className="text-xs">
                        Название склада
                      </Label>
                      <Input
                        id={`warehouse-name-${index}`}
                        value={warehouse.name}
                        onChange={(e) => handleUpdateAddress(index, 'name', e.target.value)}
                        placeholder="Например: Основной склад"
                        disabled={disabled}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`warehouse-address-${index}`} className="text-xs">
                        Адрес склада
                      </Label>
                      <Input
                        id={`warehouse-address-${index}`}
                        value={warehouse.address}
                        onChange={(e) => handleUpdateAddress(index, 'address', e.target.value)}
                        placeholder="Например: г. Москва, ул. Ленина, д. 1"
                        disabled={disabled}
                      />
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveAddress(index)}
                    disabled={disabled}
                    className="h-8 w-8 p-0 text-rose-400 hover:text-rose-300 mt-6"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Адреса складов используются в спецификациях для указания места поставки товара.
      </p>
    </div>
  );
}
