'use client';

/**
 * RelatedItemsSuggestions Component
 * ==================================
 * 
 * Shows item suggestions when a price item is added to a job.
 * Displays "Items frecuentemente agregados juntos" suggestions.
 */

import { useQuery } from '@tanstack/react-query';
import { Lightbulb, Plus, X } from 'lucide-react';
import { useState } from 'react';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface RelatedItem {
    id: string;
    name: string;
    description?: string | null;
    price: number;
    unit?: string | null;
    type: 'SERVICE' | 'PRODUCT';
}

interface Props {
    /** The price item ID to show suggestions for */
    priceItemId: string | null;
    /** Callback when user clicks to add a suggested item */
    onAddItem: (item: RelatedItem) => void;
    /** IDs of items already added (to avoid suggesting duplicates) */
    excludeIds?: string[];
    /** Allow user to dismiss suggestions */
    dismissable?: boolean;
    /** Custom class name */
    className?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export function RelatedItemsSuggestions({
    priceItemId,
    onAddItem,
    excludeIds = [],
    dismissable = true,
    className = '',
}: Props) {
    const [dismissed, setDismissed] = useState(false);

    // Fetch related items
    const { data: relatedItems, isLoading } = useQuery({
        queryKey: ['price-item-related', priceItemId],
        queryFn: async () => {
            if (!priceItemId) return [];
            const res = await fetch(`/api/pricebook/${priceItemId}/related?limit=5`);
            if (!res.ok) return [];
            const json = await res.json();
            return json.data as RelatedItem[];
        },
        enabled: !!priceItemId && !dismissed,
        staleTime: 5 * 60 * 1000, // 5 minutes
    });

    // Filter out already-added items
    const filteredItems = relatedItems?.filter(
        (item) => !excludeIds.includes(item.id)
    ) || [];

    // Don't render if no suggestions or loading
    if (!priceItemId || dismissed || isLoading || filteredItems.length === 0) {
        return null;
    }

    const formatPrice = (price: number) => {
        return new Intl.NumberFormat('es-AR', {
            style: 'currency',
            currency: 'ARS',
        }).format(price);
    };

    return (
        <div
            className={`
        mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg 
        animate-in fade-in slide-in-from-top-2 duration-300
        ${className}
      `}
        >
            {/* Header */}
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <Lightbulb className="h-4 w-4 text-blue-600" />
                    <p className="text-sm font-medium text-blue-800">
                        💡 Items frecuentemente agregados juntos:
                    </p>
                </div>
                {dismissable && (
                    <button
                        onClick={() => setDismissed(true)}
                        className="p-1 hover:bg-blue-100 rounded transition-colors"
                        aria-label="Cerrar sugerencias"
                    >
                        <X className="h-4 w-4 text-blue-400 hover:text-blue-600" />
                    </button>
                )}
            </div>

            {/* Suggestions */}
            <div className="flex flex-wrap gap-2">
                {filteredItems.map((item) => (
                    <button
                        key={item.id}
                        onClick={() => {
                            onAddItem(item);
                        }}
                        className="
              group flex items-center gap-1.5 
              text-sm px-3 py-1.5 
              bg-white rounded-full 
              border border-blue-200 
              hover:border-blue-400 hover:bg-blue-50
              transition-all duration-200
              shadow-sm hover:shadow
            "
                    >
                        <Plus className="h-3.5 w-3.5 text-blue-500 group-hover:text-blue-600" />
                        <span className="font-medium text-gray-700 group-hover:text-gray-900">
                            {item.name}
                        </span>
                        <span className="text-xs text-gray-500">
                            {formatPrice(item.price)}
                        </span>
                    </button>
                ))}
            </div>

            {/* Optional: Show hint for first-time users */}
            <p className="mt-2 text-xs text-blue-500/70">
                Click para agregar a la cotización
            </p>
        </div>
    );
}

export default RelatedItemsSuggestions;
