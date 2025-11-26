import { OneSignal } from 'react-native-onesignal';
import Constants from 'expo-constants';

class OneSignalService {
  initialize() {
    const oneSignalAppId = Constants.expoConfig?.extra?.oneSignalAppId;

    if (!oneSignalAppId) {
      console.error('OneSignal App ID not found in app config');
      return;
    }

    console.log('🔔 Initializing OneSignal with App ID:', oneSignalAppId);

    // SDK 5.x initialization
    OneSignal.initialize(oneSignalAppId);

    // Request notification permissions
    OneSignal.Notifications.requestPermission(true);

    // Set up notification handlers
    OneSignal.Notifications.addEventListener('foregroundWillDisplay', (event) => {
      console.log('OneSignal: notification will show in foreground:', event);
      event.preventDefault();
      event.getNotification().display();
    });

    OneSignal.Notifications.addEventListener('click', (event) => {
      console.log('OneSignal: notification clicked:', event);
    });
  }

  login(userId) {
    if (!userId) {
      console.error('Cannot login: userId is required');
      return;
    }
    console.log('📱 OneSignal login with user ID:', userId);
    OneSignal.login(userId);
  }

  logout() {
    console.log('📱 OneSignal logout');
    OneSignal.logout();
  }

  async getPlayerId() {
    try {
      const onesignalId = await OneSignal.User.getOnesignalId();
      return onesignalId;
    } catch (error) {
      console.error('Error getting OneSignal ID:', error);
      return null;
    }
  }

  addTags(tags) {
    if (!tags || typeof tags !== 'object') {
      console.error('Cannot add tags: tags must be an object');
      return;
    }
    console.log('🏷️  Adding OneSignal tags:', tags);
    OneSignal.User.addTags(tags);
  }

  async setBadgeCount(count) {
    try {
      // Clear existing notifications
      OneSignal.Notifications.clearAll();
      console.log('📛 Cleared notifications, badge count:', count);
    } catch (error) {
      console.error('Error setting badge count:', error);
    }
  }
}

export default new OneSignalService();
