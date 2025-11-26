import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { registerForPushNotificationsAsync, savePushToken, scheduleLocalNotification } from '../services/notifications';
import OneSignalService from '../../services/onesignalService';

const NotificationsContext = createContext();

export const useNotifications = () => {
  const context = useContext(NotificationsContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationsProvider');
  }
  return context;
};

export const NotificationsProvider = ({ children }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Fetch notifications from database
  const fetchNotifications = async () => {
    if (!user?.id) {
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
      return;
    }

    try {
      const { data, error} = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .eq('app_type', 'dispatcher') // Filter for dispatcher app notifications only
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      setNotifications(data || []);
      const unread = (data || []).filter(n => !n.read).length;
      setUnreadCount(unread);

      // Update OneSignal badge count
      await OneSignalService.setBadgeCount(unread);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  // Mark notification as read
  const markAsRead = async (notificationId) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true, read_at: new Date().toISOString() })
        .eq('id', notificationId);

      if (error) throw error;

      // Update local state
      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, read: true, read_at: new Date().toISOString() } : n)
      );
      const newCount = Math.max(0, unreadCount - 1);
      setUnreadCount(newCount);

      // Update OneSignal badge count
      await OneSignalService.setBadgeCount(newCount);
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  // Mark all notifications as read
  const markAllAsRead = async () => {
    if (!user?.id) return;

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true, read_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .eq('app_type', 'dispatcher')
        .eq('read', false);

      if (error) throw error;

      // Update local state
      setNotifications(prev =>
        prev.map(n => ({ ...n, read: true, read_at: new Date().toISOString() }))
      );
      setUnreadCount(0);

      // Clear OneSignal badge
      await OneSignalService.setBadgeCount(0);
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  // Delete notification
  const deleteNotification = async (notificationId) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId);

      if (error) throw error;

      // Update local state
      const deletedNotification = notifications.find(n => n.id === notificationId);
      setNotifications(prev => prev.filter(n => n.id !== notificationId));

      if (deletedNotification && !deletedNotification.read) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  // Initialize OneSignal when app starts
  useEffect(() => {
    console.log('🔔 Initializing OneSignal for dispatcher app');
    OneSignalService.initialize();
  }, []);

  // Register for push notifications when user logs in
  useEffect(() => {
    if (!user?.id) {
      // Logout from OneSignal on user logout
      OneSignalService.logout();
      return;
    }

    const registerPushNotifications = async () => {
      try {
        console.log('📱 Registering dispatcher for push notifications...');

        // Login to OneSignal with user ID (SDK 5.x)
        OneSignalService.login(user.id);

        // Set OneSignal tags for user segmentation (SDK 5.x)
        OneSignalService.addTags({
          user_id: user.id,
          app_type: 'dispatcher',
          role: 'dispatcher'
        });

        // Get OneSignal ID
        const playerId = await OneSignalService.getPlayerId();
        console.log('📱 OneSignal ID:', playerId);

        // Also register for legacy notifications (fallback)
        const token = await registerForPushNotificationsAsync();

        if (token && token !== 'LOCAL_NOTIFICATIONS_ONLY') {
          await savePushToken(user.id, token);
          console.log('💾 Dispatcher push token saved');
        }
      } catch (error) {
        console.error('Error registering push notifications:', error);
      }
    };

    registerPushNotifications();
  }, [user?.id]);

  // Set up real-time subscription for new notifications
  useEffect(() => {
    if (!user?.id) {
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
      return;
    }

    // Initial fetch
    fetchNotifications();

    // Subscribe to new notifications for this user and app_type
    const subscription = supabase
      .channel('notifications_dispatcher')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        async (payload) => {
          // Only add if it's for dispatcher app
          if (payload.new.app_type === 'dispatcher') {
            console.log('New notification received:', payload.new);
            setNotifications(prev => [payload.new, ...prev]);
            setUnreadCount(prev => {
              const newCount = prev + 1;
              // Update OneSignal badge count
              OneSignalService.setBadgeCount(newCount);
              return newCount;
            });

            // Show local notification
            try {
              await scheduleLocalNotification(
                payload.new.title,
                payload.new.body,
                payload.new.data
              );
            } catch (error) {
              console.error('Error showing local notification:', error);
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          // Only update if it's for dispatcher app
          if (payload.new.app_type === 'dispatcher') {
            console.log('Notification updated:', payload.new);
            setNotifications(prev =>
              prev.map(n => n.id === payload.new.id ? payload.new : n)
            );

            // Update unread count
            if (payload.old.read === false && payload.new.read === true) {
              setUnreadCount(prev => Math.max(0, prev - 1));
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          // Only delete if it's for dispatcher app
          if (payload.old.app_type === 'dispatcher') {
            console.log('Notification deleted:', payload.old);
            setNotifications(prev => prev.filter(n => n.id !== payload.old.id));

            if (payload.old.read === false) {
              setUnreadCount(prev => Math.max(0, prev - 1));
            }
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user?.id]);

  const value = {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refreshNotifications: fetchNotifications,
  };

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
};
