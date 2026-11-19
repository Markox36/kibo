import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { ensureNotificationSetup } from './notifications';

/**
 * Remote push (FCM) client. This is the correct client-side code, but real
 * push delivery is NOT yet functional because it depends on infrastructure
 * that doesn't exist yet:
 *
 *   1. A Firebase project + `google-services.json` placed at apps/mobile and
 *      referenced from app.json (`android.googleServicesFile`). Without it,
 *      `getDevicePushTokenAsync()` throws on Android — hence the try/catch.
 *      A native rebuild (`expo run:android`) is required after adding it.
 *   2. Backend push infrastructure: the `@kibo/api` `devices` module stores
 *      device metadata but has NO `pushToken` field and NO FCM sender
 *      (no firebase-admin / expo-server-sdk). That has to be added server-side
 *      before a token is worth uploading.
 *
 * Until both exist, this returns null and the app relies on the (working)
 * local notifications in ./notifications.ts.
 */
export async function getDevicePushToken(): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  const ready = await ensureNotificationSetup();
  if (!ready) return null;
  try {
    const token = await Notifications.getDevicePushTokenAsync();
    return token.data;
  } catch (err) {
    // Expected until google-services.json is baked into the build.
    console.warn('[push] device token unavailable (Firebase not configured yet):', err);
    return null;
  }
}
