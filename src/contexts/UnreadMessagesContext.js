import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

const UnreadMessagesContext = createContext({
  unreadCount: 0,
  refreshUnreadCount: () => {},
});

export const UnreadMessagesProvider = ({ children }) => {
  const [unreadCount, setUnreadCount] = useState(0);
  const { user } = useAuth();

  const fetchUnreadCount = async () => {
    if (!user?.id) {
      setUnreadCount(0);
      return;
    }

    try {
      // Count unread messages in all conversations
      const { count, error } = await supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('read_by_dispatcher', false)
        .eq('sender_type', 'facility');

      if (error) {
        console.error('Error fetching unread count:', error);
        return;
      }

      setUnreadCount(count || 0);
    } catch (err) {
      console.error('Error in fetchUnreadCount:', err);
    }
  };

  useEffect(() => {
    if (user?.id) {
      fetchUnreadCount();

      // Subscribe to new messages
      const subscription = supabase
        .channel('unread_messages_changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'messages',
            filter: `sender_type=eq.facility`,
          },
          (payload) => {
            console.log('Message change detected:', payload);
            fetchUnreadCount();
          }
        )
        .subscribe();

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [user?.id]);

  const refreshUnreadCount = () => {
    fetchUnreadCount();
  };

  return (
    <UnreadMessagesContext.Provider value={{ unreadCount, refreshUnreadCount }}>
      {children}
    </UnreadMessagesContext.Provider>
  );
};

export const useUnreadMessages = () => {
  const context = useContext(UnreadMessagesContext);
  if (context === undefined) {
    throw new Error('useUnreadMessages must be used within UnreadMessagesProvider');
  }
  return context;
};
