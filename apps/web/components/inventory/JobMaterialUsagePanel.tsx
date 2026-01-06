/**
 * JobMaterialUsagePanel Component
 * =================================
 *
 * Phase 2.2 Task 2.2.2: Complete Material Usage Integration
 *
 * A complete panel for job material usage that includes:
 * - Product search and selection
 * - Quantity input
 * - Cascade mode vs manual override
 * - Availability checking
 */

'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    Plus,
    Search,
    Trash2,
    Truck,
    Building2,
    Package,
    AlertTriangle,
    Check,
    RefreshCw,
    Info,
    X,
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface Product {
    id: string;
    name: string;
    sku: string;
    barcode?: string;
    unitPrice?: number;
}

interface SelectedMaterial {
    productId: string;
    productName: string;
    quantity: number;
}

interface Vehicle {
    id: string;
    plateNumber: string;
    make: string;
    model: string;
}

interface Warehouse {
    id: string;
    name: string;
    code: string;
}

interface DeductionResult {
    productId: string;
    productName?: string;
    quantity: number;
    source: 'vehicle' | 'warehouse';
    sourceId?: string;
    sourceName?: string;
}

interface JobMaterialUsagePanelProps {
    jobId: string;
    onSuccess?: (summary: string, deductions: DeductionResult[]) => void;
    onError?: (error: string) => void;
    className?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export function JobMaterialUsagePanel({
    jobId,
    onSuccess,
    onError,
    className = '',
}: JobMaterialUsagePanelProps) {
    const queryClient = useQueryClient();

    // Product search and selection state
    const [searchQuery, setSearchQuery] = useState('');
    const [showSearch, setShowSearch] = useState(false);
    const [selectedMaterials, setSelectedMaterials] = useState<SelectedMaterial[]>([]);

    // Mode selection state
    const [useManualSelection, setUseManualSelection] = useState(false);
    const [manualSource, setManualSource] = useState<'vehicle' | 'warehouse'>('vehicle');
    const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('');

    // Fetch products for search
    const { data: productsData, isLoading: productsLoading } = useQuery({
        queryKey: ['products-search', searchQuery],
        queryFn: async () => {
            const res = await fetch(`/api/inventory/products?search=${encodeURIComponent(searchQuery)}&limit=10`);
            return res.json();
        },
        enabled: searchQuery.length >= 2,
    });

    // Fetch warehouses for manual selection
    const { data: warehousesData } = useQuery({
        queryKey: ['warehouses'],
        queryFn: async () => {
            const res = await fetch('/api/inventory/warehouses');
            return res.json();
        },
        enabled: useManualSelection && manualSource === 'warehouse',
    });

    // Submit mutation
    const submitUsage = useMutation({
        mutationFn: async () => {
            const payload: Record<string, unknown> = {
                action: 'useCascade',
                jobId,
                items: selectedMaterials.map((m) => ({ productId: m.productId, quantity: m.quantity })),
            };

            if (useManualSelection) {
                payload.manualOverride = true;
                if (manualSource === 'vehicle') {
                    payload.forceVehicle = true;
                } else {
                    payload.forceWarehouse = true;
                    payload.warehouseId = selectedWarehouseId;
                }
            }

            const res = await fetch('/api/inventory/job-materials', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            return res.json();
        },
        onSuccess: (data) => {
            if (data.success) {
                queryClient.invalidateQueries({ queryKey: ['job-materials'] });
                setSelectedMaterials([]);
                onSuccess?.(data.message || data.data?.summary, data.data?.deductions || []);
            } else {
                onError?.(data.error || 'Error al registrar uso de materiales');
            }
        },
        onError: (error) => {
            onError?.(error instanceof Error ? error.message : 'Error desconocido');
        },
    });

    const products = (productsData?.data || []) as Product[];
    const warehouses = (warehousesData?.data || []) as Warehouse[];

    // Add product to selected list
    const addProduct = (product: Product) => {
        if (!selectedMaterials.find((m) => m.productId === product.id)) {
            setSelectedMaterials([
                ...selectedMaterials,
                { productId: product.id, productName: product.name, quantity: 1 },
            ]);
        }
        setSearchQuery('');
        setShowSearch(false);
    };

    // Update quantity
    const updateQuantity = (productId: string, quantity: number) => {
        setSelectedMaterials(
            selectedMaterials.map((m) =>
                m.productId === productId ? { ...m, quantity: Math.max(1, quantity) } : m
            )
        );
    };

    // Remove product
    const removeProduct = (productId: string) => {
        setSelectedMaterials(selectedMaterials.filter((m) => m.productId !== productId));
    };

    return (
        <div className={`space-y-4 ${className}`}>
            {/* Product Selection */}
            <div className="rounded-lg border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="font-medium text-gray-900">Materiales a registrar</h3>
                    {!showSearch && (
                        <button
                            type="button"
                            onClick={() => setShowSearch(true)}
                            className="inline-flex items-center gap-1 text-sm text-primary-600 hover:underline"
                        >
                            <Plus className="h-4 w-4" />
                            Agregar material
                        </button>
                    )}
                </div>

                {/* Search Input */}
                {showSearch && (
                    <div className="relative mb-3">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Buscar por nombre o código..."
                            className="input pl-10 pr-10"
                            autoFocus
                        />
                        <button
                            type="button"
                            onClick={() => {
                                setShowSearch(false);
                                setSearchQuery('');
                            }}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                            <X className="h-4 w-4" />
                        </button>

                        {/* Search Results */}
                        {searchQuery.length >= 2 && (
                            <div className="absolute z-10 mt-1 w-full rounded-md border bg-white shadow-lg max-h-48 overflow-y-auto">
                                {productsLoading ? (
                                    <div className="flex items-center gap-2 px-4 py-3 text-gray-500">
                                        <RefreshCw className="h-4 w-4 animate-spin" />
                                        <span>Buscando...</span>
                                    </div>
                                ) : products.length > 0 ? (
                                    products.map((product) => (
                                        <button
                                            key={product.id}
                                            type="button"
                                            onClick={() => addProduct(product)}
                                            disabled={selectedMaterials.some((m) => m.productId === product.id)}
                                            className="flex w-full items-center justify-between px-4 py-2 text-left hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <div>
                                                <p className="font-medium text-gray-900">{product.name}</p>
                                                <p className="text-xs text-gray-500">{product.sku}</p>
                                            </div>
                                            {selectedMaterials.some((m) => m.productId === product.id) && (
                                                <span className="text-xs text-green-600">Agregado</span>
                                            )}
                                        </button>
                                    ))
                                ) : (
                                    <p className="px-4 py-3 text-gray-500 text-sm">No se encontraron productos</p>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Selected Materials List */}
                {selectedMaterials.length > 0 ? (
                    <div className="space-y-2">
                        {selectedMaterials.map((material) => (
                            <div
                                key={material.productId}
                                className="flex items-center justify-between rounded-md bg-gray-50 p-3"
                            >
                                <div className="flex-1">
                                    <p className="font-medium text-gray-900">{material.productName}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => updateQuantity(material.productId, material.quantity - 1)}
                                        className="h-8 w-8 rounded-md border border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
                                    >
                                        -
                                    </button>
                                    <input
                                        type="number"
                                        min={1}
                                        value={material.quantity}
                                        onChange={(e) => updateQuantity(material.productId, parseInt(e.target.value) || 1)}
                                        className="h-8 w-16 rounded-md border border-gray-300 text-center text-sm"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => updateQuantity(material.productId, material.quantity + 1)}
                                        className="h-8 w-8 rounded-md border border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
                                    >
                                        +
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => removeProduct(material.productId)}
                                        className="ml-2 text-red-500 hover:text-red-700"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-center text-gray-500 text-sm py-4">
                        No hay materiales seleccionados
                    </p>
                )}
            </div>

            {/* Mode Selection */}
            {selectedMaterials.length > 0 && (
                <div className="rounded-lg border border-gray-200 p-4">
                    <label className="flex items-center gap-3 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={useManualSelection}
                            onChange={(e) => setUseManualSelection(e.target.checked)}
                            className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                        />
                        <div>
                            <span className="font-medium text-gray-900">Seleccionar origen manualmente</span>
                            <p className="text-sm text-gray-500">
                                Por defecto, los materiales se deducen automáticamente
                            </p>
                        </div>
                    </label>

                    {/* Auto Cascade Info */}
                    {!useManualSelection && (
                        <div className="mt-3 flex items-start gap-2 rounded-lg bg-blue-50 p-3">
                            <Info className="mt-0.5 h-4 w-4 text-blue-600 flex-shrink-0" />
                            <p className="text-sm text-blue-700">
                                Los materiales se deducirán automáticamente del{' '}
                                <strong>vehículo asignado</strong> al técnico.
                                Si no hay stock suficiente, se usará el <strong>depósito</strong>.
                            </p>
                        </div>
                    )}

                    {/* Manual Source Selection */}
                    {useManualSelection && (
                        <div className="mt-4 space-y-3">
                            {/* Vehicle Option */}
                            <label
                                className={`flex items-center gap-3 rounded-lg border-2 p-3 cursor-pointer transition-colors ${manualSource === 'vehicle'
                                    ? 'border-primary-500 bg-primary-50'
                                    : 'border-gray-200 hover:bg-gray-50'
                                    }`}
                            >
                                <input
                                    type="radio"
                                    name="manualSource"
                                    value="vehicle"
                                    checked={manualSource === 'vehicle'}
                                    onChange={() => setManualSource('vehicle')}
                                    className="sr-only"
                                />
                                <Truck className={`h-5 w-5 ${manualSource === 'vehicle' ? 'text-primary-600' : 'text-gray-400'}`} />
                                <div className="flex-1">
                                    <span className={`font-medium ${manualSource === 'vehicle' ? 'text-primary-900' : 'text-gray-700'}`}>
                                        Deducir solo de vehículo
                                    </span>
                                    <p className="text-sm text-gray-500">Del vehículo asignado al trabajo</p>
                                </div>
                                {manualSource === 'vehicle' && (
                                    <Check className="h-5 w-5 text-primary-600" />
                                )}
                            </label>

                            {/* Warehouse Option */}
                            <label
                                className={`flex items-center gap-3 rounded-lg border-2 p-3 cursor-pointer transition-colors ${manualSource === 'warehouse'
                                    ? 'border-primary-500 bg-primary-50'
                                    : 'border-gray-200 hover:bg-gray-50'
                                    }`}
                            >
                                <input
                                    type="radio"
                                    name="manualSource"
                                    value="warehouse"
                                    checked={manualSource === 'warehouse'}
                                    onChange={() => setManualSource('warehouse')}
                                    className="sr-only"
                                />
                                <Building2 className={`h-5 w-5 ${manualSource === 'warehouse' ? 'text-primary-600' : 'text-gray-400'}`} />
                                <div className="flex-1">
                                    <span className={`font-medium ${manualSource === 'warehouse' ? 'text-primary-900' : 'text-gray-700'}`}>
                                        Deducir solo de depósito
                                    </span>
                                    <p className="text-sm text-gray-500">Seleccionar depósito de origen</p>
                                </div>
                                {manualSource === 'warehouse' && (
                                    <Check className="h-5 w-5 text-primary-600" />
                                )}
                            </label>

                            {/* Warehouse Selector */}
                            {manualSource === 'warehouse' && (
                                <div className="ml-8">
                                    <select
                                        value={selectedWarehouseId}
                                        onChange={(e) => setSelectedWarehouseId(e.target.value)}
                                        className="input w-full"
                                    >
                                        <option value="">Seleccionar depósito...</option>
                                        {warehouses.map((w) => (
                                            <option key={w.id} value={w.id}>
                                                {w.name} ({w.code})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Submit Button */}
            {selectedMaterials.length > 0 && (
                <button
                    type="button"
                    onClick={() => submitUsage.mutate()}
                    disabled={
                        submitUsage.isPending ||
                        selectedMaterials.length === 0 ||
                        (useManualSelection && manualSource === 'warehouse' && !selectedWarehouseId)
                    }
                    className="btn-primary w-full"
                >
                    {submitUsage.isPending ? (
                        <span className="flex items-center gap-2">
                            <RefreshCw className="h-4 w-4 animate-spin" />
                            Registrando uso...
                        </span>
                    ) : (
                        `Registrar ${selectedMaterials.length} material${selectedMaterials.length > 1 ? 'es' : ''}`
                    )}
                </button>
            )}
        </div>
    );
}
