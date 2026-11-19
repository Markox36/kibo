// "Plan my day" suggestions: fills free slots with candidate tasks and applies
// the chosen blocks to the calendar. Ported from the web modal.
import { useEffect, useMemo, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { suggestPlanForDay } from '@kibo/planning';
import { Sheet } from '../ui/Sheet';
import { Icon } from '../ui/Icon';
import { colors } from '../theme/colors';
import { useEvents } from '../hooks/useEvents';
import { useTasks, useUpdateTask } from '../hooks/useTasks';
import { usePrefs } from '../store/prefs';
import type { TaskDto } from '../lib/entities-api';

interface Props {
  open: boolean;
  onClose: () => void;
  targetDate?: Date;
}

function fmtTime(d: Date): string {
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

function fmtMinutes(m: number): string {
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return mm === 0 ? `${h}h` : `${h}h ${mm}m`;
}

function toIso(d: Date): string {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 19);
}

function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function toPlannerTask(t: TaskDto) {
  return {
    id: t.id,
    title: t.title,
    status: t.status,
    priority: t.priority,
    energy: t.energy,
    estimatedMinutes: t.estimatedMinutes,
    plannedDate: t.plannedDate,
    plannedStart: t.plannedStart,
    plannedEnd: t.plannedEnd,
    dueDate: t.dueDate,
    updatedAt: t.updatedAt,
  };
}

export function PlanMyDayModal({ open, onClose, targetDate }: Props) {
  const tasks = useTasks();
  const events = useEvents();
  const wh = usePrefs((s) => s.workingHours);
  const update = useUpdateTask();

  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [applying, setApplying] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const date = targetDate ?? new Date();
  const dateKey = toDateKey(date);

  const suggestions = useMemo(() => {
    if (!open) return [];
    return suggestPlanForDay(date, (tasks.data ?? []).map(toPlannerTask), events.data ?? [], wh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, dateKey, tasks.data, events.data, wh]);

  useEffect(() => {
    if (open) {
      setDismissed(new Set());
      setResult(null);
    }
  }, [open, dateKey]);

  const visible = suggestions.filter((s) => !dismissed.has(s.taskId));

  const apply = async () => {
    if (visible.length === 0 || applying) return;
    setApplying(true);
    let failed = 0;
    for (const s of visible) {
      try {
        await update.mutateAsync({
          id: s.taskId,
          plannedDate: dateKey,
          plannedStart: toIso(s.start),
          plannedEnd: toIso(s.end),
        });
      } catch {
        failed += 1;
      }
    }
    setApplying(false);
    if (failed === 0) {
      onClose();
    } else {
      setResult(`${failed} de ${visible.length} bloques no se pudieron aplicar.`);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Planificar mi día"
      description="Kibo sugiere bloques en tus huecos libres. Quita los que no encajen y aplica al calendario."
      footer={
        <View className="flex-row items-center gap-2">
          <Text className="mr-auto text-xs text-kibo-muted">
            {visible.length} bloques · {fmtMinutes(visible.reduce((n, s) => n + s.minutes, 0))}
          </Text>
          <TouchableOpacity
            onPress={onClose}
            disabled={applying}
            className="h-10 items-center justify-center rounded-lg border border-kibo-border px-4"
          >
            <Text className="text-sm text-kibo-text">Cancelar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={apply}
            disabled={visible.length === 0 || applying}
            className={`h-10 flex-row items-center gap-1.5 rounded-lg bg-kibo-accentDeep px-4 ${
              visible.length === 0 || applying ? 'opacity-60' : ''
            }`}
          >
            <Icon name="check" size={14} color="#fff" />
            <Text className="text-sm font-semibold text-white">
              {applying ? 'Aplicando…' : 'Aplicar'}
            </Text>
          </TouchableOpacity>
        </View>
      }
    >
      {suggestions.length === 0 ? (
        <View className="items-center py-6">
          <Icon name="zap" size={22} color={colors.muted} />
          <Text className="mt-2 text-center text-sm text-kibo-muted">
            No hay huecos libres o no tienes tareas candidatas para planificar hoy.
          </Text>
          <Text className="mt-1 text-center text-[11px] text-kibo-muted">
            Revisa el horario laboral en Ajustes o añade duración estimada a tus tareas.
          </Text>
        </View>
      ) : (
        <View className="gap-2">
          {suggestions.map((s) => {
            const isDismissed = dismissed.has(s.taskId);
            return (
              <View
                key={s.taskId}
                className={`flex-row items-start gap-3 rounded-lg border px-3 py-2 ${
                  isDismissed
                    ? 'border-kibo-border/40 bg-kibo-bg/20 opacity-40'
                    : 'border-kibo-border bg-kibo-bg/40'
                }`}
              >
                <Text className="w-24 pt-0.5 text-xs text-kibo-muted">
                  {fmtTime(s.start)}–{fmtTime(s.end)}
                </Text>
                <View className="flex-1">
                  <Text className="text-sm text-kibo-text" numberOfLines={1}>
                    {s.taskTitle}
                  </Text>
                  {s.reasons.length > 0 ? (
                    <Text className="mt-0.5 text-[11px] text-kibo-muted">
                      {s.reasons.join(' · ')} · {fmtMinutes(s.minutes)}
                    </Text>
                  ) : null}
                </View>
                <TouchableOpacity
                  onPress={() =>
                    setDismissed((prev) => {
                      const next = new Set(prev);
                      if (isDismissed) next.delete(s.taskId);
                      else next.add(s.taskId);
                      return next;
                    })
                  }
                  hitSlop={8}
                  className="h-7 w-7 items-center justify-center rounded-md border border-kibo-border/60"
                >
                  <Icon name={isDismissed ? 'rotate-ccw' : 'x'} size={12} color={colors.muted} />
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      )}
      {result ? <Text className="mt-3 text-sm text-red-400">{result}</Text> : null}
    </Sheet>
  );
}
