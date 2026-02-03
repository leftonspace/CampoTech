'use client';

/**
 * Global Search Component
 * 
 * A comprehensive search that appears in the dashboard header.
 * 
 * Smart behavior:
 * - When category matches current page → filters page directly (no dropdown) + shows page-specific filters
 * - When category is 'all' or different page → shows dropdown with results
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
    Search,
    X,
    Briefcase,
    Users,
    UsersRound,
    FileText,
    ChevronDown,
    Loader2,
    Car,
    Package,
    CreditCard,
    Filter,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Category configuration
const CATEGORIES = [
    { value: 'all', label: 'Todos', icon: Search },
    { value: 'jobs', label: 'Trabajos', icon: Briefcase, pathMatch: '/dashboard/jobs' },
    { value: 'customers', label: 'Clientes', icon: Users, pathMatch: '/dashboard/customers' },
    { value: 'team', label: 'Equipo', icon: UsersRound, pathMatch: '/dashboard/team' },
    { value: 'vehicles', label: 'Vehículos', icon: Car, pathMatch: '/dashboard/fleet' },
    { value: 'inventory', label: 'Inventario', icon: Package, pathMatch: '/dashboard/inventory' },
    { value: 'invoices', label: 'Facturas', icon: FileText, pathMatch: '/dashboard/invoices' },
    { value: 'payments', label: 'Pagos', icon: CreditCard, pathMatch: '/dashboard/payments' },
] as const;

// Page-specific filter configurations
// These mirror the filters found in each page's search bar
interface FilterOption {
    value: string;
    label: string;
}

interface PageFilterConfig {
    statusOptions?: FilterOption[];
    statusParamName?: string;
    hasMoreFilters?: boolean;
    categoryOptions?: FilterOption[];
    categoryParamName?: string;
}

const PAGE_FILTERS: Record<string, PageFilterConfig> = {
    // Jobs removed - page has its own comprehensive filter system
    customers: {
        // Customers use tabs instead of dropdowns - handled separately
    },
    vehicles: {
        statusOptions: [
            { value: '', label: 'Todos los estados' },
            { value: 'ACTIVE', label: 'Activos' },
            { value: 'MAINTENANCE', label: 'En mantenimiento' },
            { value: 'INACTIVE', label: 'Inactivos' },
        ],
        statusParamName: 'status',
    },
    inventory: {
        // Inventory uses category filter
        categoryParamName: 'categoryId',
    },
    invoices: {
        statusOptions: [
            { value: '', label: 'Todos los estados' },
            { value: 'draft', label: 'Borrador' },
            { value: 'pending_cae', label: 'Pendiente CAE' },
            { value: 'issued', label: 'Emitida' },
            { value: 'sent', label: 'Enviada' },
            { value: 'paid', label: 'Pagada' },
            { value: 'overdue', label: 'Vencida' },
        ],
        statusParamName: 'status',
    },
    payments: {
        statusOptions: [
            { value: '', label: 'Todos los estados' },
            { value: 'pending', label: 'Pendiente' },
            { value: 'approved', label: 'Aprobado' },
            { value: 'rejected', label: 'Rechazado' },
            { value: 'refunded', label: 'Reembolsado' },
        ],
        statusParamName: 'status',
    },
};

interface SearchResult {
    id: string;
    title: string;
    subtitle: string;
    badge?: string;
    badgeColor?: string;
}

interface SearchCategory {
    category: string;
    label: string;
    path: string;
    queryParam: string;
    openParam: string;
    items: SearchResult[];
}

interface SearchResponse {
    success: boolean;
    data: {
        results: SearchCategory[];
        query: string;
        totalCount: number;
    };
}

export function GlobalSearch() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const inputRef = useRef<HTMLInputElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const [query, setQuery] = useState('');
    const [debouncedQuery, setDebouncedQuery] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const [showMoreFilters, setShowMoreFilters] = useState(false);

    // Detect current page category
    const currentPageCategory = useMemo(() => {
        const matched = CATEGORIES.find(
            (cat) => 'pathMatch' in cat && pathname.startsWith(cat.pathMatch)
        );
        return matched?.value || null;
    }, [pathname]);

    // Get the filter config for the current category
    const currentFilterConfig = useMemo(() => {
        if (!currentPageCategory) return null;
        return PAGE_FILTERS[currentPageCategory] || null;
    }, [currentPageCategory]);

    // Determine if we're searching in the current page's category (inline mode)
    const isInlineMode = useMemo(() => {
        return currentPageCategory !== null && selectedCategory === currentPageCategory;
    }, [currentPageCategory, selectedCategory]);

    // Get current filter values from URL
    const currentStatusFilter = searchParams.get(currentFilterConfig?.statusParamName || 'status') || '';
    const currentCategoryFilter = searchParams.get(currentFilterConfig?.categoryParamName || 'categoryId') || '';

    // Initialize category to current page on mount/pathname change
    // Also clear the search query when navigating to a different page
    useEffect(() => {
        if (currentPageCategory) {
            setSelectedCategory(currentPageCategory);
        } else {
            setSelectedCategory('all');
        }
        // Clear search when page changes
        setQuery('');
        setDebouncedQuery('');
        setShowMoreFilters(false);
    }, [currentPageCategory]);

    // Sync query from URL search param (for inline mode)
    useEffect(() => {
        if (isInlineMode) {
            const urlSearch = searchParams.get('search') || '';
            if (urlSearch && !query) {
                setQuery(urlSearch);
            }
        }
    }, [searchParams, isInlineMode, query]);

    // Debounce search query
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedQuery(query);
        }, 300);
        return () => clearTimeout(timer);
    }, [query]);

    // In inline mode, update URL search params to filter the page directly
    useEffect(() => {
        if (isInlineMode && debouncedQuery !== undefined) {
            const url = new URL(window.location.href);
            if (debouncedQuery.length >= 1) {
                url.searchParams.set('search', debouncedQuery);
            } else {
                url.searchParams.delete('search');
            }
            // Use replace to avoid adding to history for each keystroke
            router.replace(url.pathname + url.search, { scroll: false });
        }
    }, [debouncedQuery, isInlineMode, router]);

    // When switching between modes, manage dropdown visibility
    useEffect(() => {
        if (isInlineMode) {
            // Close dropdown when entering inline mode
            setIsOpen(false);
        } else if (query.length >= 2) {
            // Open dropdown when switching out of inline mode with an existing query
            setIsOpen(true);
        }
    }, [isInlineMode, query]);

    // Fetch search results using optimized v2 endpoint (only when NOT in inline mode)
    const { data: searchData, isLoading } = useQuery<SearchResponse>({
        queryKey: ['global-search-v2', debouncedQuery, selectedCategory],
        queryFn: async () => {
            const params = new URLSearchParams({
                q: debouncedQuery,
                category: selectedCategory,
            });
            // Use v2 endpoint for optimized SQL view-based search
            const res = await fetch(`/api/search/v2?${params}`);
            return res.json();
        },
        // Only fetch when NOT in inline mode AND query is long enough
        enabled: !isInlineMode && debouncedQuery.length >= 2,
        staleTime: 30000,
    });

    // Fetch inventory categories when on inventory page
    const { data: categoriesData } = useQuery({
        queryKey: ['product-categories-global-search'],
        queryFn: async () => {
            const res = await fetch('/api/inventory/products?view=categories');
            return res.json();
        },
        enabled: currentPageCategory === 'inventory' && isInlineMode,
    });

    const inventoryCategories = useMemo(() => {
        return (categoriesData?.data?.categories as Array<{ id: string; name: string }>) || [];
    }, [categoriesData]);

    const results = useMemo(() => {
        return searchData?.data?.results || [];
    }, [searchData?.data?.results]);
    const totalCount = searchData?.data?.totalCount || 0;

    // Flatten results for keyboard navigation
    const flatResults = results.flatMap((cat) =>
        cat.items.map((item) => ({ ...item, category: cat }))
    );

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                setShowCategoryDropdown(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Handle result click - navigate with search and open modal
    const handleResultClick = useCallback(
        (item: SearchResult, category: SearchCategory) => {
            // Build URL with search query and item to open
            const url = new URL(category.path, window.location.origin);
            url.searchParams.set(category.queryParam, query);
            url.searchParams.set(category.openParam, item.id);

            // Navigate
            router.push(url.pathname + url.search);

            // Close search
            setIsOpen(false);
            setQuery('');
        },
        [router, query]
    );

    // Handle filter change - update URL params
    const handleFilterChange = useCallback(
        (paramName: string, value: string) => {
            const url = new URL(window.location.href);
            if (value) {
                url.searchParams.set(paramName, value);
            } else {
                url.searchParams.delete(paramName);
            }
            router.replace(url.pathname + url.search, { scroll: false });
        },
        [router]
    );

    // Keyboard navigation
    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            // In inline mode, no dropdown navigation needed
            if (isInlineMode) {
                if (e.key === 'Escape') {
                    setQuery('');
                    inputRef.current?.blur();
                }
                return;
            }

            if (!isOpen || flatResults.length === 0) return;

            switch (e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    setHighlightedIndex((prev) =>
                        prev < flatResults.length - 1 ? prev + 1 : 0
                    );
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    setHighlightedIndex((prev) =>
                        prev > 0 ? prev - 1 : flatResults.length - 1
                    );
                    break;
                case 'Enter':
                    e.preventDefault();
                    if (highlightedIndex >= 0 && flatResults[highlightedIndex]) {
                        const item = flatResults[highlightedIndex];
                        handleResultClick(item, item.category);
                    }
                    break;
                case 'Escape':
                    setIsOpen(false);
                    inputRef.current?.blur();
                    break;
            }
        },
        [isOpen, flatResults, highlightedIndex, handleResultClick, isInlineMode]
    );

    // Reset highlight when results change
    useEffect(() => {
        setHighlightedIndex(-1);
    }, [results]);

    const currentCategoryLabel =
        CATEGORIES.find((c) => c.value === selectedCategory)?.label || 'Todos';

    // Determine if we should show dropdown (not in inline mode + has query + results)
    const shouldShowDropdown = !isInlineMode && isOpen && query.length >= 2;

    // Check if there are active additional filters (for badge count)
    const activeFilterCount = useMemo(() => {
        if (!isInlineMode || !currentFilterConfig) return 0;
        let count = 0;
        if (currentStatusFilter) count++;
        if (currentCategoryFilter) count++;
        return count;
    }, [isInlineMode, currentFilterConfig, currentStatusFilter, currentCategoryFilter]);

    return (
        <div className="relative flex items-center gap-2 w-full max-w-2xl" ref={dropdownRef}>
            {/* Search Input */}
            <div className="relative flex items-center flex-1 min-w-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => {
                        setQuery(e.target.value);
                        if (!isInlineMode) {
                            setIsOpen(true);
                        }
                    }}
                    onFocus={() => {
                        if (!isInlineMode) {
                            setIsOpen(true);
                        }
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder={isInlineMode ? `Buscar en ${currentCategoryLabel}...` : 'Buscar...'}
                    className="w-full pl-10 pr-28 h-10 bg-secondary border-0 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />

                {/* Category Selector Button */}
                <button
                    onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 px-2 py-1 rounded-md bg-muted hover:bg-muted/80 text-xs font-medium text-muted-foreground"
                >
                    {currentCategoryLabel}
                    <ChevronDown className="w-3 h-3" />
                </button>

                {/* Clear button */}
                {query && (
                    <button
                        onClick={() => {
                            setQuery('');
                            setIsOpen(false);
                            inputRef.current?.focus();
                        }}
                        className="absolute right-24 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-muted"
                    >
                        <X className="w-3 h-3 text-muted-foreground" />
                    </button>
                )}
            </div>

            {/* Page-specific filters - Only shown in inline mode */}
            {isInlineMode && currentFilterConfig && (
                <div className="flex items-center gap-2 shrink-0">
                    {/* Status filter dropdown */}
                    {currentFilterConfig.statusOptions && currentFilterConfig.statusParamName && (
                        <select
                            value={currentStatusFilter}
                            onChange={(e) => handleFilterChange(currentFilterConfig.statusParamName!, e.target.value)}
                            className="h-10 px-3 bg-secondary border-0 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
                        >
                            {currentFilterConfig.statusOptions.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                </option>
                            ))}
                        </select>
                    )}

                    {/* Inventory category filter */}
                    {currentPageCategory === 'inventory' && currentFilterConfig.categoryParamName && (
                        <select
                            value={currentCategoryFilter}
                            onChange={(e) => handleFilterChange(currentFilterConfig.categoryParamName!, e.target.value)}
                            className="h-10 px-3 bg-secondary border-0 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
                        >
                            <option value="">Todas las categorías</option>
                            {inventoryCategories.map((cat) => (
                                <option key={cat.id} value={cat.id}>
                                    {cat.name}
                                </option>
                            ))}
                        </select>
                    )}

                    {/* More filters button (Jobs only) */}
                    {currentFilterConfig.hasMoreFilters && (
                        <button
                            onClick={() => setShowMoreFilters(!showMoreFilters)}
                            className={cn(
                                'h-10 px-3 bg-secondary border-0 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 flex items-center gap-2 whitespace-nowrap',
                                showMoreFilters && 'ring-2 ring-primary/30 bg-primary/5'
                            )}
                        >
                            <Filter className="w-4 h-4" />
                            Más Filtros
                            {activeFilterCount > 0 && (
                                <span className="ml-1 rounded-full bg-primary text-primary-foreground px-1.5 py-0.5 text-xs">
                                    {activeFilterCount}
                                </span>
                            )}
                        </button>
                    )}
                </div>
            )}

            {/* Category Dropdown */}
            {showCategoryDropdown && (
                <div className="absolute left-0 top-full mt-1 w-40 bg-card rounded-lg border shadow-lg z-50 py-1">
                    {CATEGORIES.map((cat) => {
                        const Icon = cat.icon;
                        return (
                            <button
                                key={cat.value}
                                onClick={() => {
                                    setSelectedCategory(cat.value);
                                    setShowCategoryDropdown(false);
                                    // Keep the query when switching categories to enable cross-entity search
                                    inputRef.current?.focus();
                                    // Only open dropdown if NOT switching to inline mode
                                    // Check if the new category matches current page category
                                    const willBeInlineMode = currentPageCategory !== null && cat.value === currentPageCategory;
                                    if (query.length >= 2 && !willBeInlineMode) {
                                        setIsOpen(true);
                                    } else if (willBeInlineMode) {
                                        setIsOpen(false);
                                    }
                                }}
                                className={cn(
                                    'w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors',
                                    selectedCategory === cat.value && 'bg-primary/10 text-primary'
                                )}
                            >
                                <Icon className="w-4 h-4" />
                                {cat.label}
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Results Dropdown - Only shown when NOT in inline mode */}
            {shouldShowDropdown && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-card rounded-xl border shadow-xl z-50 max-h-[400px] overflow-y-auto">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                        </div>
                    ) : results.length === 0 ? (
                        <div className="py-8 text-center text-muted-foreground text-sm">
                            No se encontraron resultados para &quot;{query}&quot;
                        </div>
                    ) : (
                        <div className="py-2">
                            {results.map((category) => (
                                <div key={category.category}>
                                    {/* Category Header */}
                                    <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide bg-muted/50">
                                        {category.label}
                                    </div>

                                    {/* Category Items */}
                                    {category.items.map((item) => {
                                        const globalIndex = flatResults.findIndex(
                                            (r) => r.id === item.id && r.category.category === category.category
                                        );
                                        const isHighlighted = globalIndex === highlightedIndex;

                                        return (
                                            <button
                                                key={item.id}
                                                onClick={() => handleResultClick(item, category)}
                                                onMouseEnter={() => setHighlightedIndex(globalIndex)}
                                                className={cn(
                                                    'w-full flex items-center justify-between px-3 py-2.5 text-left transition-colors',
                                                    isHighlighted ? 'bg-primary/10' : 'hover:bg-muted'
                                                )}
                                            >
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-sm font-medium text-foreground truncate">
                                                        {item.title}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground truncate">
                                                        {item.subtitle}
                                                    </p>
                                                </div>
                                                {item.badge && (
                                                    <span
                                                        className={cn(
                                                            'ml-2 px-2 py-0.5 rounded-full text-xs font-medium shrink-0',
                                                            item.badgeColor || 'bg-gray-100 text-gray-700'
                                                        )}
                                                    >
                                                        {item.badge}
                                                    </span>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            ))}

                            {/* Footer with total count */}
                            <div className="px-3 py-2 border-t bg-muted/30 text-xs text-muted-foreground text-center">
                                {totalCount} resultado{totalCount !== 1 ? 's' : ''} encontrado{totalCount !== 1 ? 's' : ''}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
