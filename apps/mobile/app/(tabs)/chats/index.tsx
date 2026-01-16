/**
 * Technician Chat List
 * ====================
 * 
 * Phase 5.4: Technician Copilot Access
 * 
 * Shows WhatsApp conversations assigned to the current technician.
 * Allows access to Copilot for AI-assisted responses.
 */

import React from 'react';
import {
    View,
    Text,
    FlatList,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { MessageSquare, Clock, ChevronRight, Bot } from 'lucide-react-native';
import { useAuth } from '../../../lib/auth/auth-context';
import { api } from '../../../lib/api/client';

interface Conversation {
    id: string;
    customerPhone: string;
    customerName: string | null;
    lastMessagePreview: string | null;
    lastMessageAt: string;
    unreadCount: number;
    status: string;
    hasAISuggestion?: boolean;
}

async function fetchAssignedConversations(): Promise<Conversation[]> {
    // Use the generic request method for custom endpoints
    const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000'}/api/whatsapp/conversations?assignedToMe=true`, {
        headers: {
            'Content-Type': 'application/json',
        },
        credentials: 'include',
    });
    if (!response.ok) {
        throw new Error('Error al cargar conversaciones');
    }
    const data = await response.json();
    return data.conversations || [];
}

function formatTimestamp(timestamp: string): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    if (diffHours < 1) {
        const diffMins = Math.floor(diffMs / (1000 * 60));
        return diffMins <= 1 ? 'Ahora' : `Hace ${diffMins} min`;
    } else if (diffHours < 24) {
        return `Hace ${Math.floor(diffHours)} hs`;
    } else {
        return date.toLocaleDateString('es-AR', {
            day: '2-digit',
            month: 'short',
            timeZone: 'America/Argentina/Buenos_Aires',
        });
    }
}

function ConversationItem({
    conversation,
    onPress
}: {
    conversation: Conversation;
    onPress: () => void;
}) {
    return (
        <TouchableOpacity
            style={styles.conversationItem}
            onPress={onPress}
            activeOpacity={0.7}
        >
            {/* Avatar placeholder */}
            <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                    {(conversation.customerName || conversation.customerPhone)[0]?.toUpperCase()}
                </Text>
            </View>

            {/* Conversation details */}
            <View style={styles.conversationContent}>
                <View style={styles.conversationHeader}>
                    <Text style={styles.customerName} numberOfLines={1}>
                        {conversation.customerName || conversation.customerPhone}
                    </Text>
                    <View style={styles.timeContainer}>
                        {conversation.hasAISuggestion && (
                            <Bot size={14} color="#8b5cf6" style={styles.aiIcon} />
                        )}
                        <Text style={styles.timestamp}>
                            {formatTimestamp(conversation.lastMessageAt)}
                        </Text>
                    </View>
                </View>

                <View style={styles.conversationFooter}>
                    <Text style={styles.preview} numberOfLines={1}>
                        {conversation.lastMessagePreview || 'Sin mensajes'}
                    </Text>
                    {conversation.unreadCount > 0 && (
                        <View style={styles.badge}>
                            <Text style={styles.badgeText}>{conversation.unreadCount}</Text>
                        </View>
                    )}
                </View>
            </View>

            <ChevronRight size={20} color="#9ca3af" />
        </TouchableOpacity>
    );
}

export default function ChatsScreen() {
    const router = useRouter();
    const { user } = useAuth();

    const {
        data: conversations = [],
        isLoading,
        error,
        refetch,
        isRefetching,
    } = useQuery({
        queryKey: ['assigned-conversations', user?.id],
        queryFn: fetchAssignedConversations,
        enabled: !!user,
    });

    const handleConversationPress = (conversationId: string) => {
        // Use type assertion for dynamic route
        router.push(`/chats/${conversationId}` as never);
    };

    if (isLoading) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color="#059669" />
                <Text style={styles.loadingText}>Cargando conversaciones...</Text>
            </View>
        );
    }

    if (error) {
        return (
            <View style={styles.centerContainer}>
                <MessageSquare size={48} color="#9ca3af" />
                <Text style={styles.errorText}>Error al cargar conversaciones</Text>
                <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
                    <Text style={styles.retryText}>Reintentar</Text>
                </TouchableOpacity>
            </View>
        );
    }

    if (conversations.length === 0) {
        return (
            <View style={styles.centerContainer}>
                <MessageSquare size={48} color="#9ca3af" />
                <Text style={styles.emptyTitle}>Sin conversaciones asignadas</Text>
                <Text style={styles.emptySubtitle}>
                    Cuando te asignen una conversación de WhatsApp, aparecerá acá.
                </Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Header with Copilot info */}
            <View style={styles.header}>
                <Bot size={20} color="#8b5cf6" />
                <Text style={styles.headerText}>
                    Copilot disponible para ayudarte a responder
                </Text>
            </View>

            <FlatList
                data={conversations}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                    <ConversationItem
                        conversation={item}
                        onPress={() => handleConversationPress(item.id)}
                    />
                )}
                refreshControl={
                    <RefreshControl
                        refreshing={isRefetching}
                        onRefresh={refetch}
                        tintColor="#059669"
                        colors={['#059669']}
                    />
                }
                contentContainerStyle={styles.listContent}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f9fafb',
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
        backgroundColor: '#f9fafb',
    },
    loadingText: {
        marginTop: 12,
        color: '#6b7280',
        fontSize: 14,
    },
    errorText: {
        marginTop: 12,
        color: '#ef4444',
        fontSize: 14,
    },
    retryButton: {
        marginTop: 16,
        paddingHorizontal: 16,
        paddingVertical: 8,
        backgroundColor: '#059669',
        borderRadius: 8,
    },
    retryText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '500',
    },
    emptyTitle: {
        marginTop: 16,
        fontSize: 16,
        fontWeight: '600',
        color: '#374151',
    },
    emptySubtitle: {
        marginTop: 8,
        fontSize: 14,
        color: '#6b7280',
        textAlign: 'center',
        maxWidth: 280,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        padding: 12,
        backgroundColor: '#f5f3ff',
        borderBottomWidth: 1,
        borderBottomColor: '#e9d5ff',
    },
    headerText: {
        fontSize: 13,
        color: '#7c3aed',
        fontWeight: '500',
    },
    listContent: {
        paddingBottom: 20,
    },
    conversationItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6',
    },
    avatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#059669',
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
    },
    conversationContent: {
        flex: 1,
        marginLeft: 12,
        marginRight: 8,
    },
    conversationHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    customerName: {
        fontSize: 15,
        fontWeight: '600',
        color: '#111827',
        flex: 1,
        marginRight: 8,
    },
    timeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    aiIcon: {
        marginRight: 2,
    },
    timestamp: {
        fontSize: 12,
        color: '#9ca3af',
    },
    conversationFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    preview: {
        fontSize: 14,
        color: '#6b7280',
        flex: 1,
        marginRight: 8,
    },
    badge: {
        backgroundColor: '#059669',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 10,
        minWidth: 20,
        alignItems: 'center',
    },
    badgeText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
    },
});
