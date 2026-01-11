'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X, ArrowRight, Building2, Truck } from 'lucide-react';


interface Warehouse {
  id: string;
  name: string;
  code: string;
  type: string;
}

interface Product {
  id: string;
  sku: string;
  name: string;
}

interface QuickTransferModalProps {
  open: boolean;
  onClose: () => void;
}

export function QuickTransferModal({ open, onClose }: QuickTransferModalProps) {
  const queryClient = useQueryClient();
  const [fromWarehouse, setFromWarehouse] = useState('');
  const [toWarehouse, setToWarehouse] = useState('');
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  const { data: warehousesData } = useQuery({
    queryKey: ['warehouses-for-transfer'],
    queryFn: async () => {
      const res = await fetch('/api/inventory/warehouses');
      return res.json();
    },
    enabled: open,
  });

  const { data: productsData } = useQuery({
    queryKey: ['products-for-transfer'],
    queryFn: async () => {
      const res = await fetch('/api/inventory/products?view=search');
      return res.json();
    },
    enabled: open,
  });

  const warehouses = warehousesData?.data?.warehouses as Warehouse[] | undefined;
  const products = productsData?.data?.products as Product[] | undefined;

  const officeWarehouses = warehouses?.filter((w) => w.type !== 'VEHICLE') || [];
  const vehicleWarehouses = warehouses?.filter((w) => w.type === 'VEHICLE') || [];

  const transferMutation = useMutation({
    mutationFn: async (data: {
      productId: string;
      fromWarehouseId: string;
      toWarehouseId: string;
      quantity: number;
      notes?: string;
    }) => {
      const res = await fetch('/api/inventory/stock/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Error al transferir');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouses'] });
      queryClient.invalidateQueries({ queryKey: ['stock'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      onClose();
      resetForm();
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const resetForm = () => {
    setFromWarehouse('');
    setToWarehouse('');
    setProductId('');
    setQuantity('1');
    setNotes('');
    setError('');
  };

  // Preset: Load vehicle from office
  const handleLoadVehicle = () => {
    if (officeWarehouses.length > 0) {
      setFromWarehouse(officeWarehouses[0].id);
      setToWarehouse('');
    }
  };

  // Preset: Return to office from vehicle
  const handleReturnToOffice = () => {
    if (officeWarehouses.length > 0) {
      setToWarehouse(officeWarehouses[0].id);
      setFromWarehouse('');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!fromWarehouse || !toWarehouse || !productId || !quantity) {
      setError('Todos los campos son requeridos');
      return;
    }

    if (fromWarehouse === toWarehouse) {
      setError('El origen y destino deben ser diferentes');
      return;
    }

    const qty = parseInt(quantity);
    if (isNaN(qty) || qty <= 0) {
      setError('La cantidad debe ser mayor a 0');
      return;
    }

    transferMutation.mutate({
      productId,
      fromWarehouseId: fromWarehouse,
      toWarehouseId: toWarehouse,
      quantity: qty,
      notes: notes || undefined,
    });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Transferir inventario</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Quick presets */}
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={handleLoadVehicle}
            className="flex-1 rounded-md border border-gray-200 p-3 text-sm hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center justify-center gap-2">
              <Building2 className="h-4 w-4 text-blue-500" />
              <ArrowRight className="h-3 w-3 text-gray-400" />
              <Truck className="h-4 w-4 text-purple-500" />
            </div>
            <span className="mt-1 block text-gray-600">Cargar vehículo</span>
          </button>
          <button
            type="button"
            onClick={handleReturnToOffice}
            className="flex-1 rounded-md border border-gray-200 p-3 text-sm hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center justify-center gap-2">
              <Truck className="h-4 w-4 text-purple-500" />
              <ArrowRight className="h-3 w-3 text-gray-400" />
              <Building2 className="h-4 w-4 text-blue-500" />
            </div>
            <span className="mt-1 block text-gray-600">Devolver a depósito</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* From Warehouse */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Desde</label>
            <select
              value={fromWarehouse}
              onChange={(e) => setFromWarehouse(e.target.value)}
              className="input mt-1 w-full"
              required
            >
              <option value="">Seleccionar origen</option>
              {officeWarehouses.length > 0 && (
                <optgroup label="Depósitos">
                  {officeWarehouses.map((w) => (
                    <option key={w.id} value={w.id} disabled={w.id === toWarehouse}>
                      {w.name}
                    </option>
                  ))}
                </optgroup>
              )}
              {vehicleWarehouses.length > 0 && (
                <optgroup label="Vehículos">
                  {vehicleWarehouses.map((w) => (
                    <option key={w.id} value={w.id} disabled={w.id === toWarehouse}>
                      {w.name}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>

          {/* To Warehouse */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Hacia</label>
            <select
              value={toWarehouse}
              onChange={(e) => setToWarehouse(e.target.value)}
              className="input mt-1 w-full"
              required
            >
              <option value="">Seleccionar destino</option>
              {officeWarehouses.length > 0 && (
                <optgroup label="Depósitos">
                  {officeWarehouses.map((w) => (
                    <option key={w.id} value={w.id} disabled={w.id === fromWarehouse}>
                      {w.name}
                    </option>
                  ))}
                </optgroup>
              )}
              {vehicleWarehouses.length > 0 && (
                <optgroup label="Vehículos">
                  {vehicleWarehouses.map((w) => (
                    <option key={w.id} value={w.id} disabled={w.id === fromWarehouse}>
                      {w.name}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>

          {/* Product */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Producto</label>
            <select
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              className="input mt-1 w-full"
              required
            >
              <option value="">Seleccionar producto</option>
              {products?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.sku})
                </option>
              ))}
            </select>
          </div>

          {/* Quantity */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Cantidad</label>
            <input
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="input mt-1 w-full"
              required
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Notas (opcional)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="input mt-1 w-full"
              placeholder="Motivo de la transferencia"
            />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex justify-end gap-2 pt-4">
            <button type="button" onClick={onClose} className="btn-outline">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={transferMutation.isPending}
              className="btn-primary"
            >
              {transferMutation.isPending ? 'Transfiriendo...' : 'Transferir'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
