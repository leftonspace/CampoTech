/**
 * PricebookSearch Component
 * =========================
 * Modal search component for technicians to browse and select items from the pricebook.
 * Uses offline-first WatermelonDB queries for instant search.
 */

import { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    TextInput,
    FlatList,
    TouchableOpacity,
    StyleSheet,
    Modal,
    ActivityIndicator,
    SafeAreaView,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { database } from '../../watermelon/database';
import { Q } from '@nozbe/watermelondb';
import PriceBookItem from '../../watermelon/models/PriceBookItem';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface SelectedPriceItem {
    id: string;
    serverId: string;
    name: string;
    description: string | null;
    unitPrice: number;
    unit: string;
    category: string;
    taxRate: number;
}

interface Props {
    visible: boolean;
    onClose: () => void;
    onSelect: (item: SelectedPriceItem) => void;
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export function PricebookSearch({ visible, onClose, onSelect }: Props) {
    const [search, setSearch] = useState('');
    const [items, setItems] = useState<PriceBookItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [categories, setCategories] = useState<string[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

    // Load categories on mount
    useEffect(() => {
        if (visible) {
            loadCategories();
        }
    }, [visible]);

    // Search items when query or category changes
    useEffect(() => {
        if (visible) {
            searchItems();
        }
    }, [search, selectedCategory, visible]);

    const loadCategories = async () => {
        try {
            const priceBookItems = database.get<PriceBookItem>('price_book_items');
            const allItems = await priceBookItems.query(Q.where('is_active', true)).fetch();
            const uniqueCategories = [...new Set(allItems.map((item) => item.category))].filter(Boolean);
            setCategories(uniqueCategories.sort());
        } catch (error) {
            console.error('Error loading categories:', error);
        }
    };

    const searchItems = useCallback(async () => {
        setLoading(true);
        try {
            const priceBookItems = database.get<PriceBookItem>('price_book_items');

            // Build query conditions
            const conditions: Q.Clause[] = [Q.where('is_active', true)];

            // Add category filter
            if (selectedCategory) {
                conditions.push(Q.where('category', selectedCategory));
            }

            // Add search filter (minimum 2 characters or empty for all)
            if (search.length >= 2) {
                const searchLower = `%${search.toLowerCase()}%`;
                conditions.push(
                    Q.or(
                        Q.where('name', Q.like(searchLower)),
                        Q.where('description', Q.like(searchLower))
                    )
                );
            }

            const results = await priceBookItems
                .query(...conditions)
                .fetch();

            setItems(results);
        } catch (error) {
            console.error('Search error:', error);
            setItems([]);
        } finally {
            setLoading(false);
        }
    }, [search, selectedCategory]);

    const handleSelect = (item: PriceBookItem) => {
        onSelect({
            id: item.id,
            serverId: item.serverId,
            name: item.name,
            description: item.description,
            unitPrice: item.unitPrice,
            unit: item.unit,
            category: item.category,
            taxRate: item.taxRate,
        });
        // Reset search state
        setSearch('');
        setSelectedCategory(null);
        onClose();
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('es-AR', {
            style: 'currency',
            currency: 'ARS',
            minimumFractionDigits: 0,
        }).format(amount);
    };

    const renderItem = ({ item }: { item: PriceBookItem }) => (
        <TouchableOpacity
            style={styles.itemRow}
            onPress={() => handleSelect(item)}
            activeOpacity={0.7}
        >
            <View style={styles.itemInfo}>
                <Text style={styles.itemName}>{item.name}</Text>
                {item.description && (
                    <Text style={styles.itemDesc} numberOfLines={1}>
                        {item.description}
                    </Text>
                )}
                <View style={styles.itemMeta}>
                    <Text style={styles.categoryBadge}>{item.category}</Text>
                </View>
            </View>
            <View style={styles.itemPrice}>
                <Text style={styles.priceText}>{formatCurrency(item.unitPrice)}</Text>
                <Text style={styles.unitText}>/{item.unit}</Text>
            </View>
            <Feather name="plus-circle" size={24} color="#16a34a" style={styles.addIcon} />
        </TouchableOpacity>
    );

    const renderCategoryFilter = () => (
        <FlatList
            horizontal
            data={[null, ...categories]}
            keyExtractor={(item) => item || 'all'}
            showsHorizontalScrollIndicator={false}
            style={styles.categoryList}
            renderItem={({ item }) => (
                <TouchableOpacity
                    style={[
                        styles.categoryChip,
                        selectedCategory === item && styles.categoryChipSelected,
                    ]}
                    onPress={() => setSelectedCategory(item)}
                >
                    <Text
                        style={[
                            styles.categoryChipText,
                            selectedCategory === item && styles.categoryChipTextSelected,
                        ]}
                    >
                        {item || 'Todos'}
                    </Text>
                </TouchableOpacity>
            )}
        />
    );

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
            <SafeAreaView style={styles.container}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.keyboardView}
                >
                    {/* Header */}
                    <View style={styles.header}>
                        <Text style={styles.title}>Buscar en Catálogo</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <Feather name="x" size={24} color="#374151" />
                        </TouchableOpacity>
                    </View>

                    {/* Search Input */}
                    <View style={styles.searchContainer}>
                        <Feather name="search" size={20} color="#9ca3af" />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Buscar servicio o material..."
                            value={search}
                            onChangeText={setSearch}
                            autoFocus
                            placeholderTextColor="#9ca3af"
                            returnKeyType="search"
                            clearButtonMode="while-editing"
                        />
                    </View>

                    {/* Category Filter */}
                    {categories.length > 0 && renderCategoryFilter()}

                    {/* Results */}
                    {loading ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="large" color="#16a34a" />
                            <Text style={styles.loadingText}>Buscando...</Text>
                        </View>
                    ) : (
                        <FlatList
                            data={items}
                            keyExtractor={(item) => item.id}
                            renderItem={renderItem}
                            contentContainerStyle={styles.listContent}
                            ListEmptyComponent={
                                <View style={styles.emptyContainer}>
                                    <Feather name="package" size={48} color="#d1d5db" />
                                    <Text style={styles.emptyText}>
                                        {search.length >= 2
                                            ? 'No se encontraron resultados'
                                            : 'Escribí al menos 2 caracteres para buscar'}
                                    </Text>
                                </View>
                            }
                            keyboardShouldPersistTaps="handled"
                        />
                    )}

                    {/* Item count */}
                    {items.length > 0 && (
                        <View style={styles.footer}>
                            <Text style={styles.footerText}>
                                {items.length} {items.length === 1 ? 'item' : 'items'} encontrado{items.length !== 1 ? 's' : ''}
                            </Text>
                        </View>
                    )}
                </KeyboardAvoidingView>
            </SafeAreaView>
        </Modal>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    keyboardView: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#e5e7eb',
    },
    title: {
        fontSize: 18,
        fontWeight: '600',
        color: '#111827',
    },
    closeButton: {
        padding: 4,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: 16,
        marginVertical: 12,
        paddingHorizontal: 12,
        paddingVertical: 10,
        backgroundColor: '#f3f4f6',
        borderRadius: 12,
    },
    searchInput: {
        flex: 1,
        marginLeft: 8,
        fontSize: 16,
        color: '#111827',
    },
    categoryList: {
        maxHeight: 44,
        paddingHorizontal: 12,
        marginBottom: 8,
    },
    categoryChip: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        backgroundColor: '#f3f4f6',
        borderRadius: 20,
        marginHorizontal: 4,
    },
    categoryChipSelected: {
        backgroundColor: '#16a34a',
    },
    categoryChipText: {
        fontSize: 14,
        color: '#4b5563',
        fontWeight: '500',
    },
    categoryChipTextSelected: {
        color: '#fff',
    },
    listContent: {
        paddingBottom: 20,
    },
    itemRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6',
    },
    itemInfo: {
        flex: 1,
    },
    itemName: {
        fontSize: 16,
        fontWeight: '500',
        color: '#111827',
    },
    itemDesc: {
        fontSize: 14,
        color: '#6b7280',
        marginTop: 2,
    },
    itemMeta: {
        flexDirection: 'row',
        marginTop: 4,
    },
    categoryBadge: {
        fontSize: 12,
        color: '#6b7280',
        backgroundColor: '#f3f4f6',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
        overflow: 'hidden',
    },
    itemPrice: {
        alignItems: 'flex-end',
        marginRight: 12,
    },
    priceText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#16a34a',
    },
    unitText: {
        fontSize: 12,
        color: '#9ca3af',
    },
    addIcon: {
        marginLeft: 4,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 12,
        fontSize: 14,
        color: '#6b7280',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingTop: 60,
        paddingHorizontal: 32,
    },
    emptyText: {
        marginTop: 16,
        fontSize: 15,
        color: '#9ca3af',
        textAlign: 'center',
    },
    footer: {
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderTopWidth: 1,
        borderTopColor: '#e5e7eb',
        backgroundColor: '#f9fafb',
    },
    footerText: {
        fontSize: 13,
        color: '#6b7280',
        textAlign: 'center',
    },
});

export default PricebookSearch;
