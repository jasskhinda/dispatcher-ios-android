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

// Request notification permissions
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
      console.log('⚠️ Notification permissions not granted');
      return null;
    }

    console.log('✅ Notification permissions granted');

    // Try to get Expo push token
    try {
      const projectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
      if (!projectId) {
        console.log('⚠️ EAS Project ID not configured - push notifications will be limited to local only');
      }
      token = (await Notifications.getExpoPushTokenAsync({
        projectId: projectId,
      })).data;
      console.log('✅ Expo push token:', token);
    } catch (error) {
      console.log('⚠️ Could not get Expo push token (this is OK for local notifications):', error.message);
      token = 'LOCAL_NOTIFICATIONS_ONLY';
    }
  } else {
    console.log('Must use physical device for Push Notifications');
  }

  return token;
}

// Save push token to database
// NOTE: OneSignal now handles push notifications via OneSignal.login(userId)
// This function is kept for backward compatibility but no longer saves to database
export async function savePushToken(userId, token) {
  // OneSignal handles push tokens automatically via OneSignal.login()
  // No need to save to push_tokens table anymore
  console.log('✅ Push token registered (OneSignal handles delivery)');
}

// Schedule a local notification
export async function scheduleLocalNotification(title, body, data = {}, triggerSeconds = null) {
  try {
    console.log('📨 scheduleLocalNotification called with:', { title, body, data, triggerSeconds });

    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
        color: '#5fbfc0',
      },
      trigger: triggerSeconds ? { seconds: triggerSeconds } : null,
    });

    console.log('✅ Notification scheduled with ID:', notificationId);
    return notificationId;
  } catch (error) {
    console.error('❌ Error scheduling notification:', error);
    throw error;
  }
}

// Cancel all scheduled notifications
export async function cancelAllScheduledNotifications() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

// Get notification badge count
export async function getBadgeCount() {
  return await Notifications.getBadgeCountAsync();
}

// Set notification badge count
export async function setBadgeCount(count) {
  await Notifications.setBadgeCountAsync(count);
}

// Dispatcher notification messages
export function getDispatcherNotificationMessage(type, tripDetails = {}) {
  const messages = {
    driver_accepted: {
      title: '✅ Driver Accepted Trip',
      body: `Driver accepted trip${tripDetails.clientName ? ' for ' + tripDetails.clientName : ''}`,
    },
    driver_rejected: {
      title: '❌ Driver Rejected Trip',
      body: `Driver rejected trip${tripDetails.clientName ? ' for ' + tripDetails.clientName : ''}`,
    },
    trip_started: {
      title: '🛣️ Trip Started',
      body: `Driver started trip${tripDetails.clientName ? ' for ' + tripDetails.clientName : ''}`,
    },
    trip_completed: {
      title: '✅ Trip Completed',
      body: `Driver completed trip${tripDetails.clientName ? ' for ' + tripDetails.clientName : ''}`,
    },
  };

  return messages[type] || {
    title: 'Trip Notification',
    body: 'Trip status has been updated',
  };
}

// Save notification to history
// NOTE: This is optional - notifications are handled by OneSignal now
export async function saveNotificationToHistory(userId, title, body, data = {}) {
  // Notification history is optional - OneSignal tracks notifications
  console.log('📝 Notification received:', { title, body, data });
}
