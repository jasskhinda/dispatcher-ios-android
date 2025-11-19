import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useUnreadMessages } from '../contexts/UnreadMessagesContext';
import Header from '../components/Header';

const BRAND_COLOR = '#5fbfc0';

const MessagingScreen = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { refreshUnreadCount } = useUnreadMessages();
  const flatListRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [facilityDetails, setFacilityDetails] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    loadConversations();

    // Subscribe to new conversations
    const conversationsSubscription = supabase
      .channel('all-conversations')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'conversations',
        },
        (payload) => {
          console.log('🆕 New conversation created:', payload.new);
          loadConversations(); // Reload to get facility details
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'conversations',
        },
        (payload) => {
          console.log('🔄 Conversation updated:', payload.new);
          // Update the conversation in the list and re-sort by last_message_at
          setConversations((prev) => {
            const updated = prev.map((conv) =>
              conv.id === payload.new.id ? { ...conv, ...payload.new } : conv
            );
            // Sort by last_message_at to keep latest on top
            return updated.sort((a, b) =>
              new Date(b.last_message_at) - new Date(a.last_message_at)
            );
          });
        }
      )
      .subscribe();

    return () => {
      conversationsSubscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!selectedConversation) return;

    // Subscribe to new messages
    const messagesSubscription = supabase
      .channel(`messages-${selectedConversation.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${selectedConversation.id}`,
        },
        (payload) => {
          console.log('💬 New message received:', payload.new);
          setMessages((prev) => [...prev, payload.new]);
          scrollToBottom();

          if (payload.new.sender_type === 'facility') {
            markMessageAsRead(payload.new.id);
          }
        }
      )
      .subscribe();

    // Subscribe to conversation updates
    const conversationSubscription = supabase
      .channel('conversation-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'conversations',
          filter: `id=eq.${selectedConversation.id}`,
        },
        (payload) => {
          setSelectedConversation(payload.new);
          setConversations((prev) =>
            prev.map((conv) => (conv.id === payload.new.id ? { ...conv, ...payload.new } : conv))
          );
        }
      )
      .subscribe();

    return () => {
      messagesSubscription.unsubscribe();
      conversationSubscription.unsubscribe();
    };
  }, [selectedConversation]);

  const loadConversations = async () => {
    try {
      setLoading(true);

      const { data: conversationsData, error: convError } = await supabase
        .from('conversations')
        .select('*')
        .order('last_message_at', { ascending: false });

      if (convError) throw convError;

      // Fetch facility details for each conversation
      const conversationsWithFacilities = await Promise.all(
        (conversationsData || []).map(async (conv) => {
          const { data: facility } = await supabase
            .from('facilities')
            .select('id, name')
            .eq('id', conv.facility_id)
            .single();

          return {
            ...conv,
            facilities: facility,
          };
        })
      );

      setConversations(conversationsWithFacilities);

      // Don't auto-select - let user choose from the list
    } catch (error) {
      console.error('Error loading conversations:', error);
      Alert.alert('Error', 'Failed to load conversations');
    } finally {
      setLoading(false);
    }
  };

  const selectConversation = async (conversation) => {
    try {
      setSelectedConversation(conversation);

      // Load facility details
      const { data: facilityData } = await supabase
        .from('facilities')
        .select('id, name, address, phone_number, contact_email')
        .eq('id', conversation.facility_id)
        .single();

      setFacilityDetails(facilityData);

      // Load messages
      const { data: messagesData, error: messagesError } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversation.id)
        .order('created_at', { ascending: true });

      if (messagesError) throw messagesError;

      setMessages(messagesData || []);

      // Mark unread messages as read
      const unreadMessages = messagesData?.filter(
        (m) => m.sender_type === 'facility' && !m.read_by_dispatcher
      );

      if (unreadMessages?.length > 0) {
        await supabase
          .from('messages')
          .update({ read_by_dispatcher: true })
          .in(
            'id',
            unreadMessages.map((m) => m.id)
          );

        // Refresh unread count badge
        refreshUnreadCount();
      }

      setTimeout(scrollToBottom, 100);
    } catch (error) {
      console.error('Error loading messages:', error);
      Alert.alert('Error', 'Failed to load messages');
    }
  };

  const handleJoinConversation = async () => {
    if (!selectedConversation || joining) return;

    try {
      setJoining(true);

      const { error } = await supabase
        .from('conversations')
        .update({
          assigned_dispatcher_id: user.id,
          status: 'active',
        })
        .eq('id', selectedConversation.id);

      if (error) throw error;

      // Send automated join message
      await supabase.from('messages').insert({
        conversation_id: selectedConversation.id,
        sender_id: user.id,
        sender_type: 'dispatcher',
        message_text: '👋 Hello! I\'m here to help. How can I assist you today?',
        read_by_facility: false,
        read_by_dispatcher: true,
      });

      setSelectedConversation((prev) => ({
        ...prev,
        assigned_dispatcher_id: user.id,
        status: 'active',
      }));

      Alert.alert('Success', 'Joined conversation successfully');
    } catch (error) {
      console.error('Error joining conversation:', error);
      Alert.alert('Error', 'Failed to join conversation');
    } finally {
      setJoining(false);
    }
  };

  const handleEndConversation = async () => {
    if (!selectedConversation) return;

    Alert.alert(
      'End Conversation',
      'Are you sure you want to end this conversation? This will mark it as resolved.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End Chat',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('conversations')
                .update({
                  status: 'resolved',
                  resolved_at: new Date().toISOString(),
                })
                .eq('id', selectedConversation.id);

              if (error) throw error;

              // Send automated end message
              await supabase.from('messages').insert({
                conversation_id: selectedConversation.id,
                sender_id: user.id,
                sender_type: 'dispatcher',
                message_text:
                  '✅ This conversation has been marked as resolved. If you need further assistance, please start a new conversation.',
                read_by_facility: false,
                read_by_dispatcher: true,
              });

              setSelectedConversation((prev) => ({
                ...prev,
                status: 'resolved',
                resolved_at: new Date().toISOString(),
              }));

              Alert.alert('Success', 'Conversation ended successfully');
            } catch (error) {
              console.error('Error ending conversation:', error);
              Alert.alert('Error', 'Failed to end conversation');
            }
          },
        },
      ]
    );
  };

  const markMessageAsRead = async (messageId) => {
    try {
      await supabase
        .from('messages')
        .update({ read_by_dispatcher: true })
        .eq('id', messageId);
    } catch (error) {
      console.error('Error marking message as read:', error);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || sending) return;

    if (!selectedConversation.assigned_dispatcher_id) {
      Alert.alert('Notice', 'Please join the conversation before sending messages');
      return;
    }

    try {
      setSending(true);

      const { error } = await supabase.from('messages').insert({
        conversation_id: selectedConversation.id,
        sender_id: user.id,
        sender_type: 'dispatcher',
        message_text: newMessage.trim(),
        read_by_facility: false,
        read_by_dispatcher: true,
      });

      if (error) throw error;

      setNewMessage('');
      setTimeout(scrollToBottom, 100);
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const scrollToBottom = () => {
    if (flatListRef.current && messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const formatConversationTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
      });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return date.toLocaleDateString('en-US', { weekday: 'short' });
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  const getStatusBadge = (status) => {
    if (status === 'active') {
      return <View style={styles.statusBadgeActive}><Text style={styles.statusTextActive}>Active</Text></View>;
    }
    if (status === 'resolved') {
      return <View style={styles.statusBadgeResolved}><Text style={styles.statusTextResolved}>Resolved</Text></View>;
    }
    return <View style={styles.statusBadgeWaiting}><Text style={styles.statusTextWaiting}>Waiting</Text></View>;
  };

  const renderMessage = ({ item }) => {
    const isDispatcher = item.sender_type === 'dispatcher';
    return (
      <View style={[styles.messageContainer, isDispatcher ? styles.messageRight : styles.messageLeft]}>
        <View
          style={[
            styles.messageBubble,
            isDispatcher ? styles.messageBubbleDispatcher : styles.messageBubbleFacility,
          ]}
        >
          <Text style={[styles.messageText, isDispatcher ? styles.messageTextDispatcher : styles.messageTextFacility]}>
            {item.message_text}
          </Text>
          <Text style={[styles.messageTime, isDispatcher ? styles.messageTimeDispatcher : styles.messageTimeFacility]}>
            {formatTime(item.created_at)}
          </Text>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={BRAND_COLOR} />
        <Text style={styles.loadingText}>Loading messages...</Text>
      </View>
    );
  }

  // Always show conversations list first if no conversation is selected
  if (!selectedConversation) {
    return (
      <View style={styles.container}>
        <Header title="Messages" onBack={() => navigation.goBack()} showMessaging={false} />
        {conversations.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>💬</Text>
            <Text style={styles.emptyTitle}>No Conversations Yet</Text>
            <Text style={styles.emptyText}>
              When facilities start conversations, they will appear here.
            </Text>
          </View>
        ) : (
          <FlatList
            data={conversations}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.conversationsList}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.conversationCard}
                onPress={() => selectConversation(item)}
              >
                <View style={styles.conversationHeader}>
                  <Text style={styles.facilityName}>{item.facilities?.name || 'Unknown Facility'}</Text>
                  <Text style={styles.conversationTime}>{formatConversationTime(item.last_message_at)}</Text>
                </View>
                <View style={styles.conversationMeta}>
                  {getStatusBadge(item.status)}
                </View>
              </TouchableOpacity>
            )}
          />
        )}
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 60 : 0}
    >
      <Header title={facilityDetails?.name || 'Messages'} onBack={() => setSelectedConversation(null)} showMessaging={false} />

      {/* Facility Details */}
      <View style={styles.facilityInfo}>
        <View style={styles.facilityInfoRow}>
          {getStatusBadge(selectedConversation.status)}
          {!selectedConversation.assigned_dispatcher_id && selectedConversation.status !== 'resolved' && (
            <TouchableOpacity
              style={styles.joinButton}
              onPress={handleJoinConversation}
              disabled={joining}
            >
              <Text style={styles.joinButtonText}>{joining ? 'Joining...' : 'Join Chat'}</Text>
            </TouchableOpacity>
          )}
          {selectedConversation.assigned_dispatcher_id && selectedConversation.status === 'active' && (
            <TouchableOpacity
              style={styles.endButton}
              onPress={handleEndConversation}
            >
              <Text style={styles.endButtonText}>End Chat</Text>
            </TouchableOpacity>
          )}
        </View>
        {facilityDetails && (
          <View style={styles.facilityDetails}>
            {facilityDetails.contact_email && (
              <Text style={styles.facilityDetailText}>
                <Ionicons name="mail" size={12} /> {facilityDetails.contact_email}
              </Text>
            )}
            {facilityDetails.phone_number && (
              <Text style={styles.facilityDetailText}>
                <Ionicons name="call" size={12} /> {facilityDetails.phone_number}
              </Text>
            )}
          </View>
        )}
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.messagesContainer}
        ListEmptyComponent={
          <View style={styles.emptyMessages}>
            <Text style={styles.emptyIcon}>💬</Text>
            <Text style={styles.emptyMessagesText}>No messages yet</Text>
            <Text style={styles.emptyMessagesSubtext}>
              Start the conversation by joining and sending a message
            </Text>
          </View>
        }
        onContentSizeChange={() => scrollToBottom()}
      />

      {/* Input */}
      {selectedConversation.status !== 'resolved' ? (
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            value={newMessage}
            onChangeText={setNewMessage}
            placeholder="Type your message..."
            placeholderTextColor="#999"
            maxLength={500}
            multiline
          />
          <TouchableOpacity
            style={[styles.sendButton, (!newMessage.trim() || sending) && styles.sendButtonDisabled]}
            onPress={sendMessage}
            disabled={!newMessage.trim() || sending}
          >
            <Ionicons name="send" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.resolvedContainer}>
          <Text style={styles.resolvedText}>
            This conversation has been resolved.
          </Text>
        </View>
      )}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  conversationsList: {
    padding: 16,
  },
  emptyIcon: {
    fontSize: 80,
    textAlign: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a1a1a',
    textAlign: 'center',
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  conversationCard: {
    backgroundColor: '#fff',
    padding: 16,
    marginBottom: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  facilityName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    flex: 1,
  },
  conversationTime: {
    fontSize: 12,
    color: '#999',
  },
  conversationMeta: {
    flexDirection: 'row',
  },
  statusBadgeActive: {
    backgroundColor: '#D4EDDA',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusTextActive: {
    fontSize: 11,
    color: '#155724',
    fontWeight: '600',
  },
  statusBadgeResolved: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusTextResolved: {
    fontSize: 11,
    color: '#4A5568',
    fontWeight: '600',
  },
  statusBadgeWaiting: {
    backgroundColor: '#FFF3CD',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusTextWaiting: {
    fontSize: 11,
    color: '#856404',
    fontWeight: '600',
  },
  facilityInfo: {
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  facilityInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  joinButton: {
    backgroundColor: BRAND_COLOR,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  joinButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  endButton: {
    backgroundColor: '#DC3545',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  endButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  facilityDetails: {
    gap: 4,
  },
  facilityDetailText: {
    fontSize: 12,
    color: '#666',
  },
  messagesContainer: {
    padding: 16,
    flexGrow: 1,
  },
  emptyMessages: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyMessagesText: {
    fontSize: 18,
    color: '#666',
    marginTop: 12,
  },
  emptyMessagesSubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
  messageContainer: {
    marginBottom: 12,
  },
  messageLeft: {
    alignItems: 'flex-start',
  },
  messageRight: {
    alignItems: 'flex-end',
  },
  messageBubble: {
    maxWidth: '70%',
    borderRadius: 16,
    padding: 12,
  },
  messageBubbleDispatcher: {
    backgroundColor: BRAND_COLOR,
    borderBottomRightRadius: 4,
  },
  messageBubbleFacility: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  messageTextDispatcher: {
    color: '#fff',
  },
  messageTextFacility: {
    color: '#1a1a1a',
  },
  messageTime: {
    fontSize: 11,
    marginTop: 4,
  },
  messageTimeDispatcher: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  messageTimeFacility: {
    color: '#999',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 100,
    marginRight: 8,
  },
  sendButton: {
    backgroundColor: BRAND_COLOR,
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
  },
  resolvedContainer: {
    padding: 16,
    backgroundColor: '#f0f0f0',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  resolvedText: {
    textAlign: 'center',
    color: '#666',
    fontSize: 14,
  },
});

export default MessagingScreen;
