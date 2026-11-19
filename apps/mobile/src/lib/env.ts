import { Platform } from 'react-native';

// On the Android emulator, `localhost` points at the emulator itself; the host
// machine running the API is reachable at 10.0.2.2. iOS simulator can use localhost.
const devDefault = Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000';

export const API_URL: string = process.env.EXPO_PUBLIC_API_URL ?? devDefault;
export const GOOGLE_CLIENT_ID: string = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ?? '';
