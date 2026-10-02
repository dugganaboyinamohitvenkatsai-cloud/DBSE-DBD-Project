import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { registerDeviceToken, unregisterDeviceToken } from '../api/parentApi';

let cachedDeviceToken = null;

// Configure foreground presentation behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Configure Android high-importance notification channel
 */
export async function setupNotificationChannels() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('schoolbus_safety_alerts', {
      name: 'SchoolBus Safety Alerts',
      description: 'High-priority notifications for stop arrivals, delays, and student safety updates.',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#2563EB',
      enableVibrate: true,
      showBadge: true,
    });
  }
}

/**
 * Request notification permissions and register FCM device push token with backend
 */
export async function registerPushTokenWithBackend() {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('[NotificationService] Notification permission not granted.');
      return null;
    }

    await setupNotificationChannels();

    // Acquire native device push token for FCM
    let token = null;
    try {
      const deviceTokenObj = await Notifications.getDevicePushTokenAsync();
      token = deviceTokenObj.data;
    } catch (tokenErr) {
      // In Expo Go or emulator without Google Play Services, fallback gracefully
      console.warn('[NotificationService] Device token acquisition note:', tokenErr.message);
      const expoPush = await Notifications.getExpoPushTokenAsync().catch(() => null);
      token = expoPush?.data || null;
    }

    if (token) {
      cachedDeviceToken = token;
      await registerDeviceToken(token, Platform.OS);
      console.log('[NotificationService] Successfully registered push token with backend.');
    }

    return token;
  } catch (err) {
    console.warn('[NotificationService] Failed to register push token:', err.message);
    return null;
  }
}

/**
 * Unregister device token upon user sign-out
 */
export async function unregisterPushTokenFromBackend() {
  if (cachedDeviceToken) {
    try {
      await unregisterDeviceToken(cachedDeviceToken);
      console.log('[NotificationService] Successfully unregistered push token from backend.');
    } catch (err) {
      console.warn('[NotificationService] Failed to unregister token:', err.message);
    } finally {
      cachedDeviceToken = null;
    }
  }
}
