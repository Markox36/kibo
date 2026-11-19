import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, type IconName } from '../../ui/Icon';
import { colors } from '../../theme/colors';
import { useReminderSync } from '../../hooks/useReminderSync';
import { useWidgetSync } from '../../hooks/useWidgetSync';

const tabIcon =
  (name: IconName) =>
  ({ color, size }: { color: ColorValue; size: number }) =>
    <Icon name={name} color={color} size={size} />;

export default function TabsLayout() {
  useReminderSync();
  useWidgetSync();
  // Bottom inset so the tab bar clears Android gesture-navigation bars (e.g. MIUI).
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, 10);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        // Mount every tab at startup so switching is instant (no lazy spinner).
        lazy: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 52 + bottomPad,
          paddingBottom: bottomPad,
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '500' },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Hoy', tabBarIcon: tabIcon('home') }} />
      <Tabs.Screen
        name="calendar"
        options={{ title: 'Calendario', tabBarIcon: tabIcon('calendar') }}
      />
      <Tabs.Screen name="tasks" options={{ title: 'Tareas', tabBarIcon: tabIcon('check-square') }} />
      <Tabs.Screen name="inbox" options={{ title: 'Inbox', tabBarIcon: tabIcon('inbox') }} />
      <Tabs.Screen
        name="settings"
        options={{ title: 'Ajustes', tabBarIcon: tabIcon('settings') }}
      />
    </Tabs>
  );
}
