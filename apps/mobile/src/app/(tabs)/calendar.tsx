// Calendar tab: month grid + selected-day agenda, with event create/edit.
import { useMemo, useState, useCallback } from 'react';
import { RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Screen, ScreenHeader, Card, CenterState } from '../../ui/primitives';
import { Icon } from '../../ui/Icon';
import { colors, priorityColors } from '../../theme/colors';
import { useEvents } from '../../hooks/useEvents';
import { useTasks } from '../../hooks/useTasks';
import { useCalendars } from '../../hooks/useCalendars';
import {
  EventFormModal,
  eventToInitial,
  type EventFormInitial,
} from '../../components/EventFormModal';
import { TaskFormModal } from '../../components/TaskFormModal';
import { todayIso, timeStr, capitalize } from '../../lib/format';
import { usePrefs } from '../../store/prefs';
import type { EventDto, TaskDto } from '../../lib/entities-api';

const DOW = ['L', 'M', 'X', 'J', 'V', 'S', 'D'] as const;

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

/** Build the 6x7 grid of dates covering the month (weeks start on Monday). */
function monthGrid(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  // getDay(): 0=Sun..6=Sat → offset so Monday is column 0.
  const offset = (first.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - offset);
  const out: Date[] = [];
  for (let i = 0; i < 42; i += 1) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    out.push(d);
  }
  return out;
}

/** Shift an ISO day by N days. */
function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return todayIso(d);
}

/** The 7 dates (Mon–Sun) of the week containing the given ISO day. */
function weekOf(iso: string): Date[] {
  const d = new Date(`${iso}T00:00:00`);
  const offset = (d.getDay() + 6) % 7;
  const monday = new Date(d);
  monday.setDate(d.getDate() - offset);
  return Array.from({ length: 7 }, (_, i) => {
    const x = new Date(monday);
    x.setDate(monday.getDate() + i);
    return x;
  });
}

export default function CalendarScreen() {
  const events = useEvents();
  const tasks = useTasks();
  const calendars = useCalendars();
  const view = usePrefs((s) => s.calendarView);
  const setPrefs = usePrefs((s) => s.set);

  const [cursor, setCursor] = useState(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1);
  });
  const [selected, setSelected] = useState(() => todayIso());
  const [eventForm, setEventForm] = useState<EventFormInitial | null>(null);
  const [eventFormOpen, setEventFormOpen] = useState(false);
  const [taskEditing, setTaskEditing] = useState<TaskDto | null>(null);

  const today = todayIso();

  const colorByCal = useMemo(() => {
    const m: Record<string, string> = {};
    for (const c of calendars.data ?? []) m[c.id] = c.color;
    return m;
  }, [calendars.data]);

  const eventsByDay = useMemo(() => {
    const m = new Map<string, EventDto[]>();
    for (const e of events.data ?? []) {
      const day = e.start.slice(0, 10);
      const arr = m.get(day) ?? [];
      arr.push(e);
      m.set(day, arr);
    }
    for (const arr of m.values()) arr.sort((a, b) => a.start.localeCompare(b.start));
    return m;
  }, [events.data]);

  const tasksByDay = useMemo(() => {
    const m = new Map<string, TaskDto[]>();
    for (const t of tasks.data ?? []) {
      if (t.status === 'done' || t.status === 'cancelled') continue;
      const day = t.plannedDate?.slice(0, 10);
      if (!day) continue;
      const arr = m.get(day) ?? [];
      arr.push(t);
      m.set(day, arr);
    }
    return m;
  }, [tasks.data]);

  const grid = useMemo(() => monthGrid(cursor.getFullYear(), cursor.getMonth()), [cursor]);
  const weekDays = useMemo(() => weekOf(selected), [selected]);

  const onRefresh = useCallback(() => {
    events.refetch();
    tasks.refetch();
  }, [events, tasks]);

  const monthLabel = capitalize(
    cursor.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }),
  );

  // Agenda mode: upcoming events grouped by day (the original view).
  const agendaSections = useMemo(() => {
    const upcoming = (events.data ?? [])
      .filter((e) => e.start.slice(0, 10) >= today)
      .sort((a, b) => a.start.localeCompare(b.start));
    const byDay = new Map<string, EventDto[]>();
    for (const e of upcoming) {
      const day = e.start.slice(0, 10);
      const arr = byDay.get(day) ?? [];
      arr.push(e);
      byDay.set(day, arr);
    }
    return [...byDay.entries()];
  }, [events.data, today]);

  const agendaDayLabel = (iso: string): string => {
    const tomorrow = todayIso(new Date(Date.now() + 86400000));
    if (iso === today) return 'Hoy';
    if (iso === tomorrow) return 'Mañana';
    return capitalize(
      new Date(`${iso}T00:00:00`).toLocaleDateString('es-ES', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      }),
    );
  };

  const dayEvents = eventsByDay.get(selected) ?? [];
  const dayTasks = tasksByDay.get(selected) ?? [];
  const selectedDate = new Date(`${selected}T00:00:00`);
  const selectedLabel = capitalize(
    selectedDate.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }),
  );

  const openNewEvent = () => {
    const base = new Date(`${selected}T10:00:00`);
    setEventForm({ start: base, end: new Date(base.getTime() + 60 * 60 * 1000) });
    setEventFormOpen(true);
  };

  const openEditEvent = (e: EventDto) => {
    setEventForm(eventToInitial(e));
    setEventFormOpen(true);
  };

  const goToday = () => {
    const n = new Date();
    setCursor(new Date(n.getFullYear(), n.getMonth(), 1));
    setSelected(todayIso());
  };

  // Header arrows: month view pages by month; week/day views move the selection.
  const navigate = (dir: 1 | -1) => {
    if (view === 'month') {
      setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + dir, 1));
      return;
    }
    const iso = addDays(selected, dir * (view === 'week' ? 7 : 1));
    setSelected(iso);
    const d = new Date(`${iso}T00:00:00`);
    setCursor(new Date(d.getFullYear(), d.getMonth(), 1));
  };

  const weekLabel = `${weekDays[0].toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
  })} – ${weekDays[6].toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}`;

  const subtitle =
    view === 'month'
      ? monthLabel
      : view === 'week'
        ? capitalize(weekLabel)
        : view === 'day'
          ? selectedLabel
          : 'Próximos eventos';

  const dowRow = (
    <View className="mb-1 flex-row">
      {DOW.map((d, i) => (
        <Text
          key={`${d}${i}`}
          className="flex-1 text-center text-[10px] font-semibold uppercase text-kibo-muted"
        >
          {d}
        </Text>
      ))}
    </View>
  );

  // Day cell shared by the month grid and the week strip.
  const renderDayCell = (d: Date, dimOutsideMonth: boolean) => {
    const key = todayIso(d);
    const inMonth = !dimOutsideMonth || monthKey(d) === monthKey(cursor);
    const isToday = key === today;
    const isSelected = key === selected;
    const dayEvts = eventsByDay.get(key) ?? [];
    const hasTasks = (tasksByDay.get(key) ?? []).length > 0;
    return (
      <TouchableOpacity
        key={key}
        onPress={() => setSelected(key)}
        className={`m-0.5 flex-1 items-center rounded-lg py-1.5 ${
          isSelected ? 'bg-kibo-accentDeep/25' : isToday ? 'bg-kibo-accentDeep/10' : ''
        }`}
      >
        <Text
          className={`text-sm ${
            isSelected || isToday
              ? 'font-bold text-kibo-accent'
              : inMonth
                ? 'text-kibo-text'
                : 'text-kibo-muted/40'
          }`}
        >
          {d.getDate()}
        </Text>
        <View className="mt-1 h-1.5 flex-row items-center gap-0.5">
          {dayEvts.slice(0, 3).map((e) => (
            <View
              key={e.id}
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: colorByCal[e.calendarId] ?? colors.accent }}
            />
          ))}
          {hasTasks ? (
            <View className="h-1.5 w-1.5 rounded-full border border-kibo-muted" />
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Screen>
      <ScreenHeader
        title="Calendario"
        subtitle={subtitle}
        right={
          view !== 'agenda' ? (
            <View className="flex-row items-center gap-1">
              <TouchableOpacity
                onPress={() => navigate(-1)}
                hitSlop={6}
                className="h-9 w-9 items-center justify-center rounded-lg border border-kibo-border"
              >
                <Icon name="chevron-left" size={18} color={colors.muted} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={goToday}
                hitSlop={6}
                className="h-9 items-center justify-center rounded-lg border border-kibo-border px-2"
              >
                <Text className="text-xs text-kibo-muted">Hoy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => navigate(1)}
                hitSlop={6}
                className="h-9 w-9 items-center justify-center rounded-lg border border-kibo-border"
              >
                <Icon name="chevron-right" size={18} color={colors.muted} />
              </TouchableOpacity>
            </View>
          ) : undefined
        }
      />

      {/* View mode selector */}
      <View className="mb-1 flex-row gap-2 px-4">
        <ViewChip
          label="Mes"
          icon="grid"
          active={view === 'month'}
          onPress={() => setPrefs({ calendarView: 'month' })}
        />
        <ViewChip
          label="Semana"
          icon="columns"
          active={view === 'week'}
          onPress={() => setPrefs({ calendarView: 'week' })}
        />
        <ViewChip
          label="Día"
          icon="square"
          active={view === 'day'}
          onPress={() => setPrefs({ calendarView: 'day' })}
        />
        <ViewChip
          label="Agenda"
          icon="list"
          active={view === 'agenda'}
          onPress={() => setPrefs({ calendarView: 'agenda' })}
        />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingTop: 4, gap: 16, paddingBottom: 90 }}
        refreshControl={
          <RefreshControl
            refreshing={events.isRefetching}
            onRefresh={onRefresh}
            tintColor={colors.accent}
          />
        }
      >
        {events.isLoading ? (
          <CenterState loading title="Cargando calendario…" />
        ) : view === 'agenda' ? (
          agendaSections.length === 0 ? (
            <CenterState
              icon="calendar"
              title="Sin eventos próximos"
              subtitle="Tu agenda está despejada."
            />
          ) : (
            <View className="gap-1">
              {agendaSections.map(([day, evts]) => (
                <View key={day}>
                  <Text className="mb-2 mt-3 px-1 text-xs font-semibold uppercase tracking-wide text-kibo-muted">
                    {agendaDayLabel(day)}
                  </Text>
                  <View className="gap-2">
                    {evts.map((e) => (
                      <TouchableOpacity key={e.id} activeOpacity={0.7} onPress={() => openEditEvent(e)}>
                        <Card className="flex-row items-center gap-3 p-3">
                          <View
                            className="h-10 w-1 rounded-full"
                            style={{ backgroundColor: colorByCal[e.calendarId] ?? colors.accent }}
                          />
                          <View className="flex-1">
                            <Text className="text-sm font-medium text-kibo-text" numberOfLines={1}>
                              {e.title}
                            </Text>
                            <Text className="text-xs text-kibo-muted">
                              {e.allDay ? 'Todo el día' : `${timeStr(e.start)}–${timeStr(e.end)}`}
                              {e.location ? ` · ${e.location}` : ''}
                            </Text>
                          </View>
                          <Icon name="edit-2" size={14} color={colors.muted} />
                        </Card>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ))}
            </View>
          )
        ) : (
          <>
            {view === 'month' ? (
              <Card className="p-3">
                {dowRow}
                {Array.from({ length: 6 }, (_, w) => (
                  <View key={w} className="flex-row">
                    {grid.slice(w * 7, w * 7 + 7).map((d) => renderDayCell(d, true))}
                  </View>
                ))}
              </Card>
            ) : view === 'week' ? (
              <Card className="p-3">
                {dowRow}
                <View className="flex-row">{weekDays.map((d) => renderDayCell(d, false))}</View>
              </Card>
            ) : null}

            <View>
              <Text className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-kibo-muted">
                {selectedLabel}
              </Text>
              {dayEvents.length === 0 && dayTasks.length === 0 ? (
                <Card className="p-4">
                  <Text className="text-sm text-kibo-muted">Nada programado este día.</Text>
                </Card>
              ) : (
                <View className="gap-2">
                  {dayEvents.map((e) => (
                    <TouchableOpacity key={e.id} activeOpacity={0.7} onPress={() => openEditEvent(e)}>
                      <Card className="flex-row items-center gap-3 p-3">
                        <View
                          className="h-10 w-1 rounded-full"
                          style={{ backgroundColor: colorByCal[e.calendarId] ?? colors.accent }}
                        />
                        <View className="flex-1">
                          <Text className="text-sm font-medium text-kibo-text" numberOfLines={1}>
                            {e.title}
                          </Text>
                          <Text className="text-xs text-kibo-muted">
                            {e.allDay ? 'Todo el día' : `${timeStr(e.start)}–${timeStr(e.end)}`}
                            {e.location ? ` · ${e.location}` : ''}
                          </Text>
                        </View>
                        <Icon name="edit-2" size={14} color={colors.muted} />
                      </Card>
                    </TouchableOpacity>
                  ))}
                  {dayTasks.map((t) => (
                    <TouchableOpacity key={t.id} activeOpacity={0.7} onPress={() => setTaskEditing(t)}>
                      <Card className="flex-row items-center gap-3 p-3">
                        <Icon
                          name="check-square"
                          size={16}
                          color={priorityColors[t.priority] ?? colors.muted}
                        />
                        <View className="flex-1">
                          <Text className="text-sm text-kibo-text" numberOfLines={1}>
                            {t.title}
                          </Text>
                          <Text className="text-xs text-kibo-muted">
                            Tarea planificada
                            {t.plannedStart ? ` · ${timeStr(t.plannedStart)}` : ''}
                            {t.estimatedMinutes ? ` · ${t.estimatedMinutes}m` : ''}
                          </Text>
                        </View>
                      </Card>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>

      {/* FAB: new event on the selected day */}
      <TouchableOpacity
        onPress={openNewEvent}
        activeOpacity={0.85}
        className="absolute bottom-5 right-5 h-14 w-14 items-center justify-center rounded-full bg-kibo-accentDeep"
        style={{ elevation: 6 }}
      >
        <Icon name="plus" size={26} color="#fff" />
      </TouchableOpacity>

      <EventFormModal
        open={eventFormOpen}
        onClose={() => setEventFormOpen(false)}
        initial={eventForm}
      />
      <TaskFormModal
        open={taskEditing !== null}
        onClose={() => setTaskEditing(null)}
        task={taskEditing}
      />
    </Screen>
  );
}

function ViewChip({
  label,
  icon,
  active,
  onPress,
}: {
  label: string;
  icon: React.ComponentProps<typeof Icon>['name'];
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      className={`h-8 flex-row items-center gap-1.5 rounded-full border px-3 ${
        active ? 'border-kibo-accent/40 bg-kibo-accentDeep/15' : 'border-kibo-border'
      }`}
    >
      <Icon name={icon} size={13} color={active ? colors.accent : colors.muted} />
      <Text className={`text-xs ${active ? 'font-semibold text-kibo-accent' : 'text-kibo-muted'}`}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}
