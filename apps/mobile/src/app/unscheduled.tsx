// "Sin planificar": pending tasks with no day assigned, bucketed by urgency.
import { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Card, CenterState } from '../ui/primitives';
import { Icon, type IconName } from '../ui/Icon';
import { colors, priorityColors, priorityLabel } from '../theme/colors';
import { useTasks, useUpdateTask } from '../hooks/useTasks';
import { TaskFormModal } from '../components/TaskFormModal';
import { todayIso } from '../lib/format';
import type { TaskDto } from '../lib/entities-api';

interface Buckets {
  overdue: TaskDto[];
  deadlineNoPlan: TaskDto[];
  draggedFromPast: TaskDto[];
  undated: TaskDto[];
}

function bucketize(tasks: TaskDto[], today: string): Buckets {
  const out: Buckets = { overdue: [], deadlineNoPlan: [], draggedFromPast: [], undated: [] };
  for (const t of tasks) {
    if (t.status === 'done' || t.status === 'cancelled') continue;
    const dueKey = t.dueDate?.slice(0, 10);
    const plannedKey = t.plannedDate?.slice(0, 10);
    const isOverdue = dueKey && dueKey < today;
    const isDraggedPast = plannedKey && plannedKey < today;
    const hasPlan = Boolean(plannedKey && plannedKey >= today);
    if (isOverdue) {
      out.overdue.push(t);
    } else if (isDraggedPast && !hasPlan) {
      out.draggedFromPast.push(t);
    } else if (!hasPlan && dueKey && dueKey >= today) {
      out.deadlineNoPlan.push(t);
    } else if (!hasPlan && !dueKey) {
      out.undated.push(t);
    }
  }
  const byDeadline = (a: TaskDto, b: TaskDto) =>
    (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999');
  const byUpdated = (a: TaskDto, b: TaskDto) => b.updatedAt.localeCompare(a.updatedAt);
  out.overdue.sort(byDeadline);
  out.deadlineNoPlan.sort(byDeadline);
  out.draggedFromPast.sort(byUpdated);
  out.undated.sort(byUpdated);
  return out;
}

function daysBetween(a: string, b: string): number {
  const da = new Date(`${a}T00:00:00`).getTime();
  const db = new Date(`${b}T00:00:00`).getTime();
  return Math.abs(Math.round((db - da) / 86400000));
}

function fmtDueLabel(dueDate: string, today: string): string {
  const key = dueDate.slice(0, 10);
  if (key === today) return 'vence hoy';
  if (key < today) {
    const days = daysBetween(key, today);
    return days === 1 ? 'venció ayer' : `venció hace ${days} días`;
  }
  const days = daysBetween(today, key);
  if (days === 1) return 'vence mañana';
  return `vence en ${days} días`;
}

export default function UnscheduledScreen() {
  const router = useRouter();
  const tasks = useTasks();
  const update = useUpdateTask();
  const [editing, setEditing] = useState<TaskDto | null>(null);
  const today = todayIso();
  const buckets = useMemo(() => bucketize(tasks.data ?? [], today), [tasks.data, today]);

  const totalCount =
    buckets.overdue.length +
    buckets.deadlineNoPlan.length +
    buckets.draggedFromPast.length +
    buckets.undated.length;

  const scheduleToday = (t: TaskDto) =>
    update.mutate({ id: t.id, plannedDate: today, plannedStart: null, plannedEnd: null });
  const complete = (t: TaskDto) => update.mutate({ id: t.id, status: 'done' });

  return (
    <SafeAreaView className="flex-1 bg-kibo-bg">
      <View className="flex-row items-center gap-3 px-5 py-3">
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <Icon name="arrow-left" size={20} color={colors.muted} />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-2xl font-bold text-kibo-text">Sin planificar</Text>
          <Text className="mt-0.5 text-xs text-kibo-muted">
            {totalCount > 0 ? `${totalCount} pendientes sin día asignado` : 'Todo planificado'}
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingTop: 4, gap: 16 }}
        refreshControl={
          <RefreshControl
            refreshing={tasks.isRefetching}
            onRefresh={() => tasks.refetch()}
            tintColor={colors.accent}
          />
        }
      >
        {tasks.isLoading ? (
          <CenterState loading title="Cargando…" />
        ) : totalCount === 0 ? (
          <CenterState
            icon="check-circle"
            title="Ninguna tarea sin planificar"
            subtitle="Todas tus tareas pendientes tienen fecha. 🎉"
          />
        ) : (
          <>
            <Bucket
              title="Vencidas"
              subtitle="Tienen deadline pasado y no están completadas."
              icon="alert-triangle"
              iconColor="#fb7185"
              borderClass="border-rose-500/30"
              items={buckets.overdue}
              today={today}
              onSchedule={scheduleToday}
              onComplete={complete}
              onEdit={setEditing}
            />
            <Bucket
              title="Con deadline sin planificar"
              subtitle="Resérvales hueco antes de que venzan."
              icon="alert-triangle"
              iconColor="#fbbf24"
              borderClass="border-amber-500/30"
              items={buckets.deadlineNoPlan}
              today={today}
              onSchedule={scheduleToday}
              onComplete={complete}
              onEdit={setEditing}
            />
            <Bucket
              title="Arrastradas de días pasados"
              subtitle="Estaban planificadas antes de hoy y no se completaron."
              icon="arrow-right"
              iconColor={colors.muted}
              borderClass="border-kibo-border"
              items={buckets.draggedFromPast}
              today={today}
              onSchedule={scheduleToday}
              onComplete={complete}
              onEdit={setEditing}
            />
            <Bucket
              title="Sin fecha"
              subtitle="Ideas capturadas rápido. Priorízalas cuando puedas."
              icon="inbox"
              iconColor={colors.muted}
              borderClass="border-kibo-border"
              items={buckets.undated}
              today={today}
              onSchedule={scheduleToday}
              onComplete={complete}
              onEdit={setEditing}
            />
          </>
        )}
      </ScrollView>

      <TaskFormModal open={editing !== null} onClose={() => setEditing(null)} task={editing} />
    </SafeAreaView>
  );
}

function Bucket({
  title,
  subtitle,
  icon,
  iconColor,
  borderClass,
  items,
  today,
  onSchedule,
  onComplete,
  onEdit,
}: {
  title: string;
  subtitle: string;
  icon: IconName;
  iconColor: string;
  borderClass: string;
  items: TaskDto[];
  today: string;
  onSchedule: (t: TaskDto) => void;
  onComplete: (t: TaskDto) => void;
  onEdit: (t: TaskDto) => void;
}) {
  if (items.length === 0) return null;
  return (
    <Card className={`p-4 ${borderClass}`}>
      <View className="mb-1 flex-row items-center gap-2">
        <Icon name={icon} size={14} color={iconColor} />
        <Text className="text-sm font-medium text-kibo-text">
          {title} <Text className="text-xs text-kibo-muted">({items.length})</Text>
        </Text>
      </View>
      <Text className="mb-3 text-[11px] text-kibo-muted">{subtitle}</Text>
      <View className="gap-2">
        {items.map((t) => {
          const pColor = priorityColors[t.priority] ?? colors.muted;
          return (
            <TouchableOpacity key={t.id} activeOpacity={0.7} onPress={() => onEdit(t)}>
              <View className="flex-row items-start gap-3 rounded-lg border border-kibo-border/60 bg-kibo-bg/40 px-3 py-2">
                <View className="flex-1">
                  <Text className="text-sm text-kibo-text" numberOfLines={1}>
                    {t.title}
                  </Text>
                  <View className="mt-1 flex-row flex-wrap items-center gap-x-3 gap-y-1">
                    {priorityLabel[t.priority] ? (
                      <Text className="text-[11px]" style={{ color: pColor }}>
                        {priorityLabel[t.priority]}
                      </Text>
                    ) : null}
                    {t.estimatedMinutes ? (
                      <Text className="text-[11px] text-kibo-muted">{t.estimatedMinutes}m</Text>
                    ) : null}
                    {t.dueDate ? (
                      <Text
                        className={`text-[11px] ${
                          t.dueDate.slice(0, 10) < today
                            ? 'text-rose-300'
                            : t.dueDate.slice(0, 10) === today
                              ? 'text-amber-300'
                              : 'text-kibo-muted'
                        }`}
                      >
                        {fmtDueLabel(t.dueDate, today)}
                      </Text>
                    ) : null}
                  </View>
                </View>
                <View className="flex-row items-center gap-1.5">
                  <SmallBtn icon="calendar" onPress={() => onSchedule(t)} />
                  <SmallBtn icon="check" onPress={() => onComplete(t)} />
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </Card>
  );
}

function SmallBtn({ icon, onPress }: { icon: IconName; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      hitSlop={6}
      className="h-8 w-8 items-center justify-center rounded-md border border-kibo-border/60"
    >
      <Icon name={icon} size={14} color={colors.muted} />
    </TouchableOpacity>
  );
}
