'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import {
  ArrowLeft,
  Play,
  CheckCircle,
  XCircle,
  Save,
  Package,
  AlertTriangle,
  Clock,
} from 'lucide-react';

interface InventoryCount {
  id: string;
  countNumber: string;
  warehouseName: string;
  countType: string;
  status: string;
  scheduledAt?: string;
  startedAt?: string;
  completedAt?: string;
  assignedToName?: string;
  notes?: string;
  items: InventoryCountItem[];
}

interface InventoryCountItem {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  expectedQty: number;
  countedQty: number | null;
  variance: number | null;
  notes?: string;
}

const COUNT_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Borrador',
  IN_PROGRESS: 'En progreso',
  PENDING_REVIEW: 'Pendiente revisión',
  APPROVED: 'Aprobado',
  CANCELLED: 'Cancelado',
};

const COUNT_STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-800',
  IN_PROGRESS: 'bg-blue-100 text-blue-800',
  PENDING_REVIEW: 'bg-yellow-100 text-yellow-800',
  APPROVED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800',
};

export default function InventoryCountDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const countId = params.id as string;

  const [countedQuantities, setCountedQuantities] = useState<Record<string, number>>({});
  const [itemNotes, setItemNotes] = useState<Record<string, string>>({});

  const { data, isLoading, error } = useQuery({
    queryKey: ['inventory-count', countId],
    queryFn: async () => {
      const res = await fetch(`/api/inventory/stock?view=count&countId=${countId}`);
      return res.json();
    },
  });

  const startMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/inventory/stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'startCount', countId }),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-count', countId] });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const items = Object.entries(countedQuantities).map(([itemId, qty]) => ({
        itemId,
        countedQty: qty,
        notes: itemNotes[itemId] || undefined,
      }));
      const res = await fetch('/api/inventory/stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'updateCountItems', countId, items }),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-count', countId] });
    },
  });

  const completeMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/inventory/stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'completeCount', countId }),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-count', countId] });
    },
  });

  const approveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/inventory/stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approveCount', countId }),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-count', countId] });
      router.push('/dashboard/inventory/stock');
    },
  });

  const count = data?.data?.count as InventoryCount | undefined;

  // Initialize counted quantities from existing data
  if (count && Object.keys(countedQuantities).length === 0) {
    const initial: Record<string, number> = {};
    const initialNotes: Record<string, string> = {};
    count.items.forEach((item) => {
      if (item.countedQty !== null) {
        initial[item.id] = item.countedQty;
      }
      if (item.notes) {
        initialNotes[item.id] = item.notes;
      }
    });
    if (Object.keys(initial).length > 0) {
      setCountedQuantities(initial);
    }
    if (Object.keys(initialNotes).length > 0) {
      setItemNotes(initialNotes);
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  if (error || !count) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/inventory/stock"
            className="rounded-md p-2 text-gray-500 hover:bg-gray-100"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Conteo no encontrado</h1>
        </div>
      </div>
    );
  }

  const countedItems = count.items.filter((i) => countedQuantities[i.id] !== undefined).length;
  const totalItems = count.items.length;
  const progress = totalItems > 0 ? Math.round((countedItems / totalItems) * 100) : 0;

  const hasVariances = count.items.some(
    (i) => countedQuantities[i.id] !== undefined && countedQuantities[i.id] !== i.expectedQty
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/inventory/stock"
          className="rounded-md p-2 text-gray-500 hover:bg-gray-100"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{count.countNumber}</h1>
            <span
              className={cn(
                'rounded-full px-3 py-1 text-sm font-medium',
                COUNT_STATUS_COLORS[count.status]
              )}
            >
              {COUNT_STATUS_LABELS[count.status]}
            </span>
          </div>
          <p className="text-gray-500">{count.warehouseName}</p>
        </div>
        <div className="flex gap-2">
          {count.status === 'DRAFT' && (
            <button
              onClick={() => startMutation.mutate()}
              disabled={startMutation.isPending}
              className="btn-primary"
            >
              <Play className="mr-2 h-4 w-4" />
              Iniciar conteo
            </button>
          )}
          {count.status === 'IN_PROGRESS' && (
            <>
              <button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
                className="btn-outline"
              >
                <Save className="mr-2 h-4 w-4" />
                Guardar
              </button>
              <button
                onClick={() => completeMutation.mutate()}
                disabled={completeMutation.isPending || countedItems < totalItems}
                className="btn-primary"
              >
                <CheckCircle className="mr-2 h-4 w-4" />
                Completar
              </button>
            </>
          )}
          {count.status === 'PENDING_REVIEW' && (
            <button
              onClick={() => approveMutation.mutate()}
              disabled={approveMutation.isPending}
              className="btn-primary"
            >
              <CheckCircle className="mr-2 h-4 w-4" />
              Aprobar y aplicar
            </button>
          )}
        </div>
      </div>

      {/* Progress */}
      {count.status === 'IN_PROGRESS' && (
        <div className="card p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Progreso del conteo</span>
            <span className="text-sm text-gray-500">
              {countedItems} de {totalItems} productos ({progress}%)
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-gray-200">
            <div
              className="h-2 rounded-full bg-primary-500 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Items */}
      <div className="card">
        <div className="border-b px-6 py-4">
          <h2 className="font-medium text-gray-900">Productos a contar</h2>
        </div>
        <div className="divide-y">
          {count.items.map((item) => {
            const counted = countedQuantities[item.id];
            const variance = counted !== undefined ? counted - item.expectedQty : null;

            return (
              <div key={item.id} className="p-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100">
                    <Package className="h-5 w-5 text-gray-500" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{item.productName}</p>
                    <p className="text-sm text-gray-500">{item.productSku}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500">Esperado</p>
                    <p className="font-medium text-gray-900">{item.expectedQty}</p>
                  </div>
                  <div className="w-32">
                    <input
                      type="number"
                      min="0"
                      value={countedQuantities[item.id] ?? ''}
                      onChange={(e) =>
                        setCountedQuantities({
                          ...countedQuantities,
                          [item.id]: parseInt(e.target.value) || 0,
                        })
                      }
                      disabled={count.status !== 'IN_PROGRESS'}
                      placeholder="Contado"
                      className="input text-center"
                    />
                  </div>
                  <div className="w-20 text-right">
                    {variance !== null && (
                      <span
                        className={cn(
                          'font-medium',
                          variance === 0
                            ? 'text-green-600'
                            : variance > 0
                              ? 'text-blue-600'
                              : 'text-red-600'
                        )}
                      >
                        {variance > 0 ? '+' : ''}
                        {variance}
                      </span>
                    )}
                  </div>
                </div>
                {count.status === 'IN_PROGRESS' && variance !== 0 && variance !== null && (
                  <div className="mt-2 ml-14">
                    <input
                      type="text"
                      value={itemNotes[item.id] || ''}
                      onChange={(e) =>
                        setItemNotes({ ...itemNotes, [item.id]: e.target.value })
                      }
                      placeholder="Nota sobre la diferencia..."
                      className="input text-sm"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Summary */}
      {(count.status === 'PENDING_REVIEW' || count.status === 'APPROVED') && (
        <div className="card p-6">
          <h2 className="mb-4 font-medium text-gray-900">Resumen del conteo</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg bg-green-50 p-4">
              <p className="text-sm text-green-600">Sin diferencias</p>
              <p className="text-2xl font-bold text-green-700">
                {count.items.filter((i) => i.variance === 0).length}
              </p>
            </div>
            <div className="rounded-lg bg-blue-50 p-4">
              <p className="text-sm text-blue-600">Sobrantes</p>
              <p className="text-2xl font-bold text-blue-700">
                {count.items.filter((i) => (i.variance ?? 0) > 0).length}
              </p>
            </div>
            <div className="rounded-lg bg-red-50 p-4">
              <p className="text-sm text-red-600">Faltantes</p>
              <p className="text-2xl font-bold text-red-700">
                {count.items.filter((i) => (i.variance ?? 0) < 0).length}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
