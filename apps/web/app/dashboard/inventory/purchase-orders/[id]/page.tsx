'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import {
  ArrowLeft,
  X,
  Calendar,
  User,
  Package,
  Send,
} from 'lucide-react';

interface PurchaseOrder {
  id: string;
  orderNumber: string;
  supplierId: string;
  supplierName: string;
  status: string;
  subtotal: number;
  taxAmount: number;
  shippingCost: number;
  totalAmount: number;
  expectedDeliveryDate?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  items: PurchaseOrderItem[];
}

interface PurchaseOrderItem {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  quantity: number;
  receivedQty: number;
  unitCost: number;
  lineTotal: number;
}

interface Supplier {
  id: string;
  name: string;
}

const PO_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Borrador',
  PENDING_APPROVAL: 'Pendiente aprobación',
  APPROVED: 'Aprobado',
  SENT: 'Enviado',
  PARTIALLY_RECEIVED: 'Recibido parcial',
  RECEIVED: 'Recibido',
  CANCELLED: 'Cancelado',
};

const PO_STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-800',
  PENDING_APPROVAL: 'bg-yellow-100 text-yellow-800',
  APPROVED: 'bg-blue-100 text-blue-800',
  SENT: 'bg-purple-100 text-purple-800',
  PARTIALLY_RECEIVED: 'bg-orange-100 text-orange-800',
  RECEIVED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800',
};

const STATUS_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['PENDING_APPROVAL', 'CANCELLED'],
  PENDING_APPROVAL: ['APPROVED', 'DRAFT', 'CANCELLED'],
  APPROVED: ['SENT', 'CANCELLED'],
  SENT: ['PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED'],
  PARTIALLY_RECEIVED: ['RECEIVED'],
  RECEIVED: [],
  CANCELLED: ['DRAFT'],
};

export default function PurchaseOrderDetailPage() {
  const params = useParams();
  const _router = useRouter();
  const queryClient = useQueryClient();
  const poId = params.id as string;

  const [isEditing, setIsEditing] = useState(false);
  const [_editData, _setEditData] = useState<Partial<PurchaseOrder>>({});
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [receiveQuantities, setReceiveQuantities] = useState<Record<string, number>>({});

  const { data, isLoading, error } = useQuery({
    queryKey: ['purchase-order', poId],
    queryFn: async () => {
      const res = await fetch(`/api/inventory/purchase-orders?id=${poId}`);
      return res.json();
    },
  });

  const { data: suppliersData } = useQuery({
    queryKey: ['suppliers-list'],
    queryFn: async () => {
      const res = await fetch('/api/inventory/suppliers');
      return res.json();
    },
    enabled: isEditing,
  });

  const _updateMutation = useMutation({
    mutationFn: async (data: Partial<PurchaseOrder>) => {
      const res = await fetch('/api/inventory/purchase-orders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: poId, ...data }),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-order', poId] });
      setIsEditing(false);
    },
  });

  const statusMutation = useMutation({
    mutationFn: async (status: string) => {
      const res = await fetch('/api/inventory/purchase-orders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: poId, status }),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-order', poId] });
    },
  });

  const receiveMutation = useMutation({
    mutationFn: async (items: Array<{ itemId: string; quantity: number }>) => {
      const res = await fetch('/api/inventory/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'receive', orderId: poId, items }),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-order', poId] });
      setShowReceiveModal(false);
      setReceiveQuantities({});
    },
  });

  const order = data?.data?.order as PurchaseOrder | undefined;
  const _suppliers = suppliersData?.data?.suppliers as Supplier[] | undefined;

  const handleStatusChange = (newStatus: string) => {
    if (confirm(`¿Cambiar estado a "${PO_STATUS_LABELS[newStatus]}"?`)) {
      statusMutation.mutate(newStatus);
    }
  };

  const handleReceive = () => {
    const items = Object.entries(receiveQuantities)
      .filter(([_, qty]) => qty > 0)
      .map(([itemId, quantity]) => ({ itemId, quantity }));

    if (items.length === 0) {
      alert('Ingresá las cantidades a recibir');
      return;
    }

    receiveMutation.mutate(items);
  };

  const openReceiveModal = () => {
    if (order) {
      const initialQuantities: Record<string, number> = {};
      order.items.forEach((item) => {
        const remaining = item.quantity - item.receivedQty;
        initialQuantities[item.id] = remaining > 0 ? remaining : 0;
      });
      setReceiveQuantities(initialQuantities);
      setShowReceiveModal(true);
    }
  };

  const getNextActions = () => {
    if (!order) return [];
    const transitions = STATUS_TRANSITIONS[order.status] || [];
    return transitions.map((status) => ({
      status,
      label: PO_STATUS_LABELS[status],
    }));
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/inventory/purchase-orders"
            className="rounded-md p-2 text-gray-500 hover:bg-gray-100"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Orden no encontrada</h1>
          </div>
        </div>
        <div className="card p-8 text-center">
          <p className="text-gray-500">Esta orden de compra no existe.</p>
          <Link href="/dashboard/inventory/purchase-orders" className="btn-primary mt-4 inline-flex">
            Volver a órdenes
          </Link>
        </div>
      </div>
    );
  }

  const nextActions = getNextActions();
  const canReceive = ['SENT', 'PARTIALLY_RECEIVED'].includes(order.status);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/inventory/purchase-orders"
          className="rounded-md p-2 text-gray-500 hover:bg-gray-100"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{order.orderNumber}</h1>
            <span
              className={cn(
                'rounded-full px-3 py-1 text-sm font-medium',
                PO_STATUS_COLORS[order.status]
              )}
            >
              {PO_STATUS_LABELS[order.status]}
            </span>
          </div>
          <p className="text-gray-500">{order.supplierName}</p>
        </div>
        <div className="flex gap-2">
          {canReceive && (
            <button onClick={openReceiveModal} className="btn-primary">
              <Package className="mr-2 h-4 w-4" />
              Recibir mercadería
            </button>
          )}
          {order.status === 'DRAFT' && (
            <button
              onClick={() => handleStatusChange('PENDING_APPROVAL')}
              className="btn-outline"
            >
              <Send className="mr-2 h-4 w-4" />
              Enviar a aprobar
            </button>
          )}
        </div>
      </div>

      {/* Status actions */}
      {nextActions.length > 0 && (
        <div className="card p-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-gray-700">Cambiar estado:</span>
            {nextActions.map(({ status, label }) => (
              <button
                key={status}
                onClick={() => handleStatusChange(status)}
                disabled={statusMutation.isPending}
                className={cn(
                  'rounded-md px-4 py-2 text-sm font-medium',
                  status === 'CANCELLED'
                    ? 'bg-red-100 text-red-700 hover:bg-red-200'
                    : 'btn-outline'
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Order items */}
          <div className="card p-6">
            <h2 className="mb-4 font-medium text-gray-900">Items de la orden</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left text-sm text-gray-500">
                    <th className="pb-3 font-medium">Producto</th>
                    <th className="pb-3 font-medium text-right">Cantidad</th>
                    <th className="pb-3 font-medium text-right">Recibido</th>
                    <th className="pb-3 font-medium text-right">Costo unit.</th>
                    <th className="pb-3 font-medium text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {order.items.map((item) => (
                    <tr key={item.id}>
                      <td className="py-3">
                        <div>
                          <p className="font-medium text-gray-900">{item.productName}</p>
                          <p className="text-sm text-gray-500">{item.productSku}</p>
                        </div>
                      </td>
                      <td className="py-3 text-right">{item.quantity}</td>
                      <td className="py-3 text-right">
                        <span
                          className={cn(
                            item.receivedQty >= item.quantity
                              ? 'text-green-600'
                              : item.receivedQty > 0
                                ? 'text-orange-600'
                                : 'text-gray-500'
                          )}
                        >
                          {item.receivedQty}
                        </span>
                      </td>
                      <td className="py-3 text-right">{formatCurrency(item.unitCost)}</td>
                      <td className="py-3 text-right font-medium">
                        {formatCurrency(item.lineTotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Notes */}
          {order.notes && (
            <div className="card p-6">
              <h2 className="mb-4 font-medium text-gray-900">Notas</h2>
              <p className="text-gray-700">{order.notes}</p>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Totals */}
          <div className="card p-6">
            <h2 className="mb-4 font-medium text-gray-900">Totales</h2>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Subtotal</span>
                <span className="text-gray-900">{formatCurrency(order.subtotal)}</span>
              </div>
              {order.taxAmount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">IVA</span>
                  <span className="text-gray-900">{formatCurrency(order.taxAmount)}</span>
                </div>
              )}
              {order.shippingCost > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Envío</span>
                  <span className="text-gray-900">{formatCurrency(order.shippingCost)}</span>
                </div>
              )}
              <div className="flex justify-between border-t pt-3 font-medium">
                <span className="text-gray-900">Total</span>
                <span className="text-gray-900">{formatCurrency(order.totalAmount)}</span>
              </div>
            </div>
          </div>

          {/* Delivery info */}
          <div className="card p-6">
            <h2 className="mb-4 font-medium text-gray-900">Información de entrega</h2>
            <div className="space-y-3">
              {order.expectedDeliveryDate && (
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">Fecha esperada</p>
                    <p className="font-medium text-gray-900">
                      {formatDate(order.expectedDeliveryDate)}
                    </p>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-3">
                <User className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">Proveedor</p>
                  <p className="font-medium text-gray-900">{order.supplierName}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Timestamps */}
          <div className="card p-6">
            <h2 className="mb-4 font-medium text-gray-900">Historial</h2>
            <div className="space-y-2 text-sm text-gray-500">
              <div className="flex justify-between">
                <span>Creado</span>
                <span>{new Date(order.createdAt).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Actualizado</span>
                <span>{new Date(order.updatedAt).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Receive Modal */}
      {showReceiveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="card max-h-[80vh] w-full max-w-2xl overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">Recibir mercadería</h2>
              <button
                onClick={() => setShowReceiveModal(false)}
                className="rounded-md p-1 text-gray-500 hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              {order.items.map((item) => {
                const remaining = item.quantity - item.receivedQty;
                if (remaining <= 0) return null;

                return (
                  <div key={item.id} className="flex items-center justify-between rounded-lg border p-4">
                    <div>
                      <p className="font-medium text-gray-900">{item.productName}</p>
                      <p className="text-sm text-gray-500">
                        Pendiente: {remaining} de {item.quantity}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        max={remaining}
                        value={receiveQuantities[item.id] || 0}
                        onChange={(e) =>
                          setReceiveQuantities({
                            ...receiveQuantities,
                            [item.id]: parseInt(e.target.value) || 0,
                          })
                        }
                        className="input w-24 text-center"
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button onClick={() => setShowReceiveModal(false)} className="btn-outline">
                Cancelar
              </button>
              <button
                onClick={handleReceive}
                disabled={receiveMutation.isPending}
                className="btn-primary"
              >
                {receiveMutation.isPending ? 'Recibiendo...' : 'Confirmar recepción'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
