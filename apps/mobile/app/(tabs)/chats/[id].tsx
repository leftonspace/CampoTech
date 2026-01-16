/**
 * Technician Chat Detail
 * ======================
 * 
 * Phase 5.4: Technician Copilot Access
 * 
 * Shows conversation details with AI Copilot suggestions.
 * Technicians can view messages and get AI-assisted response suggestions.
 */

import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    FlatList,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    Send,
    Bot,
    ThumbsUp,
    ThumbsDown,
    MessageSquare,
    Sparkles,
    CheckCircle,
    X,
} from 'lucide-react-native';
import { useAuth } from '../../../lib/auth/auth-context';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

interface Message {
    id: string;
    content: string;
    direction: 'inbound' | 'outbound';
    senderType: 'customer' | 'ai' | 'human' | null;
    createdAt: string;
    detectedLanguage?: string;
    translatedContent?: string;
}

interface Conversation {
    id: string;
    customerPhone: string;
    customerName: string | null;
    messages: Message[];
}

interface CopilotSuggestion {
    text: string;
    confidence: number;
}

async function fetchConversation(conversationId: string): Promise<Conversation> {
    const response = await fetch(`${API_BASE_URL}/api/whatsapp/conversations/${conversationId}`, {
        credentials: 'include',
    });
    if (!response.ok) {
        throw new Error('Error al cargar conversación');
    }
    return response.json();
}

async function getCopilotSuggestion(conversationId: string, messages: Message[]): Promise<CopilotSuggestion> {
    const response = await fetch(`${API_BASE_URL}/api/copilot/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
            message: 'Sugerí una respuesta para el último mensaje del cliente',
            conversationId,
            context: {
                messages: messages.slice(-10).map(m => ({
                    content: m.content,
                    direction: m.direction,
                    senderType: m.senderType,
                })),
            },
        }),
    });

    if (!response.ok) {
        throw new Error('Error al obtener sugerencia');
    }

    const data = await response.json();
    return {
        text: data.response,
        confidence: data.metadata?.confidence || 80,
    };
}

async function sendMessage(conversationId: string, text: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/whatsapp/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
            content: text,
            type: 'text',
        }),
    });

    if (!response.ok) {
        throw new Error('Error al enviar mensaje');
    }
}

async function sendFeedback(messageId: string, feedback: 'positive' | 'negative'): Promise<void> {
    await fetch(`${API_BASE_URL}/api/ai/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
            messageId,
            feedback,
            feedbackType: 'response',
        }),
    });
}

function formatTime(timestamp: string): string {
    return new Date(timestamp).toLocaleTimeString('es-AR', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'America/Argentina/Buenos_Aires',
    });
}

function MessageBubble({ message }: { message: Message }) {
    const isInbound = message.direction === 'inbound';
    const isAI = message.senderType === 'ai';

    return (
        <View style={[
            styles.messageBubble,
            isInbound ? styles.inboundBubble : styles.outboundBubble,
        ]}>
            {isAI && (
                <View style={styles.aiLabel}>
                    <Bot size={10} color="#8b5cf6" />
                    <Text style={styles.aiLabelText}>IA</Text>
                </View>
            )}

            <Text style={[
                styles.messageText,
                isInbound ? styles.inboundText : styles.outboundText,
            ]}>
                {message.content}
            </Text>

            {/* Show translation if available */}
            {message.detectedLanguage && message.detectedLanguage !== 'es' && message.translatedContent && (
                <View style={styles.translationContainer}>
                    <Text style={styles.translationLabel}>🌐 Traducción:</Text>
                    <Text style={styles.translationText}>{message.translatedContent}</Text>
                </View>
            )}

            <Text style={[
                styles.timestamp,
                isInbound ? styles.inboundTimestamp : styles.outboundTimestamp,
            ]}>
                {formatTime(message.createdAt)}
            </Text>
        </View>
    );
}

export default function ChatDetailScreen() {
    const { id: conversationId } = useLocalSearchParams<{ id: string }>();
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const flatListRef = useRef<FlatList>(null);

    const [messageText, setMessageText] = useState('');
    const [showSuggestion, setShowSuggestion] = useState(false);

    const { data: conversation, isLoading, error } = useQuery({
        queryKey: ['conversation', conversationId],
        queryFn: () => fetchConversation(conversationId!),
        enabled: !!conversationId,
        refetchInterval: 10000, // Poll every 10 seconds
    });

    // Copilot suggestion mutation
    const {
        mutate: requestSuggestion,
        data: suggestion,
        isPending: isLoadingSuggestion,
        reset: resetSuggestion,
    } = useMutation({
        mutationFn: () => getCopilotSuggestion(conversationId!, conversation?.messages || []),
    });

    // Send message mutation
    const { mutate: sendMessageMutation, isPending: isSending } = useMutation({
        mutationFn: (text: string) => sendMessage(conversationId!, text),
        onSuccess: () => {
            setMessageText('');
            setShowSuggestion(false);
            resetSuggestion();
            queryClient.invalidateQueries({ queryKey: ['conversation', conversationId] });
        },
    });

    // Feedback mutation
    const { mutate: sendFeedbackMutation } = useMutation({
        mutationFn: ({ feedback }: { feedback: 'positive' | 'negative' }) => {
            const lastMessage = conversation?.messages?.slice(-1)[0];
            if (lastMessage) {
                return sendFeedback(lastMessage.id, feedback);
            }
            return Promise.resolve();
        },
    });

    // Auto-scroll to bottom on new messages
    useEffect(() => {
        if (conversation?.messages?.length) {
            setTimeout(() => {
                flatListRef.current?.scrollToEnd({ animated: true });
            }, 100);
        }
    }, [conversation?.messages?.length]);

    const handleSendMessage = () => {
        if (messageText.trim()) {
            sendMessageMutation(messageText.trim());
        }
    };

    const handleUseSuggestion = () => {
        if (suggestion?.text) {
            setMessageText(suggestion.text);
            setShowSuggestion(false);
        }
    };

    const handleRequestSuggestion = () => {
        setShowSuggestion(true);
        requestSuggestion();
    };

    if (isLoading) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color="#059669" />
            </View>
        );
    }

    if (error || !conversation) {
        return (
            <View style={styles.centerContainer}>
                <MessageSquare size={48} color="#9ca3af" />
                <Text style={styles.errorText}>Error al cargar conversación</Text>
            </View>
        );
    }

    return (
        <>
            <Stack.Screen
                options={{
                    title: conversation.customerName || conversation.customerPhone,
                    headerBackTitle: 'Chats',
                }}
            />

            <KeyboardAvoidingView
                style={styles.container}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={90}
            >
                {/* Messages list */}
                <FlatList
                    ref={flatListRef}
                    data={conversation.messages}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }) => <MessageBubble message={item} />}
                    contentContainerStyle={styles.messagesList}
                    onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
                />

                {/* Copilot suggestion card */}
                {showSuggestion && (
                    <View style={styles.suggestionCard}>
                        <View style={styles.suggestionHeader}>
                            <Bot size={16} color="#8b5cf6" />
                            <Text style={styles.suggestionTitle}>Sugerencia del Copilot</Text>
                            <TouchableOpacity onPress={() => setShowSuggestion(false)}>
                                <X size={18} color="#6b7280" />
                            </TouchableOpacity>
                        </View>

                        {isLoadingSuggestion ? (
                            <View style={styles.suggestionLoading}>
                                <ActivityIndicator size="small" color="#8b5cf6" />
                                <Text style={styles.loadingText}>Pensando...</Text>
                            </View>
                        ) : suggestion ? (
                            <>
                                <Text style={styles.suggestionText}>{suggestion.text}</Text>
                                <View style={styles.suggestionActions}>
                                    <TouchableOpacity
                                        style={styles.useSuggestionButton}
                                        onPress={handleUseSuggestion}
                                    >
                                        <CheckCircle size={16} color="#fff" />
                                        <Text style={styles.useSuggestionText}>Usar</Text>
                                    </TouchableOpacity>

                                    <View style={styles.feedbackButtons}>
                                        <TouchableOpacity
                                            style={styles.feedbackButton}
                                            onPress={() => sendFeedbackMutation({ feedback: 'positive' })}
                                        >
                                            <ThumbsUp size={16} color="#6b7280" />
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={styles.feedbackButton}
                                            onPress={() => sendFeedbackMutation({ feedback: 'negative' })}
                                        >
                                            <ThumbsDown size={16} color="#6b7280" />
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </>
                        ) : null}
                    </View>
                )}

                {/* Input area */}
                <View style={styles.inputContainer}>
                    <TouchableOpacity
                        style={styles.copilotButton}
                        onPress={handleRequestSuggestion}
                    >
                        <Sparkles size={20} color="#8b5cf6" />
                    </TouchableOpacity>

                    <TextInput
                        style={styles.textInput}
                        value={messageText}
                        onChangeText={setMessageText}
                        placeholder="Escribí un mensaje..."
                        placeholderTextColor="#9ca3af"
                        multiline
                        maxLength={1000}
                    />

                    <TouchableOpacity
                        style={[
                            styles.sendButton,
                            (!messageText.trim() || isSending) && styles.sendButtonDisabled,
                        ]}
                        onPress={handleSendMessage}
                        disabled={!messageText.trim() || isSending}
                    >
                        {isSending ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <Send size={20} color="#fff" />
                        )}
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f3f4f6',
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    errorText: {
        marginTop: 12,
        color: '#ef4444',
        fontSize: 14,
    },
    messagesList: {
        padding: 16,
        paddingBottom: 8,
    },
    messageBubble: {
        maxWidth: '80%',
        padding: 12,
        borderRadius: 16,
        marginBottom: 8,
    },
    inboundBubble: {
        alignSelf: 'flex-start',
        backgroundColor: '#fff',
        borderBottomLeftRadius: 4,
    },
    outboundBubble: {
        alignSelf: 'flex-end',
        backgroundColor: '#059669',
        borderBottomRightRadius: 4,
    },
    aiLabel: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginBottom: 4,
    },
    aiLabelText: {
        fontSize: 10,
        color: '#8b5cf6',
        fontWeight: '600',
    },
    messageText: {
        fontSize: 15,
        lineHeight: 20,
    },
    inboundText: {
        color: '#111827',
    },
    outboundText: {
        color: '#fff',
    },
    translationContainer: {
        marginTop: 8,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#e5e7eb',
    },
    translationLabel: {
        fontSize: 10,
        color: '#6b7280',
        marginBottom: 4,
    },
    translationText: {
        fontSize: 13,
        color: '#4b5563',
        fontStyle: 'italic',
    },
    timestamp: {
        fontSize: 11,
        marginTop: 4,
    },
    inboundTimestamp: {
        color: '#9ca3af',
    },
    outboundTimestamp: {
        color: 'rgba(255, 255, 255, 0.7)',
    },
    suggestionCard: {
        backgroundColor: '#f5f3ff',
        borderTopWidth: 1,
        borderTopColor: '#e9d5ff',
        padding: 12,
    },
    suggestionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8,
    },
    suggestionTitle: {
        flex: 1,
        fontSize: 13,
        fontWeight: '600',
        color: '#7c3aed',
    },
    suggestionLoading: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 12,
    },
    loadingText: {
        color: '#8b5cf6',
        fontSize: 14,
    },
    suggestionText: {
        fontSize: 14,
        color: '#374151',
        lineHeight: 20,
        backgroundColor: '#fff',
        padding: 12,
        borderRadius: 8,
        marginBottom: 8,
    },
    suggestionActions: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    useSuggestionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#8b5cf6',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
    },
    useSuggestionText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '500',
    },
    feedbackButtons: {
        flexDirection: 'row',
        gap: 8,
    },
    feedbackButton: {
        padding: 8,
        backgroundColor: '#fff',
        borderRadius: 8,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        padding: 12,
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: '#e5e7eb',
        gap: 8,
    },
    copilotButton: {
        padding: 10,
        backgroundColor: '#f5f3ff',
        borderRadius: 20,
    },
    textInput: {
        flex: 1,
        backgroundColor: '#f3f4f6',
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 10,
        fontSize: 15,
        maxHeight: 100,
        color: '#111827',
    },
    sendButton: {
        backgroundColor: '#059669',
        padding: 10,
        borderRadius: 20,
    },
    sendButtonDisabled: {
        backgroundColor: '#9ca3af',
    },
});
