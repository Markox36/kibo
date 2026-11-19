// Deadline-risk card: tasks whose free time before the deadline is not enough.
import { Text, View } from 'react-native';
import { Card } from '../ui/primitives';
import { Icon } from '../ui/Icon';
import { useDeadlineWarnings } from '../hooks/useDeadlineWarnings';

function fmtMinutes(m: number): string {
  const total = Math.round(m);
  if (total < 60) return `${total}m`;
  const h = Math.floor(total / 60);
  const mm = total % 60;
  return mm === 0 ? `${h}h` : `${h}h ${mm}m`;
}

function daysLabel(n: number): string {
  if (n === 0) return 'vence hoy';
  if (n === 1) return 'vence mañana';
  return `vence en ${n} días`;
}

export function DeadlineWarningsCard() {
  const warnings = useDeadlineWarnings();
  if (warnings.length === 0) return null;
  const visible = warnings.slice(0, 4);
  const rest = warnings.length - visible.length;

  return (
    <Card className="border-rose-500/30 bg-rose-500/5 p-4">
      <View className="mb-3 flex-row items-center gap-2">
        <Icon name="alert-triangle" size={14} color="#fb7185" />
        <Text className="text-sm font-medium text-rose-200">
          Deadlines en riesgo{warnings.length > 1 ? ` (${warnings.length})` : ''}
        </Text>
      </View>
      <View className="gap-2">
        {visible.map((w) => (
          <View
            key={w.taskId}
            className="flex-row items-start justify-between gap-3 rounded-lg bg-kibo-bg/40 px-3 py-2"
          >
            <View className="flex-1">
              <Text className="text-sm text-kibo-text" numberOfLines={1}>
                {w.taskTitle}
              </Text>
              <Text className="mt-0.5 text-[11px] text-kibo-muted">
                Necesita {fmtMinutes(w.estimatedMinutes)} · libre{' '}
                {fmtMinutes(w.freeMinutesUntilDeadline)} · {daysLabel(w.daysUntilDeadline)}
              </Text>
            </View>
            <Text className="text-xs font-medium text-rose-300">−{fmtMinutes(w.deficitMinutes)}</Text>
          </View>
        ))}
      </View>
      {rest > 0 ? (
        <Text className="mt-3 text-[11px] text-kibo-muted">
          y {rest} más con tiempo insuficiente antes del deadline.
        </Text>
      ) : null}
    </Card>
  );
}
