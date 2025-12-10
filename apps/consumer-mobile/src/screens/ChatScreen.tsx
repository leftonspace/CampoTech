/**
 * Chat Screen
 * ===========
 *
 * In-app chat with businesses.
 * Phase 15: Consumer Marketplace
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
  Keyboard,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { consumerApi } from '../services/api-client';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface Message {
  id: string;
  senderType: 'consumer' | 'business';
  message: string;
  createdAt: string;
}

interface QuoteDetails {
  id: string;
  quoteNumber: string;
  business: {
    id: string;
    displayName: string;
    logoUrl?: string;
    overallRating: number;
  };
  priceMin: number;
  priceMax: number;
  status: string;
  messages: Message[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function formatTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return 'Hoy';
  } else if (date.toDateString() === yesterday.toDateString()) {
    return 'Ayer';
  } else {
    return date.toLocaleDateString('es-AR', {
      day: 'numeric',
      month: 'short',
    });
  }
}

function shouldShowDate(messages: Message[], index: number): boolean {
  if (index === 0) return true;

  const currentDate = new Date(messages[index].createdAt).toDateString();
  const previousDate = new Date(messages[index - 1].createdAt).toDateString();

  return currentDate !== previousDate;
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function ChatScreen(): React.JSX.Element {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { quoteId } = route.params;

  const flatListRef = useRef<FlatList>(null);

  const [quote, setQuote] = useState<QuoteDetails | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // ─────────────────────────────────────────────────────────────────────────────
  // LOAD QUOTE AND MESSAGES
  // ─────────────────────────────────────────────────────────────────────────────

  const loadQuote = useCallback(async () => {
    try {
      const response = await consumerApi.quotes.get(quoteId);
      if (response.success && response.data) {
        const data = response.data as QuoteDetails;
        setQuote(data);
        setMessages(data.messages || []);

        // Update navigation header
        navigation.setOptions({
          title: data.business.displayName,
        });
      }
    } catch (error) {
      console.error('Error loading quote:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [quoteId, navigation]);

  useEffect(() => {
    loadQuote();

    // Poll for new messages every 10 seconds
    const interval = setInterval(loadQuote, 10000);
    return () => clearInterval(interval);
  }, [loadQuote]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadQuote();
  }, [loadQuote]);

  // ─────────────────────────────────────────────────────────────────────────────
  // SEND MESSAGE
  // ─────────────────────────────────────────────────────────────────────────────

  const sendMessage = async () => {
    if (!newMessage.trim() || sending) return;

    setSending(true);
    Keyboard.dismiss();

    const messageText = newMessage.trim();
    setNewMessage('');

    // Optimistically add message
    const optimisticMessage: Message = {
      id: `temp-${Date.now()}`,
      senderType: 'consumer',
      message: messageText,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimisticMessage]);

    try {
      const response = await consumerApi.quotes.sendMessage(quoteId, messageText);
      if (response.success) {
        // Refresh to get the actual message from server
        loadQuote();
      } else {
        // Remove optimistic message on error
        setMessages((prev) => prev.filter((m) => m.id !== optimisticMessage.id));
        setNewMessage(messageText);
      }
    } catch (error) {
      setMessages((prev) => prev.filter((m) => m.id !== optimisticMessage.id));
      setNewMessage(messageText);
    } finally {
      setSending(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // SCROLL TO BOTTOM
  // ─────────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length]);

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER MESSAGE
  // ─────────────────────────────────────────────────────────────────────────────

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const isConsumer = item.senderType === 'consumer';
    const showDate = shouldShowDate(messages, index);

    return (
      <View>
        {showDate && (
          <View style={styles.dateSeparator}>
            <Text style={styles.dateSeparatorText}>
              {formatDate(item.createdAt)}
            </Text>
          </View>
        )}

        <View
          style={[
            styles.messageContainer,
            isConsumer ? styles.messageContainerRight : styles.messageContainerLeft,
          ]}
        >
          {!isConsumer && quote?.business.logoUrl && (
            <Image
              source={{ uri: quote.business.logoUrl }}
              style={styles.avatarSmall}
            />
          )}

          <View
            style={[
              styles.messageBubble,
              isConsumer ? styles.messageBubbleConsumer : styles.messageBubbleBusiness,
            ]}
          >
            <Text
              style={[
                styles.messageText,
                isConsumer && styles.messageTextConsumer,
              ]}
            >
              {item.message}
            </Text>
            <Text
              style={[
                styles.messageTime,
                isConsumer && styles.messageTimeConsumer,
              ]}
            >
              {formatTime(item.createdAt)}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2E7D32" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      {/* Quote Info Header */}
      <TouchableOpacity
        style={styles.quoteHeader}
        onPress={() => navigation.navigate('QuoteDetail', { quoteId })}
      >
        {quote?.business.logoUrl ? (
          <Image source={{ uri: quote.business.logoUrl }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarText}>
              {quote?.business.displayName[0]}
            </Text>
          </View>
        )}
        <View style={styles.quoteInfo}>
          <Text style={styles.businessName}>{quote?.business.displayName}</Text>
          <Text style={styles.quoteNumber}>
            Cotización #{quote?.quoteNumber}
          </Text>
        </View>
        <View style={styles.quotePrice}>
          <Text style={styles.priceLabel}>Precio</Text>
          <Text style={styles.priceValue}>
            ${quote?.priceMin.toLocaleString()}
          </Text>
        </View>
      </TouchableOpacity>

      {/* Messages List */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messagesList}
        onRefresh={onRefresh}
        refreshing={refreshing}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>💬</Text>
            <Text style={styles.emptyTitle}>Inicia la conversación</Text>
            <Text style={styles.emptySubtitle}>
              Pregunta sobre disponibilidad, detalles del trabajo o cualquier duda que tengas.
            </Text>
          </View>
        }
      />

      {/* Quick Replies */}
      {messages.length === 0 && (
        <View style={styles.quickReplies}>
          <Text style={styles.quickRepliesTitle}>Respuestas rápidas:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {[
              '¿Cuándo podrían empezar?',
              '¿El precio incluye materiales?',
              '¿Tienen garantía?',
              '¿Pueden ir a ver el trabajo?',
            ].map((reply) => (
              <TouchableOpacity
                key={reply}
                style={styles.quickReplyButton}
                onPress={() => setNewMessage(reply)}
              >
                <Text style={styles.quickReplyText}>{reply}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Input Area */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.textInput}
          value={newMessage}
          onChangeText={setNewMessage}
          placeholder="Escribe un mensaje..."
          placeholderTextColor="#9E9E9E"
          multiline
          maxLength={500}
        />
        <TouchableOpacity
          style={[
            styles.sendButton,
            (!newMessage.trim() || sending) && styles.sendButtonDisabled,
          ]}
          onPress={sendMessage}
          disabled={!newMessage.trim() || sending}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <Text style={styles.sendButtonText}>➤</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCROLL VIEW IMPORT (for quick replies)
// ═══════════════════════════════════════════════════════════════════════════════

import { ScrollView } from 'react-native';

// ═══════════════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Quote Header
  quoteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#2E7D32',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
  },
  avatarSmall: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginRight: 8,
  },
  quoteInfo: {
    flex: 1,
    marginLeft: 12,
  },
  businessName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212121',
  },
  quoteNumber: {
    fontSize: 13,
    color: '#757575',
    marginTop: 2,
  },
  quotePrice: {
    alignItems: 'flex-end',
  },
  priceLabel: {
    fontSize: 11,
    color: '#9E9E9E',
  },
  priceValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2E7D32',
  },

  // Messages
  messagesList: {
    padding: 16,
    flexGrow: 1,
  },
  dateSeparator: {
    alignItems: 'center',
    marginVertical: 16,
  },
  dateSeparatorText: {
    fontSize: 12,
    color: '#9E9E9E',
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 10,
  },
  messageContainer: {
    flexDirection: 'row',
    marginBottom: 12,
    alignItems: 'flex-end',
  },
  messageContainerLeft: {
    justifyContent: 'flex-start',
  },
  messageContainerRight: {
    justifyContent: 'flex-end',
  },
  messageBubble: {
    maxWidth: '75%',
    padding: 12,
    borderRadius: 16,
  },
  messageBubbleBusiness: {
    backgroundColor: '#FFF',
    borderBottomLeftRadius: 4,
  },
  messageBubbleConsumer: {
    backgroundColor: '#2E7D32',
    borderBottomRightRadius: 4,
  },
  messageText: {
    fontSize: 15,
    color: '#212121',
    lineHeight: 20,
  },
  messageTextConsumer: {
    color: '#FFF',
  },
  messageTime: {
    fontSize: 11,
    color: '#9E9E9E',
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  messageTimeConsumer: {
    color: 'rgba(255,255,255,0.7)',
  },

  // Empty State
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#212121',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#757575',
    textAlign: 'center',
    lineHeight: 20,
  },

  // Quick Replies
  quickReplies: {
    backgroundColor: '#FFF',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  quickRepliesTitle: {
    fontSize: 12,
    color: '#9E9E9E',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  quickReplyButton: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    marginLeft: 12,
  },
  quickReplyText: {
    fontSize: 13,
    color: '#2E7D32',
  },

  // Input
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#FFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  textInput: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 100,
    marginRight: 8,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#2E7D32',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#A5D6A7',
  },
  sendButtonText: {
    fontSize: 20,
    color: '#FFF',
  },
});
