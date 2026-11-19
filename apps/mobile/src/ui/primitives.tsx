import { ActivityIndicator, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ReactNode } from 'react';
import { colors } from '../theme/colors';
import { Icon, type IconName } from './Icon';

/** Full-screen dark background with top safe-area padding — the base of every tab. */
export function Screen({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View className="flex-1 bg-kibo-bg" style={{ paddingTop: insets.top }}>
      {children}
    </View>
  );
}

/** Page header: big title + optional subtitle and right-side slot. */
export function ScreenHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <View className="flex-row items-end justify-between px-5 pb-3 pt-2">
      <View className="flex-1">
        <Text className="text-2xl font-bold text-kibo-text">{title}</Text>
        {subtitle ? <Text className="mt-0.5 text-sm text-kibo-muted">{subtitle}</Text> : null}
      </View>
      {right ? <View className="ml-3">{right}</View> : null}
    </View>
  );
}

/** Surface card matching the web `rounded-xl border bg-kibo-surface`. */
export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <View className={`rounded-xl border border-kibo-border bg-kibo-surface ${className}`}>
      {children}
    </View>
  );
}

/** Section label above a group of cards. */
export function SectionTitle({ icon, children }: { icon?: IconName; children: ReactNode }) {
  return (
    <View className="mb-2 flex-row items-center gap-2 px-1">
      {icon ? <Icon name={icon} size={15} color={colors.muted} /> : null}
      {/* No letterSpacing here: on Android it makes RN mis-measure the text
          width and visually clip the last word. */}
      <Text className="pr-2 text-xs font-semibold uppercase text-kibo-muted">{children}</Text>
    </View>
  );
}

/** Centered empty / loading / error placeholder. */
export function CenterState({
  icon,
  title,
  subtitle,
  loading,
}: {
  icon?: IconName;
  title: string;
  subtitle?: string;
  loading?: boolean;
}) {
  return (
    <View className="flex-1 items-center justify-center gap-3 px-8 py-16">
      {loading ? (
        <ActivityIndicator color={colors.accent} />
      ) : icon ? (
        <Icon name={icon} size={30} color={colors.muted} />
      ) : null}
      <Text className="text-center text-base font-medium text-kibo-text">{title}</Text>
      {subtitle ? (
        <Text className="text-center text-sm text-kibo-muted">{subtitle}</Text>
      ) : null}
    </View>
  );
}
