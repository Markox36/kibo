// Bottom-sheet style modal used by the form dialogs, mirroring the web Modal.
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import type { ReactNode } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from './Icon';
import { colors } from '../theme/colors';

export function Sheet({
  open,
  onClose,
  title,
  description,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/60">
        <Pressable className="flex-1" onPress={onClose} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View
            className="max-h-full rounded-t-2xl border-t border-kibo-border bg-kibo-surface"
            style={{ paddingBottom: Math.max(insets.bottom, 12) }}
          >
            <View className="flex-row items-start justify-between px-5 pb-2 pt-4">
              <View className="flex-1 pr-3">
                <Text className="text-lg font-semibold text-kibo-text">{title}</Text>
                {description ? (
                  <Text className="mt-0.5 text-xs text-kibo-muted">{description}</Text>
                ) : null}
              </View>
              <Pressable onPress={onClose} hitSlop={10} className="mt-1">
                <Icon name="x" size={20} color={colors.muted} />
              </Pressable>
            </View>
            <ScrollView
              contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 8 }}
              style={{ maxHeight: 480 }}
              keyboardShouldPersistTaps="handled"
            >
              {children}
            </ScrollView>
            {footer ? <View className="border-t border-kibo-border px-5 pt-3">{footer}</View> : null}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

/** Small labeled field wrapper used inside sheets. */
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View className="mb-3">
      <Text className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-kibo-muted">
        {label}
      </Text>
      {children}
    </View>
  );
}

/** Horizontal chip selector (single choice). */
export function Chips<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Array<{ v: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View className="flex-row flex-wrap gap-2">
      {options.map((o) => {
        const active = o.v === value;
        return (
          <Pressable
            key={o.v}
            onPress={() => onChange(o.v)}
            className={`h-8 items-center justify-center rounded-full border px-3 ${
              active ? 'border-kibo-accent/50 bg-kibo-accentDeep/20' : 'border-kibo-border'
            }`}
          >
            <Text className={`text-xs ${active ? 'font-semibold text-kibo-accent' : 'text-kibo-muted'}`}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
