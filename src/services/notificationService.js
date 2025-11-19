import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Register for push notifications and get token
export async function registerForPushNotificationsAsync() {
  let token;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#5fbfc0',
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Failed to get push token for push notification!');
      return null;
    }

    token = (await Notifications.getExpoPushTokenAsync()).data;
    console.log('Expo Push Token:', token);
  } else {
    console.log('Must use physical device for Push Notifications');
  }

  return token;
}

// Save push token to user profile
export async function savePushToken(userId, pushToken) {
  if (!pushToken) return;

  try {
    const { error } = await supabase
      .from('profiles')
      .update({
        expo_push_token: pushToken,
        push_notifications_enabled: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (error) {
      console.error('Error saving push token:', error);
    } else {
      console.log('Push token saved successfully');
    }
  } catch (err) {
    console.error('Error in savePushToken:', err);
  }
}

// Remove push token on logout
export async function removePushToken(userId) {
  try {
    const { error } = await supabase
      .from('profiles')
      .update({
        expo_push_token: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (error) {
      console.error('Error removing push token:', error);
    }
  } catch (err) {
    console.error('Error in removePushToken:', err);
  }
}

// Set up notification listeners
export function setupNotificationListeners(navigation) {
  // Handle notification received while app is foregrounded
  const notificationListener = Notifications.addNotificationReceivedListener(notification => {
    console.log('Notification received:', notification);
  });

  // Handle notification tapped
  const responseListener = Notifications.addNotificationResponseReceivedListener(response => {
    console.log('Notification tapped:', response);

    const data = response.notification.request.content.data;

    // Navigate based on notification type
    if (data.type === 'trip') {
      if (data.tripId) {
        navigation.navigate('TripDetails', { tripId: data.tripId });
      } else if (data.source === 'booking_app') {
        navigation.navigate('IndividualTrips');
      } else if (data.source === 'facility_app') {
        navigation.navigate('FacilityTrips');
      }
    } else if (data.type === 'message') {
      navigation.navigate('Messages');
    }
  });

  return { notificationListener, responseListener };
}

// Clean up listeners
export function cleanupNotificationListeners(listeners) {
  if (listeners.notificationListener) {
    Notifications.removeNotificationSubscription(listeners.notificationListener);
  }
  if (listeners.responseListener) {
    Notifications.removeNotificationSubscription(listeners.responseListener);
  }
}
