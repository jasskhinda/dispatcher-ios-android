import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

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

    try {
      token = (await Notifications.getExpoPushTokenAsync()).data;
      console.log('Expo Push Token:', token);
    } catch (error) {
      console.log('⚠️ Push notifications not available in Expo Go without projectId');
      console.log('Push notifications will work in production builds');
      return null;
    }
  } else {
    console.log('Must use physical device for Push Notifications');
  }

  return token;
}

// Save push token to user profile
// NOTE: OneSignal now handles push notifications via OneSignal.login(userId)
// This function is kept for backward compatibility but no longer saves to database
export async function savePushToken(userId, pushToken) {
  if (!pushToken) return;

  // OneSignal handles push tokens automatically via OneSignal.login()
  // No need to save expo_push_token to database anymore
  console.log('Push token registered (OneSignal handles delivery)');
}

// Remove push token on logout
// NOTE: OneSignal handles logout via OneSignal.logout()
// This function is kept for backward compatibility
export async function removePushToken() {
  // OneSignal handles push token cleanup automatically via OneSignal.logout()
  console.log('Push token cleanup (OneSignal handles this)');
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
  if (!listeners) return;

  try {
    // In newer versions of expo-notifications, subscriptions have a remove() method
    if (listeners.notificationListener) {
      if (typeof listeners.notificationListener.remove === 'function') {
        listeners.notificationListener.remove();
      } else if (typeof Notifications.removeNotificationSubscription === 'function') {
        Notifications.removeNotificationSubscription(listeners.notificationListener);
      }
    }

    if (listeners.responseListener) {
      if (typeof listeners.responseListener.remove === 'function') {
        listeners.responseListener.remove();
      } else if (typeof Notifications.removeNotificationSubscription === 'function') {
        Notifications.removeNotificationSubscription(listeners.responseListener);
      }
    }
  } catch (error) {
    console.log('Error cleaning up notification listeners:', error);
  }
}
