// Lightweight date/time inputs (no native picker dependency): a masked
// TextInput plus quick-select chips for the common cases.
import { Pressable, Text, TextInput, View } from 'react-native';
import { colors } from '../theme/colors';

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

export function isoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function isValidDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00`);
  return !Number.isNaN(d.getTime()) && isoDate(d) === s;
}

export function isValidTime(s: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
}

export function DateInput({
  value,
  onChange,
  allowClear = true,
}: {
  value: string;
  onChange: (v: string) => void;
  allowClear?: boolean;
}) {
  const today = new Date();
  const tomorrow = new Date(today.getTime() + 86400000);
  const nextWeek = new Date(today.getTime() + 7 * 86400000);
  const invalid = value !== '' && !isValidDate(value);
  return (
    <View className="gap-2">
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder="AAAA-MM-DD"
        placeholderTextColor={colors.muted}
        keyboardType="numbers-and-punctuation"
        autoCapitalize="none"
        className={`h-10 rounded-lg border bg-kibo-bg px-3 text-sm text-kibo-text ${
          invalid ? 'border-red-400/60' : 'border-kibo-border'
        }`}
      />
      <View className="flex-row flex-wrap gap-2">
        <QuickChip label="Hoy" onPress={() => onChange(isoDate(today))} />
        <QuickChip label="Mañana" onPress={() => onChange(isoDate(tomorrow))} />
        <QuickChip label="+7 días" onPress={() => onChange(isoDate(nextWeek))} />
        {allowClear && value ? <QuickChip label="Quitar" onPress={() => onChange('')} /> : null}
      </View>
    </View>
  );
}

export function TimeInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const invalid = value !== '' && !isValidTime(value);
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder="HH:MM"
      placeholderTextColor={colors.muted}
      keyboardType="numbers-and-punctuation"
      autoCapitalize="none"
      className={`h-10 rounded-lg border bg-kibo-bg px-3 text-sm text-kibo-text ${
        invalid ? 'border-red-400/60' : 'border-kibo-border'
      }`}
    />
  );
}

function QuickChip({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className="h-7 items-center justify-center rounded-full border border-kibo-border px-2.5"
    >
      <Text className="text-[11px] text-kibo-muted">{label}</Text>
    </Pressable>
  );
}
