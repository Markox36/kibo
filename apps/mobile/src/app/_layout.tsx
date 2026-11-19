import '../global.css';

import { useEffect } from 'react';
import { View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '../lib/query';
import { useAuthStore } from '../store/auth';

/**
 * Redirects between the auth screen and the app depending on session state,
 * but only once persisted storage has finished hydrating (so we don't flash
 * the login screen for an already-signed-in user on cold start).
 */
function useAuthGate() {
  const hydrated = useAuthStore((s) => s.hydrated);
  const token = useAuthStore((s) => s.accessToken);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!hydrated) return;
    const inAuthGroup = segments[0] === 'login' || segments[0] === 'register';
    if (!token && !inAuthGroup) {
      router.replace('/login');
    } else if (token && inAuthGroup) {
      router.replace('/');
    }
  }, [hydrated, token, segments, router]);
}

export default function RootLayout() {
  useAuthGate();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <View className="flex-1 bg-kibo-bg">
            <StatusBar style="light" />
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: '#0a0a0b' },
                animation: 'fade',
              }}
            >
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="login" />
              <Stack.Screen name="register" />
              <Stack.Screen name="focus" options={{ animation: 'slide_from_bottom' }} />
              <Stack.Screen name="unscheduled" options={{ animation: 'slide_from_right' }} />
            </Stack>
          </View>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
