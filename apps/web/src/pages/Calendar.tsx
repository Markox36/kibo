import { useEffect, useMemo, useRef, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import { useUiStore } from '../store/ui';
import { useDailyLoads } from '../hooks/useDailyLoad';
import { DailyLoadIndicator, type DailyLoad } from '@kibo/planning';
import type {
  DateSelectArg,
  DayHeaderContentArg,
  EventClickArg,
  EventContentArg,
  EventDropArg,
  EventInput,
} from '@fullcalendar/core';
import timeGridPlugin from '@fullcalendar/timegrid';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin, { type EventResizeDoneArg } from '@fullcalendar/interaction';
import rrulePlugin from '@fullcalendar/rrule';
import { Clock, Eye, EyeOff, ListTodo, AlarmClock, Flag, Plus, SlidersHorizontal, X, Download, RefreshCw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useEvents, useUpdateEvent } from '../hooks/useEvents';
import { useCalendars, useCreateCalendar, useSyncCalendar } from '../hooks/useCalendars';
import { useTasks, useUpdateTask } from '../hooks/useTasks';
import { EventFormModal, type EventFormInitial } from '../components/EventFormModal';
import { TaskFormModal } from '../components/TaskFormModal';
import { EntityDetailModal } from '../components/EntityDetailModal';
import { ImportCalendarModal } from '../components/ImportCalendarModal';
import { BulkDeleteEventsModal } from '../components/BulkDeleteEventsModal';
import { usePublicFlags } from '../hooks/useFlags';
import type { CalendarDto, EventDto, TaskDto } from '../lib/entities-api';

const DOW_ES = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'] as const;

const TYPE_COLORS = {
  event: '#f59e0b',           // amber
  taskPlanned: '#a78bfa',     // violet
  taskDue: '#f97316',         // orange
} as const;

type EntityKind = 'event' | 'task-planned' | 'task-due';

interface KiboEventProps {
  kind: EntityKind;
  fill: string;
  border: string;
  entityId: string;
  calendarId?: string;
  plannedDate?: string | null;
  dueDate?: string | null;
  location?: string | null;
  isFullDay?: boolean;
}

function localDatePart(dateStr: string): string {
  // date-only string (YYYY-MM-DD) — leave as-is (already in local calendar sense)
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  // full ISO — reinterpret to local Y-M-D so all-day items land on the right column
  const d = new Date(dateStr);
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function toLocalYmd(d: Date): string {
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function startOfDay(dateStr: string): string {
  return `${localDatePart(dateStr)}T00:00:00`;
}
function endOfDay(dateStr: string): string {
  return `${localDatePart(dateStr)}T23:59:59`;
}
function nearEndOfDay(dateStr: string): { start: string; end: string } {
  const d = localDatePart(dateStr);
  return {
    start: `${d}T23:30:00`,
    end: `${d}T23:59:00`,
  };
}

function fmtDate(iso: string): string {
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
}

function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function makeRenderDayHeader(loads: Map<string, DailyLoad>, showLoad: boolean) {
  return function RenderDayHeader(arg: DayHeaderContentArg) {
    const d = arg.date;
    const dow = DOW_ES[d.getDay()];
    const load = showLoad ? loads.get(toDateKey(d)) : undefined;
    return (
      <div className="kibo-dh">
        <div className="kibo-dh-dow">{dow}</div>
        <div className={'kibo-dh-num' + (arg.isToday ? ' kibo-dh-today' : '')}>{d.getDate()}</div>
        {load && <DailyLoadIndicator load={load} />}
      </div>
    );
  };
}

function KindIcon({ kind, size = 11 }: { kind: EntityKind; size?: number }) {
  if (kind === 'event') return <Clock size={size} />;
  if (kind === 'task-planned') return <ListTodo size={size} />;
  return <AlarmClock size={size} />;
}

function KindLabel({ kind }: { kind: EntityKind }) {
  if (kind === 'event') return <span>Evento</span>;
  if (kind === 'task-planned') return <span>Planificada</span>;
  return <span>Límite</span>;
}

function metaFor(
  kind: EntityKind,
  time: string,
  props: Partial<KiboEventProps>,
  isFullDay: boolean,
): { icon: typeof Clock; label: string; value: string } | null {
  if (isFullDay) {
    if (kind === 'task-due' && props.dueDate)
      return { icon: Flag, label: 'Vence', value: fmtDate(props.dueDate) };
    if (kind === 'task-planned' && props.dueDate)
      return { icon: Flag, label: 'Límite', value: fmtDate(props.dueDate) };
    return null;
  }
  if (kind === 'event') {
    if (!time) return null;
    return { icon: Clock, label: '', value: time };
  }
  if (kind === 'task-planned') {
    if (props.dueDate) return { icon: Flag, label: 'Límite', value: fmtDate(props.dueDate) };
    if (time) return { icon: Clock, label: '', value: time };
    return null;
  }
  return null;
}

function renderEvent(arg: EventContentArg) {
  const props = arg.event.extendedProps as Partial<KiboEventProps>;
  const kind = (props.kind ?? 'event') as EntityKind;
  const fill = props.fill ?? TYPE_COLORS.event;
  const border = props.border ?? fill;
  const time = arg.timeText;

  const style = {
    background: hexWithAlpha(fill, 0.18),
    borderLeft: `3px solid ${border}`,
    boxShadow: `inset 0 0 0 1px ${hexWithAlpha(fill, 0.25)}, 0 1px 3px rgba(0,0,0,0.25)`,
    color: '#f2f2f6',
  } as const;

  const isFullDay = props.isFullDay ?? false;
  const meta = metaFor(kind, time, props, isFullDay);
  const MetaIcon = meta?.icon;

  return (
    <div className={'kibo-ev-glass kibo-ev' + (isFullDay ? ' kibo-ev-fullday' : '')} style={style}>
      <div className="kibo-ev-kind">
        <KindIcon kind={kind} size={10} />
        <KindLabel kind={kind} />
      </div>
      <div className="kibo-ev-title">{arg.event.title}</div>
      {meta && MetaIcon && (
        <div className="kibo-ev-meta">
          <MetaIcon size={11} />
          {meta.label && <span className="kibo-ev-meta-label">{meta.label}</span>}
          <span>{meta.value}</span>
        </div>
      )}
    </div>
  );
}

function hexWithAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.slice(0, 6);
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

interface Filters {
  showEvents: boolean;
  showPlanned: boolean;
  showDue: boolean;
  hiddenCalendarIds: Set<string>;
}

export function CalendarPage() {
  const events = useEvents();
  const tasks = useTasks();
  const calendars = useCalendars();
  const updateEvent = useUpdateEvent();
  const updateTask = useUpdateTask();
  const createCalendar = useCreateCalendar();

  const [filters, setFilters] = useState<Filters>({
    showEvents: true,
    showPlanned: true,
    showDue: true,
    hiddenCalendarIds: new Set(),
  });

  const [viewport, setViewport] = useState<'sm' | 'md' | 'lg'>(() => {
    if (typeof window === 'undefined') return 'lg';
    const w = window.innerWidth;
    if (w < 640) return 'sm';
    if (w < 1024) return 'md';
    return 'lg';
  });
  const isMobile = viewport === 'sm';
  const calRef = useRef<FullCalendar | null>(null);
  const sidebarState = useUiStore((s) => s.sidebarState);
  const [visibleRange, setVisibleRange] = useState<{ start: Date; end: Date; viewType: string } | null>(null);

  const visibleDates = useMemo<Date[]>(() => {
    if (!visibleRange) return [];
    const out: Date[] = [];
    const cur = new Date(visibleRange.start.getFullYear(), visibleRange.start.getMonth(), visibleRange.start.getDate());
    const end = visibleRange.end;
    while (cur < end) {
      out.push(new Date(cur));
      cur.setDate(cur.getDate() + 1);
    }
    return out;
  }, [visibleRange]);

  const loadsByDate = useDailyLoads(visibleDates);
  const showLoadInHeader = visibleRange?.viewType === 'timeGridWeek' || visibleRange?.viewType === 'timeGridDay';
  const renderDayHeader = useMemo(
    () => makeRenderDayHeader(loadsByDate, showLoadInHeader),
    [loadsByDate, showLoadInHeader],
  );

  useEffect(() => {
    const t = setTimeout(() => {
      calRef.current?.getApi().updateSize();
    }, 100);
    return () => clearTimeout(t);
  }, [viewport, sidebarState]);

  useEffect(() => {
    const el = document.querySelector('main');
    if (!el) return;
    const ro = new ResizeObserver(() => {
      calRef.current?.getApi().updateSize();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    let raf = 0;
    const onZoom = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        calRef.current?.getApi().updateSize();
      });
    };
    vv.addEventListener('resize', onZoom);
    return () => {
      cancelAnimationFrame(raf);
      vv.removeEventListener('resize', onZoom);
    };
  }, []);

  useEffect(() => {
    const compute = () => {
      const w = window.innerWidth;
      setViewport(w < 640 ? 'sm' : w < 1024 ? 'md' : 'lg');
    };
    compute();
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, []);

  const [eventFormOpen, setEventFormOpen] = useState(false);
  const [eventInitial, setEventInitial] = useState<EventFormInitial | null>(null);
  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskDto | null>(null);
  type DetailPayload =
    | { kind: 'event'; data: EventDto }
    | { kind: 'task-planned' | 'task-due'; data: TaskDto };
  const [detailPayload, setDetailPayload] = useState<DetailPayload | null>(null);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const syncCalendar = useSyncCalendar();
  const flagsQ = usePublicFlags();
  const importAnyEnabled =
    (flagsQ.data?.icsFileImportEnabled ?? true) ||
    (flagsQ.data?.icsUrlImportEnabled ?? true) ||
    (flagsQ.data?.googleCalendarEnabled ?? true);
  const bulkDeleteEnabled = flagsQ.data?.bulkDeleteEnabled ?? true;

  const calendarMap = useMemo(() => {
    const m = new Map<string, { name: string; color: string }>();
    for (const c of calendars.data ?? []) m.set(c.id, { name: c.name, color: c.color });
    return m;
  }, [calendars.data]);

  const fcEvents = useMemo<EventInput[]>(() => {
    const list: EventInput[] = [];

    if (filters.showEvents) {
      for (const e of events.data ?? []) {
        if (filters.hiddenCalendarIds.has(e.calendarId)) continue;
        const border = calendarMap.get(e.calendarId)?.color ?? TYPE_COLORS.event;
        const hasRrule = Boolean(e.rrule);
        const baseInput: EventInput = {
          id: `event:${e.id}`,
          title: e.title,
          allDay: e.allDay,
          editable: !e.allDay && !hasRrule,
          extendedProps: {
            kind: 'event',
            fill: TYPE_COLORS.event,
            border,
            entityId: e.id,
            calendarId: e.calendarId,
            location: e.location ?? null,
            isFullDay: e.allDay,
          } satisfies KiboEventProps,
        };
        if (hasRrule && e.rrule) {
          const startMs = new Date(e.start).getTime();
          const endMs = new Date(e.end).getTime();
          const durationMs = Math.max(endMs - startMs, 60_000);
          const dtstart = e.start.replace(/[-:]/g, '').replace(/\.\d{3}/, '');
          baseInput.rrule = `DTSTART:${dtstart}\nRRULE:${e.rrule}`;
          baseInput.duration = { milliseconds: durationMs };
        } else {
          baseInput.start = e.start;
          baseInput.end = e.end;
        }
        list.push(baseInput);
      }
    }

    for (const t of tasks.data ?? []) {
      if (t.status === 'done' || t.status === 'cancelled') continue;

      if (filters.showPlanned) {
        if (t.plannedStart && t.plannedEnd) {
          list.push({
            id: `task-planned:${t.id}`,
            title: t.title,
            start: t.plannedStart,
            end: t.plannedEnd,
            allDay: false,
            editable: true,
            extendedProps: {
              kind: 'task-planned',
              fill: TYPE_COLORS.taskPlanned,
              border: TYPE_COLORS.taskPlanned,
              entityId: t.id,
              plannedDate: t.plannedDate ?? null,
              dueDate: t.dueDate ?? null,
              isFullDay: false,
            } satisfies KiboEventProps,
          });
        } else if (t.plannedDate) {
          list.push({
            id: `task-planned:${t.id}`,
            title: t.title,
            start: t.plannedDate,
            allDay: true,
            editable: false,
            extendedProps: {
              kind: 'task-planned',
              fill: TYPE_COLORS.taskPlanned,
              border: TYPE_COLORS.taskPlanned,
              entityId: t.id,
              plannedDate: t.plannedDate ?? null,
              dueDate: t.dueDate ?? null,
              isFullDay: true,
            } satisfies KiboEventProps,
          });
        }
      }

      if (filters.showDue && t.dueDate) {
        list.push({
          id: `task-due:${t.id}`,
          title: t.title,
          start: t.dueDate,
          allDay: true,
          editable: false,
          extendedProps: {
            kind: 'task-due',
            fill: TYPE_COLORS.taskDue,
            border: TYPE_COLORS.taskDue,
            entityId: t.id,
            plannedDate: t.plannedDate ?? null,
            dueDate: t.dueDate ?? null,
            isFullDay: true,
          } satisfies KiboEventProps,
        });
      }
    }

    return list;
  }, [events.data, tasks.data, calendarMap, filters]);

  const ensureDefaultCalendar = async (): Promise<string> => {
    const list = calendars.data ?? [];
    if (list.length > 0) return list.find((c) => c.isDefault)?.id ?? list[0]!.id;
    const created = await createCalendar.mutateAsync({
      name: 'Personal',
      color: '#7c8cff',
      isDefault: true,
    });
    return created.id;
  };

  const onSelect = (arg: DateSelectArg) => {
    setEventInitial({ start: arg.start, end: arg.end, allDay: arg.allDay });
    setEventFormOpen(true);
    arg.view.calendar.unselect();
  };

  const parseFcId = (fcId: string): { kind: EntityKind; id: string } => {
    const [kind, id] = fcId.split(':', 2);
    return { kind: kind as EntityKind, id: id ?? '' };
  };

  const onEventDrop = async (arg: EventDropArg) => {
    const { kind, id } = parseFcId(arg.event.id);
    const start = arg.event.start!;
    const end = arg.event.end ?? start;
    try {
      if (kind === 'event') {
        await updateEvent.mutateAsync({
          id,
          start: start.toISOString(),
          end: end.toISOString(),
        });
      } else if (kind === 'task-planned') {
        if (arg.event.allDay) {
          await updateTask.mutateAsync({
            id,
            plannedDate: toLocalYmd(start),
            plannedStart: null,
            plannedEnd: null,
          });
        } else {
          await updateTask.mutateAsync({
            id,
            plannedStart: start.toISOString(),
            plannedEnd: end.toISOString(),
            plannedDate: toLocalYmd(start),
          });
        }
      } else if (kind === 'task-due') {
        await updateTask.mutateAsync({
          id,
          dueDate: toLocalYmd(start),
        });
      }
    } catch {
      arg.revert();
      toast.error('No se pudo mover.');
    }
  };

  const onEventResize = async (arg: EventResizeDoneArg) => {
    const { kind, id } = parseFcId(arg.event.id);
    try {
      if (kind === 'event') {
        await updateEvent.mutateAsync({
          id,
          start: arg.event.start!.toISOString(),
          end: arg.event.end!.toISOString(),
        });
      } else if (kind === 'task-planned') {
        await updateTask.mutateAsync({
          id,
          plannedStart: arg.event.start!.toISOString(),
          plannedEnd: arg.event.end!.toISOString(),
        });
      }
    } catch {
      arg.revert();
      toast.error('No se pudo redimensionar.');
    }
  };

  const onEventClick = (arg: EventClickArg) => {
    const { kind, id } = parseFcId(arg.event.id);
    if (kind === 'event') {
      const full = (events.data ?? []).find((e) => e.id === id);
      if (!full) return;
      setDetailPayload({ kind: 'event', data: full });
    } else {
      const task = (tasks.data ?? []).find((t) => t.id === id);
      if (!task) return;
      setDetailPayload({ kind, data: task });
    }
  };

  const openEditFromDetail = () => {
    if (!detailPayload) return;
    if (detailPayload.kind === 'event') {
      const full = detailPayload.data;
      setEventInitial({
        id: full.id,
        title: full.title,
        calendarId: full.calendarId,
        start: new Date(full.start),
        end: new Date(full.end),
        allDay: full.allDay,
        location: full.location ?? null,
        description: full.description ?? null,
      });
      setEventFormOpen(true);
    } else {
      setEditingTask(detailPayload.data);
      setTaskFormOpen(true);
    }
    setDetailPayload(null);
  };

  const openCreateEvent = () => {
    const now = new Date();
    now.setMinutes(0, 0, 0);
    const end = new Date(now.getTime() + 60 * 60 * 1000);
    setEventInitial({ start: now, end, allDay: false });
    setEventFormOpen(true);
  };

  const cals = calendars.data ?? [];

  const toggleCalendar = (id: string) => {
    setFilters((f) => {
      const next = new Set(f.hiddenCalendarIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { ...f, hiddenCalendarIds: next };
    });
  };

  const filterChipsCount =
    (filters.showEvents ? 1 : 0) +
    (filters.showPlanned ? 1 : 0) +
    (filters.showDue ? 1 : 0) +
    (cals.length - filters.hiddenCalendarIds.size);

  const filtersBar = (
    <>
      <FilterGroup title="Categorías">
        <TypeChip
          label="Eventos"
          color={TYPE_COLORS.event}
          icon={Clock}
          active={filters.showEvents}
          onClick={() => setFilters((f) => ({ ...f, showEvents: !f.showEvents }))}
        />
        <TypeChip
          label="Planificadas"
          color={TYPE_COLORS.taskPlanned}
          icon={ListTodo}
          active={filters.showPlanned}
          onClick={() => setFilters((f) => ({ ...f, showPlanned: !f.showPlanned }))}
        />
        <TypeChip
          label="Vencimientos"
          color={TYPE_COLORS.taskDue}
          icon={AlarmClock}
          active={filters.showDue}
          onClick={() => setFilters((f) => ({ ...f, showDue: !f.showDue }))}
        />
      </FilterGroup>

      <div className="w-px self-stretch bg-kibo-border/60 hidden sm:block" />

      <FilterGroup title="Calendarios">
        {cals.length === 0 ? (
          <span className="text-[11px] text-kibo-muted italic px-1">
            Se creará al añadir tu primer evento.
          </span>
        ) : (
          cals.map((c) => {
            const hidden = filters.hiddenCalendarIds.has(c.id);
            const canSync = c.type === 'ics_url';
            return (
              <CalendarChip
                key={c.id}
                cal={c}
                hidden={hidden}
                syncing={canSync && syncCalendar.isPending && syncCalendar.variables === c.id}
                onClick={() => toggleCalendar(c.id)}
                onSync={
                  canSync
                    ? async () => {
                        try {
                          const res = await syncCalendar.mutateAsync(c.id);
                          toast.success(
                            `Sincronizado: ${res.eventsInserted} nuevos · ${res.eventsUpdated} actualizados · ${res.eventsDeleted} borrados.`,
                          );
                        } catch {
                          toast.error('No se pudo sincronizar.');
                        }
                      }
                    : undefined
                }
              />
            );
          })
        )}
      </FilterGroup>
    </>
  );

  return (
    <div className="flex flex-col gap-2 sm:gap-3 -m-3 sm:-m-4 md:-m-6 p-2 sm:p-3 md:p-4 h-[calc(100vh-3rem)] relative">
      <div className="hidden sm:flex items-start gap-4 flex-wrap px-1 overflow-x-auto">
        {filtersBar}
        <div className="sm:ml-auto flex items-center gap-2 self-end shrink-0">
          {bulkDeleteEnabled && (
            <button
              onClick={() => setBulkDeleteOpen(true)}
              className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-xs border border-kibo-border bg-kibo-surface hover:border-red-500/50 hover:text-red-400 text-kibo-muted transition-colors"
              title="Eliminar eventos por filtro/regex"
            >
              <Trash2 size={12} /> Limpiar
            </button>
          )}
          {importAnyEnabled && (
            <button
              onClick={() => setImportOpen(true)}
              className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-xs border border-kibo-border bg-kibo-surface hover:border-kibo-muted text-kibo-text transition-colors"
            >
              <Download size={12} /> Importar
            </button>
          )}
          <button
            onClick={openCreateEvent}
            className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-xs bg-kibo-accentDeep hover:bg-kibo-accent text-white transition-colors"
          >
            + Nuevo evento
          </button>
        </div>
      </div>

      <div className="sm:hidden flex items-center gap-2 px-1">
        <button
          onClick={() => setMobileFiltersOpen(true)}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs border border-kibo-border bg-kibo-surface text-kibo-text shrink-0"
        >
          <SlidersHorizontal size={13} />
          Filtros
          <span className="text-kibo-muted font-mono">{filterChipsCount}</span>
        </button>
        {bulkDeleteEnabled && (
          <button
            onClick={() => setBulkDeleteOpen(true)}
            className="ml-auto inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs border border-kibo-border bg-kibo-surface text-kibo-muted"
            title="Limpiar eventos"
          >
            <Trash2 size={13} />
          </button>
        )}
        {importAnyEnabled && (
          <button
            onClick={() => setImportOpen(true)}
            className={
              'inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs border border-kibo-border bg-kibo-surface text-kibo-text' +
              (bulkDeleteEnabled ? '' : ' ml-auto')
            }
          >
            <Download size={13} /> Importar
          </button>
        )}
      </div>

      <div className="flex-1 card p-1 sm:p-2 kibo-fc kibo-fc-gcal min-w-0 min-h-0">
        <FullCalendar
          ref={calRef}
          plugins={[timeGridPlugin, dayGridPlugin, interactionPlugin, rrulePlugin]}
          initialView={
            viewport === 'sm'
              ? 'timeGridDay'
              : viewport === 'md'
                ? 'timeGridThreeDay'
                : 'timeGridWeek'
          }
          views={{
            timeGridThreeDay: {
              type: 'timeGrid',
              duration: { days: 3 },
              buttonText: '3 días',
            },
          }}
          headerToolbar={
            viewport === 'sm'
              ? {
                  left: 'title',
                  right: 'prev,next,today',
                }
              : viewport === 'md'
                ? {
                    left: 'prev,next today',
                    center: 'title',
                    right: 'timeGridDay,timeGridThreeDay,timeGridWeek,dayGridMonth',
                  }
                : {
                    left: 'prev,next today',
                    center: 'title',
                    right: 'timeGridDay,timeGridWeek,dayGridMonth',
                  }
          }
          footerToolbar={
            viewport === 'sm'
              ? {
                  center: 'timeGridDay,timeGridWeek,dayGridMonth',
                }
              : undefined
          }
          buttonText={{ today: 'Hoy', month: 'Mes', week: 'Semana', day: 'Día' }}
          firstDay={1}
          locale="es"
          slotDuration="00:30:00"
          slotLabelInterval="01:00"
          slotLabelFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
          scrollTime="07:00:00"
          slotMinTime="00:00:00"
          slotMaxTime="24:00:00"
          expandRows
          slotEventOverlap={false}
          allDaySlot
          allDayText="Todo el día"
          stickyHeaderDates
          dayHeaderContent={renderDayHeader}
          dayHeaderClassNames="kibo-day-header"
          slotLabelClassNames="kibo-slot-label"
          nowIndicator
          selectable
          selectMirror
          editable
          height="100%"
          eventContent={renderEvent}
          eventClassNames={(arg) =>
            (arg.event.extendedProps as KiboEventProps).isFullDay ? ['kibo-fullday'] : []
          }
          events={fcEvents}
          datesSet={(arg) =>
            setVisibleRange({ start: arg.start, end: arg.end, viewType: arg.view.type })
          }
          select={onSelect}
          eventDrop={onEventDrop}
          eventResize={onEventResize}
          eventClick={onEventClick}
        />
      </div>

      <button
        onClick={openCreateEvent}
        aria-label="Nuevo evento"
        className="sm:hidden fixed z-30 bottom-4 right-4 h-14 w-14 rounded-2xl bg-kibo-accentDeep hover:bg-kibo-accent text-white shadow-lg flex items-center justify-center active:scale-95 transition-transform"
        style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)' }}
      >
        <Plus size={26} />
      </button>

      {mobileFiltersOpen && (
        <div className="sm:hidden fixed inset-0 z-40 flex flex-col justify-end">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileFiltersOpen(false)}
          />
          <div
            className="relative bg-kibo-surface border-t border-kibo-border rounded-t-2xl p-4 pb-6 flex flex-col gap-4 max-h-[80vh] overflow-y-auto"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.5rem)' }}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Filtros</h2>
              <button
                onClick={() => setMobileFiltersOpen(false)}
                className="text-kibo-muted hover:text-kibo-text p-1"
                aria-label="Cerrar"
              >
                <X size={18} />
              </button>
            </div>
            {filtersBar}
          </div>
        </div>
      )}

      <EventFormModal
        open={eventFormOpen}
        onClose={() => setEventFormOpen(false)}
        initial={eventInitial}
        calendars={cals}
        onEnsureCalendar={ensureDefaultCalendar}
      />
      <TaskFormModal
        open={taskFormOpen}
        onClose={() => setTaskFormOpen(false)}
        task={editingTask}
      />
      <ImportCalendarModal open={importOpen} onClose={() => setImportOpen(false)} />
      <BulkDeleteEventsModal open={bulkDeleteOpen} onClose={() => setBulkDeleteOpen(false)} />
      <EntityDetailModal
        open={detailPayload !== null}
        payload={detailPayload}
        calendarName={
          detailPayload?.kind === 'event'
            ? calendarMap.get(detailPayload.data.calendarId)?.name
            : undefined
        }
        calendarColor={
          detailPayload?.kind === 'event'
            ? calendarMap.get(detailPayload.data.calendarId)?.color
            : undefined
        }
        onClose={() => setDetailPayload(null)}
        onEdit={openEditFromDetail}
      />
    </div>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[10px] uppercase tracking-[0.1em] text-kibo-muted font-medium pl-1">
        {title}
      </span>
      <div className="flex items-center gap-2 flex-wrap">{children}</div>
    </div>
  );
}

function TypeChip({
  label,
  color,
  icon: Icon,
  active,
  onClick,
}: {
  label: string;
  color: string;
  icon: typeof Clock;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={active ? 'Ocultar del calendario' : 'Mostrar en el calendario'}
      className={
        'inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full border text-xs transition-colors ' +
        (active
          ? 'text-kibo-text bg-kibo-surface border-kibo-border'
          : 'text-kibo-muted bg-transparent border-kibo-border/40 line-through decoration-kibo-muted/60')
      }
    >
      <Icon size={12} style={{ color: active ? color : undefined }} />
      <span>{label}</span>
      {active ? (
        <Eye size={11} className="text-kibo-muted" />
      ) : (
        <EyeOff size={11} className="text-kibo-muted" />
      )}
    </button>
  );
}

function CalendarChip({
  cal,
  hidden,
  syncing,
  onClick,
  onSync,
}: {
  cal: CalendarDto;
  hidden: boolean;
  syncing?: boolean;
  onClick: () => void;
  onSync?: () => void;
}) {
  return (
    <div
      className={
        'inline-flex items-stretch h-7 rounded-full border text-xs transition-colors overflow-hidden ' +
        (hidden
          ? 'text-kibo-muted bg-transparent border-kibo-border/40'
          : 'text-kibo-text bg-kibo-surface border-kibo-border')
      }
    >
      <button
        onClick={onClick}
        title={hidden ? 'Mostrar en el calendario' : 'Ocultar del calendario'}
        className={
          'inline-flex items-center gap-1.5 pl-2 pr-2 ' +
          (hidden ? 'line-through decoration-kibo-muted/60' : '')
        }
      >
        <span
          className="w-2.5 h-2.5 rounded-sm"
          style={{
            background: hidden ? 'transparent' : cal.color,
            boxShadow: `inset 0 0 0 1.5px ${cal.color}`,
          }}
        />
        <span>{cal.name}</span>
        {hidden ? (
          <EyeOff size={11} className="text-kibo-muted" />
        ) : (
          <Eye size={11} className="text-kibo-muted" />
        )}
      </button>
      {onSync && (
        <button
          onClick={onSync}
          disabled={syncing}
          title="Sincronizar suscripción"
          className="px-2 border-l border-kibo-border/60 text-kibo-muted hover:text-kibo-text disabled:opacity-40"
        >
          <RefreshCw size={11} className={syncing ? 'animate-spin' : undefined} />
        </button>
      )}
    </div>
  );
}
