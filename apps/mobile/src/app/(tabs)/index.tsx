import { useMemo, useState, useCallback } from 'react';
import { RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, ScreenHeader, Card, SectionTitle, CenterState } from '../../ui/primitives';
import { Icon } from '../../ui/Icon';
import { colors, priorityColors, priorityLabel, priorityRank } from '../../theme/colors';
import { useTasks, useUpdateTask } from '../../hooks/useTasks';
import { useEvents } from '../../hooks/useEvents';
import { useInbox } from '../../hooks/useInbox';
import { useAuthStore } from '../../store/auth';
import { WorkloadCard } from '../../components/WorkloadCard';
import { DeadlineWarningsCard } from '../../components/DeadlineWarningsCard';
import {
  todayIso,
  greeting,
  longDate,
  capitalize,
  timeStr,
  minutesUntil,
  humanUntil,
} from '../../lib/format';
import type { TaskDto, EventDto } from '../../lib/entities-api';

export default function TodayScreen() {
  const tasks = useTasks();
  const events = useEvents();
  const inbox = useInbox();
  const user = useAuthStore((s) => s.user);
  const updateTask = useUpdateTask();
  const router = useRouter();

  const now = new Date();
  const today = todayIso(now);

  const refreshing = tasks.isRefetching || events.isRefetching || inbox.isRefetching;
  const onRefresh = useCallback(() => {
    tasks.refetch();
    events.refetch();
    inbox.refetch();
  }, [tasks, events, inbox]);

  const todaysEvents = useMemo(() => {
    return (events.data ?? [])
      .filter((e) => e.start.slice(0, 10) === today)
      .sort((a, b) => a.start.localeCompare(b.start));
  }, [events.data, today]);

  const nextEvent = useMemo(
    () => todaysEvents.find((e) => !e.allDay && minutesUntil(e.start, now) >= -0),
    [todaysEvents, now],
  );

  const todaysTasks = useMemo(() => {
    return (tasks.data ?? [])
      .filter((t) => t.status !== 'done' && t.status !== 'cancelled')
      .filter((t) => t.plannedDate === today || t.dueDate === today)
      .sort((a, b) => (priorityRank[a.priority] ?? 3) - (priorityRank[b.priority] ?? 3));
  }, [tasks.data, today]);

  const pendingInbox = (inbox.data ?? []).filter((i) => i.status === 'pending').length;

  const loading = tasks.isLoading || events.isLoading;

  return (
    <Screen>
      <ScreenHeader
        title={`${greeting()}${user?.name ? `, ${user.name.split(' ')[0]}` : ''}`}
        subtitle={capitalize(longDate(now))}
      />
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingTop: 4, gap: 20 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
      >
        {loading ? (
          <CenterState loading title="Cargando tu día…" />
        ) : (
          <>
            {nextEvent ? <NextUpCard event={nextEvent} now={now} /> : null}

            <DeadlineWarningsCard />
            <WorkloadCard />

            <View className="flex-row gap-2">
              <QuickLink icon="zap" label="Focus" onPress={() => router.push('/focus')} />
              <QuickLink
                icon="inbox"
                label="Sin planificar"
                onPress={() => router.push('/unscheduled')}
              />
            </View>

            <View>
              <SectionTitle icon="calendar">Eventos de hoy</SectionTitle>
              {todaysEvents.length === 0 ? (
                <Card className="p-4">
                  <Text className="text-sm text-kibo-muted">No hay eventos para hoy.</Text>
                </Card>
              ) : (
                <View className="gap-2">
                  {todaysEvents.map((e) => (
                    <EventRow key={e.id} event={e} />
                  ))}
                </View>
              )}
            </View>

            <View>
              <SectionTitle icon="check-square">Tareas de hoy</SectionTitle>
              {todaysTasks.length === 0 ? (
                <Card className="p-4">
                  <Text className="text-sm text-kibo-muted">Nada planificado. Buen momento para respirar.</Text>
                </Card>
              ) : (
                <View className="gap-2">
                  {todaysTasks.map((t) => (
                    <TaskRow
                      key={t.id}
                      task={t}
                      onToggle={() =>
                        updateTask.mutate({
                          id: t.id,
                          status: t.status === 'done' ? 'pending' : 'done',
                        })
                      }
                    />
                  ))}
                </View>
              )}
            </View>

            <TouchableOpacity activeOpacity={0.7} onPress={() => router.push('/inbox')}>
              <Card className="flex-row items-center gap-3 p-4">
                <Icon name="inbox" size={20} color={colors.accent} />
                <View className="flex-1">
                  <Text className="text-sm font-medium text-kibo-text">Inbox</Text>
                  <Text className="text-xs text-kibo-muted">
                    {pendingInbox > 0
                      ? `${pendingInbox} sin procesar`
                      : 'Todo procesado'}
                  </Text>
                </View>
                <Icon name="chevron-right" size={18} color={colors.muted} />
              </Card>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

function QuickLink({
  icon,
  label,
  onPress,
}: {
  icon: React.ComponentProps<typeof Icon>['name'];
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity activeOpacity={0.7} onPress={onPress} className="flex-1">
      <Card className="flex-row items-center justify-center gap-2 p-3">
        <Icon name={icon} size={16} color={colors.accent} />
        <Text className="text-sm font-medium text-kibo-text">{label}</Text>
      </Card>
    </TouchableOpacity>
  );
}

function NextUpCard({ event, now }: { event: EventDto; now: Date }) {
  const mins = minutesUntil(event.start, now);
  return (
    <Card className="border-kibo-accent/40 bg-kibo-accentDeep/10 p-4">
      <Text className="mb-1 text-xs font-semibold uppercase tracking-wide text-kibo-accent">
        A continuación · {humanUntil(mins)}
      </Text>
      <Text className="text-base font-semibold text-kibo-text">{event.title}</Text>
      <Text className="mt-0.5 text-sm text-kibo-muted">
        {timeStr(event.start)}–{timeStr(event.end)}
        {event.location ? ` · ${event.location}` : ''}
      </Text>
    </Card>
  );
}

function EventRow({ event }: { event: EventDto }) {
  return (
    <Card className="flex-row items-center gap-3 p-3">
      <View className="h-9 w-1 rounded-full bg-kibo-accent" />
      <View className="flex-1">
        <Text className="text-sm font-medium text-kibo-text" numberOfLines={1}>
          {event.title}
        </Text>
        <Text className="text-xs text-kibo-muted">
          {event.allDay ? 'Todo el día' : `${timeStr(event.start)}–${timeStr(event.end)}`}
        </Text>
      </View>
    </Card>
  );
}

function TaskRow({ task, onToggle }: { task: TaskDto; onToggle: () => void }) {
  const done = task.status === 'done';
  const color = priorityColors[task.priority] ?? colors.muted;
  return (
    <Card className="flex-row items-center gap-3 p-3">
      <TouchableOpacity onPress={onToggle} hitSlop={8}>
        <Icon name={done ? 'check-circle' : 'circle'} size={22} color={done ? colors.accent : color} />
      </TouchableOpacity>
      <Text
        className={`flex-1 text-sm ${done ? 'text-kibo-muted line-through' : 'text-kibo-text'}`}
        numberOfLines={1}
      >
        {task.title}
      </Text>
      {priorityLabel[task.priority] ? (
        <View className="rounded px-1.5 py-0.5" style={{ backgroundColor: `${color}22` }}>
          <Text className="text-[10px] font-semibold" style={{ color }}>
            {priorityLabel[task.priority]}
          </Text>
        </View>
      ) : null}
    </Card>
  );
}
