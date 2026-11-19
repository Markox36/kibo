// Full-screen focus mode (pomodoro / custom timer / stopwatch), ported from web.
import { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Icon } from '../ui/Icon';
import { Card } from '../ui/primitives';
import { colors } from '../theme/colors';
import {
  useFocus,
  currentRemainingMs,
  formatMs,
  phaseLabel,
  type FocusMode,
} from '../store/focus';
import { usePrefs } from '../store/prefs';
import { useTasks, useUpdateTask } from '../hooks/useTasks';
import { useCreateTimeEntry } from '../hooks/useTimeEntries';

export default function FocusScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ taskId?: string }>();
  const focus = useFocus();
  const pomodoro = usePrefs((s) => s.pomodoro);
  const customTimer = usePrefs((s) => s.customTimer);
  const tasks = useTasks();
  const updateTask = useUpdateTask();
  const createTimeEntry = useCreateTimeEntry();
  const [now, setNow] = useState(Date.now());
  const [modeChoice, setModeChoice] = useState<FocusMode>('pomodoro');

  const activeTaskId = focus.taskId ?? params.taskId ?? null;
  const task = useMemo(
    () => (activeTaskId ? ((tasks.data ?? []).find((t) => t.id === activeTaskId) ?? null) : null),
    [activeTaskId, tasks.data],
  );

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (focus.phase === 'idle') return;
    focus.tick(now);
  }, [now, focus]);

  const remaining = currentRemainingMs(focus, now);
  const isRunning = focus.phase !== 'idle';
  const isBreak = focus.phase === 'short_break' || focus.phase === 'long_break';

  const startFocus = (mode: FocusMode) => {
    const plan =
      mode === 'stopwatch'
        ? { workMin: 0, shortBreakMin: 0, longBreakMin: 0, cyclesBeforeLong: 4 }
        : mode === 'custom'
          ? {
              workMin: customTimer.workMin,
              shortBreakMin: customTimer.breakMin,
              longBreakMin: customTimer.breakMin * 2,
              cyclesBeforeLong: 4,
            }
          : pomodoro;
    focus.start(mode, plan, activeTaskId);
  };

  const persistSession = async (payload: ReturnType<typeof focus.stop>) => {
    if (!payload || payload.durationSeconds < 5) return;
    const persistMode = payload.mode === 'stopwatch' ? 'stopwatch' : 'pomodoro';
    try {
      await createTimeEntry.mutateAsync({
        taskId: payload.taskId,
        startedAt: payload.startedAt,
        endedAt: payload.endedAt,
        durationSeconds: payload.durationSeconds,
        type: persistMode,
      });
    } catch {
      Alert.alert('Error', 'No se pudo guardar la sesión.');
    }
  };

  const stopAndSave = async () => {
    const payload = focus.stop();
    await persistSession(payload);
  };

  const stopAndComplete = async () => {
    const payload = focus.stop();
    await persistSession(payload);
    if (task) {
      try {
        await updateTask.mutateAsync({ id: task.id, status: 'done' });
      } catch {
        Alert.alert('Error', 'No se pudo completar la tarea.');
      }
    }
    router.back();
  };

  const goBack = () => {
    if (isRunning) {
      Alert.alert('Sesión activa', '¿Salir sin guardar la sesión?', [
        { text: 'Seguir', style: 'cancel' },
        {
          text: 'Salir',
          style: 'destructive',
          onPress: () => {
            focus.stop();
            router.back();
          },
        },
      ]);
      return;
    }
    router.back();
  };

  const toggleSubtask = (subtaskId: string, done: boolean) => {
    if (!task) return;
    const nextSubtasks = task.subtasks.map((s) => (s.id === subtaskId ? { ...s, done } : s));
    updateTask.mutate({ id: task.id, subtasks: nextSubtasks });
  };

  return (
    <SafeAreaView className="flex-1 bg-kibo-bg">
      <View className="flex-row items-center justify-between px-5 py-3">
        <TouchableOpacity onPress={goBack} className="flex-row items-center gap-1.5" hitSlop={8}>
          <Icon name="arrow-left" size={16} color={colors.muted} />
          <Text className="text-sm text-kibo-muted">Salir</Text>
        </TouchableOpacity>
        <Text className="text-[11px] uppercase tracking-widest text-kibo-muted">Focus</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 24, gap: 28, flexGrow: 1 }}>
        <View className="items-center">
          {task ? (
            <>
              <Text className="mb-2 text-[11px] uppercase tracking-widest text-kibo-muted">
                Trabajando en
              </Text>
              <Text className="text-center text-2xl font-semibold text-kibo-text">{task.title}</Text>
              <View className="mt-2 flex-row items-center gap-3">
                {task.priority ? (
                  <Text className="text-xs text-kibo-muted">Prioridad {task.priority}</Text>
                ) : null}
                {task.estimatedMinutes ? (
                  <Text className="text-xs text-kibo-muted">{task.estimatedMinutes}m estimados</Text>
                ) : null}
              </View>
            </>
          ) : (
            <Text className="text-2xl font-semibold text-kibo-text">Sesión de Focus libre</Text>
          )}
        </View>

        <View className="items-center">
          <View className="mb-4 flex-row items-center gap-2 rounded-full border border-kibo-border bg-kibo-surface/60 px-3 py-1">
            <Icon name={isBreak ? 'coffee' : 'clock'} size={12} color={colors.muted} />
            <Text className="text-[11px] uppercase tracking-widest text-kibo-text">
              {phaseLabel(focus.phase)}
            </Text>
          </View>
          <Text className="font-mono text-7xl text-kibo-text">{formatMs(remaining)}</Text>
          {focus.mode === 'pomodoro' && isRunning ? (
            <Text className="mt-3 text-xs text-kibo-muted">
              Ciclos completados: {focus.cyclesCompleted}
            </Text>
          ) : null}
        </View>

        {!isRunning ? (
          <View className="items-center gap-3">
            <View className="flex-row flex-wrap justify-center gap-2">
              <ModeChip
                active={modeChoice === 'pomodoro'}
                onPress={() => setModeChoice('pomodoro')}
                label={`Pomodoro ${pomodoro.workMin}m`}
              />
              <ModeChip
                active={modeChoice === 'custom'}
                onPress={() => setModeChoice('custom')}
                label={`Timer ${customTimer.workMin}m`}
              />
              <ModeChip
                active={modeChoice === 'stopwatch'}
                onPress={() => setModeChoice('stopwatch')}
                label="Cronómetro"
              />
            </View>
            <TouchableOpacity
              onPress={() => startFocus(modeChoice)}
              activeOpacity={0.8}
              className="h-11 flex-row items-center gap-2 rounded-lg bg-kibo-accentDeep px-6"
            >
              <Icon name="play" size={16} color="#fff" />
              <Text className="text-sm font-semibold text-white">Iniciar sesión</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View className="flex-row flex-wrap items-center justify-center gap-2">
            {focus.paused ? (
              <ActionBtn primary icon="play" label="Reanudar" onPress={focus.resume} />
            ) : (
              <ActionBtn icon="pause" label="Pausar" onPress={focus.pause} />
            )}
            {focus.mode !== 'stopwatch' ? (
              <ActionBtn icon="skip-forward" label="Siguiente fase" onPress={focus.skipPhase} />
            ) : null}
            <ActionBtn icon="square" label="Detener y guardar" onPress={stopAndSave} />
            {task ? (
              <ActionBtn primary icon="check" label="Guardar y completar" onPress={stopAndComplete} />
            ) : null}
          </View>
        )}

        {task && task.subtasks.length > 0 ? (
          <Card className="p-4">
            <Text className="mb-3 text-[11px] uppercase tracking-widest text-kibo-muted">
              Subtareas ({task.subtasks.filter((s) => s.done).length}/{task.subtasks.length})
            </Text>
            <View className="gap-2">
              {task.subtasks
                .slice()
                .sort((a, b) => a.order - b.order)
                .map((s) => (
                  <TouchableOpacity
                    key={s.id}
                    onPress={() => toggleSubtask(s.id, !s.done)}
                    className="flex-row items-center gap-2"
                  >
                    <Icon
                      name={s.done ? 'check-square' : 'square'}
                      size={16}
                      color={s.done ? colors.accent : colors.muted}
                    />
                    <Text
                      className={`text-sm ${s.done ? 'text-kibo-muted line-through' : 'text-kibo-text'}`}
                    >
                      {s.text}
                    </Text>
                  </TouchableOpacity>
                ))}
            </View>
          </Card>
        ) : null}

        {task?.description ? (
          <Card className="p-4">
            <Text className="mb-3 text-[11px] uppercase tracking-widest text-kibo-muted">Notas</Text>
            <Text className="text-sm text-kibo-text">{task.description}</Text>
          </Card>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function ModeChip({ active, onPress, label }: { active: boolean; onPress: () => void; label: string }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className={`h-8 items-center justify-center rounded-full border px-3 ${
        active ? 'border-kibo-accent/40 bg-kibo-accentDeep/15' : 'border-kibo-border'
      }`}
    >
      <Text className={`text-xs ${active ? 'text-kibo-accent' : 'text-kibo-muted'}`}>{label}</Text>
    </TouchableOpacity>
  );
}

function ActionBtn({
  icon,
  label,
  onPress,
  primary,
}: {
  icon: React.ComponentProps<typeof Icon>['name'];
  label: string;
  onPress: () => void;
  primary?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      className={`h-10 flex-row items-center gap-1.5 rounded-lg px-3 ${
        primary ? 'bg-kibo-accentDeep' : 'border border-kibo-border'
      }`}
    >
      <Icon name={icon} size={14} color={primary ? '#fff' : colors.text} />
      <Text className={`text-sm font-medium ${primary ? 'text-white' : 'text-kibo-text'}`}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}
