/**
 * PricebookLineItems Component
 * 
 * Reusable component for adding items from the pricebook to a job.
 * Used in EditJobModal and Job Detail page for quoting after diagnosis.
 * 
 * Features:
 * - Search pricebook items
 * - Add items with quantity
 * - Update/remove items
 * - Display totals with IVA
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    Search,
    Trash2,
    Package,
    Wrench,
    DollarSign,
    AlertCircle,
    Loader2,
    Plus,
    ShoppingCart,
} from 'lucide-react';
import RelatedItemsSuggestions from './RelatedItemsSuggestions';

// Types
interface PriceItem {
    id: string;
    name: string;
    description?: string | null;
    type: 'SERVICE' | 'PRODUCT';
    price: number;
    unit?: string | null;
    taxRate: number;
    specialty?: string | null;
}

interface LineItem {
    id: string;
    priceItemId?: string | null;
    description: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    total: number;
    taxRate: number;
    taxAmount: number;
    notes?: string | null;
    priceItem?: {
        id: string;
        name: string;
        type: string;
    } | null;
}

interface LineItemsSummary {
    subtotal: number;
    tax: number;
    total: number;
    itemCount: number;
}

interface PricebookLineItemsProps {
    jobId: string;
    isLocked?: boolean;
    onTotalChange?: (total: number) => void;
    className?: string;
}

export function PricebookLineItems({
    jobId,
    isLocked = false,
    onTotalChange,
    className = '',
}: PricebookLineItemsProps) {
    const queryClient = useQueryClient();
    const [search, setSearch] = useState('');
    const [showDropdown, setShowDropdown] = useState(false);
    const [lastAddedItemId, setLastAddedItemId] = useState<string | null>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Fetch current line items
    const { data: lineItemsData, isLoading: loadingItems } = useQuery({
        queryKey: ['job-line-items', jobId],
        queryFn: async () => {
            const res = await fetch(`/api/jobs/${jobId}/line-items`);
            return res.json();
        },
        enabled: !!jobId,
    });

    const lineItems: LineItem[] = lineItemsData?.data?.items || [];
    const summary: LineItemsSummary = lineItemsData?.data?.summary || {
        subtotal: 0,
        tax: 0,
        total: 0,
        itemCount: 0,
    };

    // Fetch pricebook items
    const { data: pricebookData } = useQuery({
        queryKey: ['pricebook-items'],
        queryFn: async () => {
            const res = await fetch('/api/settings/pricebook?activeOnly=true');
            return res.json();
        },
        staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    });

    const pricebookItems: PriceItem[] = pricebookData?.data || [];

    // Filter pricebook items by search
    const filteredItems = pricebookItems.filter((item) =>
        search.length === 0 ||
        item.name.toLowerCase().includes(search.toLowerCase()) ||
        item.description?.toLowerCase().includes(search.toLowerCase())
    );

    // Add item mutation
    const addItemMutation = useMutation({
        mutationFn: async (priceItem: PriceItem) => {
            const res = await fetch(`/api/jobs/${jobId}/line-items`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    priceItemId: priceItem.id,
                    description: priceItem.name,
                    quantity: 1,
                    unit: priceItem.unit || 'unidad',
                    unitPrice: priceItem.price,
                    taxRate: priceItem.taxRate,
                    source: 'QUOTE',
                }),
            });
            return res.json();
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: ['job-line-items', jobId] });
            queryClient.invalidateQueries({ queryKey: ['job', jobId] });
            setLastAddedItemId(variables.id); // Track last added item for suggestions
            setSearch('');
            setShowDropdown(false);
        },
    });

    // Update quantity mutation
    const updateQuantityMutation = useMutation({
        mutationFn: async ({ itemId, quantity }: { itemId: string; quantity: number }) => {
            const res = await fetch(`/api/jobs/${jobId}/line-items/${itemId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ quantity }),
            });
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['job-line-items', jobId] });
            queryClient.invalidateQueries({ queryKey: ['job', jobId] });
        },
    });

    // Remove item mutation
    const removeItemMutation = useMutation({
        mutationFn: async (itemId: string) => {
            const res = await fetch(`/api/jobs/${jobId}/line-items/${itemId}`, {
                method: 'DELETE',
            });
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['job-line-items', jobId] });
            queryClient.invalidateQueries({ queryKey: ['job', jobId] });
        },
    });

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setShowDropdown(false);
            }
        };

        if (showDropdown) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showDropdown]);

    // Notify parent of total changes
    useEffect(() => {
        if (onTotalChange) {
            onTotalChange(summary.total);
        }
    }, [summary.total, onTotalChange]);

    if (loadingItems) {
        return (
            <div className={`flex items-center justify-center py-8 ${className}`}>
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
        );
    }

    return (
        <div className={`space-y-4 ${className}`}>
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <ShoppingCart className="h-5 w-5 text-emerald-600" />
                    <span className="text-sm font-medium text-gray-900">
                        Servicios y Productos
                    </span>
                </div>
                {isLocked && (
                    <span className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-full flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        Precio bloqueado
                    </span>
                )}
            </div>

            {/* Search Input */}
            {!isLocked && (
                <div className="relative" ref={dropdownRef}>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => {
                                setSearch(e.target.value);
                                setShowDropdown(true);
                            }}
                            onFocus={() => setShowDropdown(true)}
                            placeholder="Buscar servicio o producto..."
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                        />
                    </div>

                    {/* Dropdown */}
                    {showDropdown && filteredItems.length > 0 && (
                        <div className="absolute z-50 mt-1 w-full max-h-60 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg">
                            {filteredItems.slice(0, 10).map((item) => (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => addItemMutation.mutate(item)}
                                    disabled={addItemMutation.isPending}
                                    className="w-full p-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-0 flex justify-between items-center disabled:opacity-50"
                                >
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            {item.type === 'SERVICE' ? (
                                                <Wrench className="h-4 w-4 text-emerald-600" />
                                            ) : (
                                                <Package className="h-4 w-4 text-blue-600" />
                                            )}
                                            <span className="font-medium text-sm">{item.name}</span>
                                        </div>
                                        {item.description && (
                                            <p className="text-xs text-gray-500 mt-0.5 ml-6 line-clamp-1">
                                                {item.description}
                                            </p>
                                        )}
                                    </div>
                                    <div className="text-right ml-4 flex items-center gap-2">
                                        <span className="font-semibold text-emerald-600">
                                            ${item.price.toLocaleString('es-AR')}
                                        </span>
                                        <Plus className="h-4 w-4 text-gray-400" />
                                    </div>
                                </button>
                            ))}
                            {filteredItems.length > 10 && (
                                <div className="p-2 text-center text-xs text-gray-500">
                                    +{filteredItems.length - 10} más...
                                </div>
                            )}
                        </div>
                    )}

                    {/* No results */}
                    {showDropdown && search && filteredItems.length === 0 && pricebookItems.length > 0 && (
                        <div className="absolute z-50 mt-1 w-full p-4 bg-white border border-gray-200 rounded-lg shadow-lg text-center text-gray-500 text-sm">
                            No se encontró &ldquo;{search}&rdquo; en tu lista de precios
                        </div>
                    )}
                </div>
            )}

            {/* Line Items List */}
            {lineItems.length > 0 ? (
                <div className="space-y-2">
                    {lineItems.map((item) => (
                        <div key={item.id} className="bg-white rounded-lg border border-gray-200 p-3">
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                    <div className="font-medium text-sm text-gray-900">
                                        {item.description}
                                    </div>
                                    <div className="flex items-center gap-2 mt-2">
                                        <span className="text-xs text-gray-500">Cantidad:</span>
                                        {isLocked ? (
                                            <span className="text-sm font-medium">{item.quantity}</span>
                                        ) : (
                                            <input
                                                type="number"
                                                min="0.1"
                                                step="0.1"
                                                value={item.quantity}
                                                onChange={(e) => {
                                                    const qty = parseFloat(e.target.value) || 1;
                                                    updateQuantityMutation.mutate({ itemId: item.id, quantity: qty });
                                                }}
                                                className="w-16 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                                            />
                                        )}
                                        <span className="text-xs text-gray-500">{item.unit}</span>
                                        <span className="text-xs text-gray-400 mx-1">×</span>
                                        <span className="text-xs text-gray-600">
                                            ${item.unitPrice.toLocaleString('es-AR')}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="font-semibold text-emerald-600 whitespace-nowrap">
                                        ${item.total.toLocaleString('es-AR')}
                                    </span>
                                    {!isLocked && (
                                        <button
                                            type="button"
                                            onClick={() => removeItemMutation.mutate(item.id)}
                                            disabled={removeItemMutation.isPending}
                                            className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}

                    {/* Totals */}
                    <div className="bg-white rounded-lg border border-emerald-200 p-3 space-y-1">
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Subtotal</span>
                            <span>${summary.subtotal.toLocaleString('es-AR')}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-600">IVA</span>
                            <span>
                                ${summary.tax.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                            </span>
                        </div>
                        <div className="flex justify-between text-base font-bold border-t border-gray-200 pt-1 mt-1">
                            <span className="text-gray-900">Total</span>
                            <span className="text-emerald-600">
                                ${summary.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                            </span>
                        </div>
                    </div>

                    {/* Related Items Suggestions */}
                    {!isLocked && lastAddedItemId && (
                        <RelatedItemsSuggestions
                            priceItemId={lastAddedItemId}
                            excludeIds={lineItems.map((li) => li.priceItemId).filter((id): id is string => !!id)}
                            onAddItem={(item) => {
                                addItemMutation.mutate({
                                    id: item.id,
                                    name: item.name,
                                    description: item.description,
                                    type: item.type,
                                    price: item.price,
                                    unit: item.unit,
                                    taxRate: 21, // Default IVA
                                });
                            }}
                        />
                    )}
                </div>
            ) : (
                /* Empty State */
                <div className="text-center py-6 text-gray-500 text-sm bg-gray-50 rounded-lg border border-dashed border-gray-300">
                    <DollarSign className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                    <p>No hay items agregados</p>
                    {!isLocked && (
                        <p className="text-xs mt-1">
                            Buscá servicios o productos de tu lista de precios
                        </p>
                    )}
                </div>
            )}

            {/* Pricebook Empty State */}
            {pricebookItems.length === 0 && !isLocked && (
                <div className="text-center py-4">
                    <a
                        href="/dashboard/settings/pricebook"
                        target="_blank"
                        className="text-sm text-emerald-600 hover:underline"
                    >
                        Configurar lista de precios →
                    </a>
                </div>
            )}
        </div>
    );
}

export default PricebookLineItems;
