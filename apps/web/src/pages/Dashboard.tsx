import { useMemo, useState, useEffect } from 'react';
import { Link } from '@tanstack/react-router';
import {
  CalendarDays,
  CheckCircle2,
  Circle,
  Clock,
  Flame,
  Inbox as InboxIcon,
  ListTodo,
  Plus,
  Timer,
  X,
} from 'lucide-react';
import { useTasks, useCreateTask, useUpdateTask } from '../hooks/useTasks';
import { useEvents } from '../hooks/useEvents';
import { useInbox } from '../hooks/useInbox';
import { useGoogleIntegration } from '../hooks/useIntegrations';
import { GoogleIntegrationCard } from '../components/GoogleIntegrationCard';
import { WorkloadCard } from '../components/WorkloadCard';
import { DeadlineWarningsCard } from '../components/DeadlineWarningsCard';
import { useAuthStore } from '../store/auth';
import type { TaskDto, EventDto } from '../lib/entities-api';

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}
function todayIso(d = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function greeting(h: number): string {
  if (h < 6) return 'Buenas noches';
  if (h < 13) return 'Buenos días';
  if (h < 20) return 'Buenas tardes';
  return 'Buenas noches';
}
function longDate(d: Date): string {
  return d.toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}
function timeStr(iso: string): string {
  return iso.slice(11, 16);
}
function minutesUntil(iso: string, now: Date): number {
  return Math.round((new Date(iso).getTime() - now.getTime()) / 60000);
}
function humanUntil(mins: number): string {
  if (mins < 1) return 'ahora';
  if (mins < 60) return `en ${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `en ${h} h` : `en ${h} h ${m} min`;
}

export function Dashboard() {
  const tasks = useTasks();
  const events = useEvents();
  const inbox = useInbox();
  const google = useGoogleIntegration();
  const user = useAuthStore((s) => s.user);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    setBannerDismissed(localStorage.getItem('kibo-google-banner-dismissed') === '1');
  }, []);
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const showGoogleBanner =
    !bannerDismissed && google.data?.configured && !google.data?.connected;

  const today = todayIso(now);
  const allTasks = tasks.data ?? [];
  const allEvents = events.data ?? [];
  const pendingInbox = (inbox.data ?? []).filter((i) => i.status === 'pending').length;

  const tasksToday = allTasks.filter(
    (t) => t.plannedDate === today || t.dueDate === today,
  );
  const eventsToday = allEvents.filter((e) => e.start.slice(0, 10) === today);
  const overdue = allTasks.filter(
    (t) => t.status !== 'done' && t.dueDate && t.dueDate < today,
  );

  const doneToday = tasksToday.filter((t) => t.status === 'done').length;
  const totalToday = tasksToday.length;
  const progressPct = totalToday === 0 ? 0 : Math.round((doneToday / totalToday) * 100);

  const nextEvent = useMemo(
    () => eventsToday.find((e) => new Date(e.end).getTime() > now.getTime()) ?? null,
    [eventsToday, now],
  );

  return (
    <div className="h-full flex flex-col gap-3 min-h-0">
      {showGoogleBanner && (
        <div className="rounded-xl border border-kibo-accent/40 bg-kibo-accent/5 px-4 py-3 relative">
          <button
            onClick={() => {
              setBannerDismissed(true);
              localStorage.setItem('kibo-google-banner-dismissed', '1');
            }}
            className="absolute top-2 right-2 text-kibo-muted hover:text-kibo-text p-1"
            aria-label="Descartar"
          >
            <X size={14} />
          </button>
          <div className="flex flex-col sm:flex-row items-start gap-3">
            <div className="flex-1">
              <h3 className="text-sm font-semibold">Conectá tu Google Calendar</h3>
              <p className="text-xs text-kibo-muted mt-1 max-w-xl">
                Importá tus eventos y sincronizá con un click.
              </p>
            </div>
            <div className="w-full sm:w-auto shrink-0">
              <GoogleIntegrationCard compact />
            </div>
          </div>
        </div>
      )}

      <HeroStrip
        name={user?.name ?? null}
        now={now}
        doneToday={doneToday}
        totalToday={totalToday}
        progressPct={progressPct}
        eventsCount={eventsToday.length}
        nextEvent={nextEvent}
        overdueCount={overdue.length}
        inboxCount={pendingInbox}
      />

      <WorkloadCard />
      <DeadlineWarningsCard />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 flex-1 min-h-0">
        <TimelineCard events={eventsToday} tasks={tasksToday} now={now} />
        <TasksPanel tasks={tasksToday} overdue={overdue} progressPct={progressPct} />
      </div>
    </div>
  );
}

function HeroStrip({
  name,
  now,
  doneToday,
  totalToday,
  progressPct,
  eventsCount,
  nextEvent,
  overdueCount,
  inboxCount,
}: {
  name: string | null;
  now: Date;
  doneToday: number;
  totalToday: number;
  progressPct: number;
  eventsCount: number;
  nextEvent: EventDto | null;
  overdueCount: number;
  inboxCount: number;
}) {
  const first = name?.split(' ')[0];
  return (
    <div className="card px-5 py-4 flex flex-col lg:flex-row lg:items-center gap-4">
      <div className="flex-1 min-w-0">
        <p className="text-[11px] uppercase tracking-widest text-kibo-muted">
          {longDate(now)}
        </p>
        <h1 className="text-2xl font-semibold mt-0.5 truncate">
          {greeting(now.getHours())}
          {first ? `, ${first}` : ''}.
        </h1>
        <p className="text-xs text-kibo-muted mt-1">
          {totalToday === 0
            ? 'Día libre. Añadí algo abajo.'
            : progressPct === 100
              ? '¡Todo hecho por hoy!'
              : `${doneToday} de ${totalToday} tareas · ${eventsCount} eventos`}
        </p>
      </div>

      <div className="flex items-center gap-6 shrink-0">
        <div className="text-right">
          <div className="text-3xl font-semibold tabular-nums leading-none">
            {pad(now.getHours())}:{pad(now.getMinutes())}
          </div>
        </div>
        <ProgressRing pct={progressPct} />
        <div className="flex gap-2">
          <StatChip
            icon={CalendarDays}
            label="Próximo"
            value={
              nextEvent
                ? nextEvent.allDay
                  ? 'Todo día'
                  : timeStr(nextEvent.start)
                : '—'
            }
            hint={
              nextEvent && !nextEvent.allDay
                ? humanUntil(minutesUntil(nextEvent.start, now))
                : nextEvent?.title
            }
            to="/calendar"
          />
          <StatChip
            icon={Flame}
            label="Atrasadas"
            value={overdueCount.toString()}
            to="/tasks"
            danger={overdueCount > 0}
          />
          <StatChip
            icon={InboxIcon}
            label="Inbox"
            value={inboxCount.toString()}
            to="/inbox"
          />
        </div>
      </div>
    </div>
  );
}

function ProgressRing({ pct }: { pct: number }) {
  const r = 22;
  const c = 2 * Math.PI * r;
  const off = c - (pct / 100) * c;
  return (
    <div className="relative w-14 h-14 shrink-0" title={`${pct}% completado`}>
      <svg viewBox="0 0 56 56" className="w-full h-full -rotate-90">
        <circle cx="28" cy="28" r={r} className="fill-none stroke-kibo-border" strokeWidth="4" />
        <circle
          cx="28"
          cy="28"
          r={r}
          className="fill-none stroke-kibo-accent transition-all duration-500"
          strokeWidth="4"
          strokeDasharray={c}
          strokeDashoffset={off}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-[11px] font-semibold tabular-nums">
        {pct}%
      </div>
    </div>
  );
}

function StatChip({
  icon: Icon,
  label,
  value,
  hint,
  to,
  danger,
}: {
  icon: typeof InboxIcon;
  label: string;
  value: string;
  hint?: string | null;
  to: string;
  danger?: boolean;
}) {
  return (
    <Link
      to={to}
      title={hint ?? undefined}
      className="rounded-lg border border-kibo-border bg-kibo-bg/40 px-3 py-2 flex flex-col hover:border-kibo-muted transition-colors min-w-[80px]"
    >
      <span className="text-[10px] uppercase tracking-wide text-kibo-muted flex items-center gap-1">
        <Icon size={10} className={danger ? 'text-red-400' : 'text-kibo-accent'} />
        {label}
      </span>
      <span
        className={
          'text-base font-semibold tabular-nums leading-tight ' +
          (danger ? 'text-red-400' : '')
        }
      >
        {value}
      </span>
    </Link>
  );
}

interface TimelineItem {
  key: string;
  kind: 'event' | 'task';
  start: Date;
  end: Date | null;
  title: string;
  allDay: boolean;
  done?: boolean;
}

function TimelineCard({
  events,
  tasks,
  now,
}: {
  events: EventDto[];
  tasks: TaskDto[];
  now: Date;
}) {
  const { timed, allDay, untimedTasks } = useMemo(() => {
    const evts: TimelineItem[] = events.map((e) => ({
      key: `e-${e.id}`,
      kind: 'event',
      start: new Date(e.start),
      end: new Date(e.end),
      title: e.title,
      allDay: e.allDay,
    }));
    const timedTasks: TimelineItem[] = tasks
      .filter((t) => t.plannedStart)
      .map((t) => ({
        key: `t-${t.id}`,
        kind: 'task',
        start: new Date(t.plannedStart as string),
        end: t.plannedEnd ? new Date(t.plannedEnd) : null,
        title: t.title,
        allDay: false,
        done: t.status === 'done',
      }));
    const all = [...evts, ...timedTasks].sort(
      (a, b) => a.start.getTime() - b.start.getTime(),
    );
    return {
      timed: all.filter((i) => !i.allDay),
      allDay: all.filter((i) => i.allDay),
      untimedTasks: tasks.filter((t) => !t.plannedStart),
    };
  }, [events, tasks]);

  const nextIdx = timed.findIndex((i) => i.start.getTime() > now.getTime());
  const isEmpty = timed.length === 0 && allDay.length === 0 && untimedTasks.length === 0;

  return (
    <div className="card p-4 flex flex-col min-h-0">
      <div className="flex items-center gap-2 mb-3 text-sm font-medium shrink-0">
        <Clock size={16} className="text-kibo-accent" />
        Agenda de hoy
        <span className="ml-auto text-xs text-kibo-muted font-mono">
          {timed.length + allDay.length}
        </span>
      </div>
      {allDay.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5 shrink-0">
          {allDay.map((i) => (
            <span
              key={i.key}
              className="text-[11px] px-2 py-0.5 rounded-md bg-kibo-accent/10 text-kibo-accent border border-kibo-accent/20"
            >
              {i.title}
            </span>
          ))}
        </div>
      )}
      {isEmpty ? (
        <div className="text-sm text-kibo-muted flex-1 flex items-center justify-center text-center px-6">
          Nada programado. Arrastrá tareas al calendario para bloquear el día.
        </div>
      ) : (
        <ul className="relative space-y-0.5 overflow-y-auto pr-1 flex-1 min-h-0">
          {timed.map((i, idx) => {
            const isPast = i.end ? i.end.getTime() < now.getTime() : false;
            const isNow =
              i.start.getTime() <= now.getTime() &&
              (i.end ? i.end.getTime() > now.getTime() : false);
            return (
              <li key={i.key}>
                {idx === nextIdx && (
                  <div className="flex items-center gap-2 py-1.5">
                    <div className="h-px flex-1 bg-red-400/60" />
                    <span className="text-[10px] uppercase text-red-400 tabular-nums">
                      {pad(now.getHours())}:{pad(now.getMinutes())}
                    </span>
                    <div className="h-px w-2 bg-red-400/60" />
                  </div>
                )}
                <div
                  className={
                    'flex items-start gap-3 rounded-md px-2 py-1.5 ' +
                    (isNow
                      ? 'bg-kibo-accent/10 border border-kibo-accent/30'
                      : 'hover:bg-kibo-bg/40')
                  }
                >
                  <span
                    className={
                      'font-mono text-xs tabular-nums w-11 pt-0.5 ' +
                      (isPast ? 'text-kibo-muted/60' : 'text-kibo-muted')
                    }
                  >
                    {timeStr(i.start.toISOString())}
                  </span>
                  <span
                    className={
                      'mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ' +
                      (i.kind === 'event' ? 'bg-kibo-accent' : 'bg-amber-400')
                    }
                  />
                  <div className="flex-1 min-w-0">
                    <div
                      className={
                        'text-sm truncate ' +
                        (isPast || i.done ? 'line-through text-kibo-muted' : '')
                      }
                    >
                      {i.title}
                    </div>
                    <div className="text-[11px] text-kibo-muted">
                      {i.kind === 'event' ? 'Evento' : 'Tarea'}
                      {i.end && ' · ' + timeStr(i.end.toISOString())}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
          {untimedTasks.length > 0 && (
            <li className="pt-3">
              <div className="text-[10px] uppercase tracking-widest text-kibo-muted px-2 mb-1">
                Sin hora
              </div>
              <ul className="space-y-0.5">
                {untimedTasks.map((t) => (
                  <li
                    key={`u-${t.id}`}
                    className="flex items-start gap-3 rounded-md px-2 py-1.5 hover:bg-kibo-bg/40"
                  >
                    <span className="font-mono text-xs text-kibo-muted/60 w-11 pt-0.5">—</span>
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 bg-amber-400" />
                    <div className="flex-1 min-w-0">
                      <div
                        className={
                          'text-sm truncate ' +
                          (t.status === 'done' ? 'line-through text-kibo-muted' : '')
                        }
                      >
                        {t.title}
                      </div>
                      <div className="text-[11px] text-kibo-muted">Tarea</div>
                    </div>
                  </li>
                ))}
              </ul>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

function TasksPanel({
  tasks,
  overdue,
  progressPct,
}: {
  tasks: TaskDto[];
  overdue: TaskDto[];
  progressPct: number;
}) {
  const [tab, setTab] = useState<'today' | 'overdue'>('today');
  const [text, setText] = useState('');
  const create = useCreateTask();
  const update = useUpdateTask();

  const sorted = useMemo(() => {
    const rank = (p: string) => (p === 'high' ? 0 : p === 'medium' ? 1 : 2);
    return [...tasks].sort((a, b) => {
      if ((a.status === 'done') !== (b.status === 'done'))
        return a.status === 'done' ? 1 : -1;
      const r = rank(a.priority) - rank(b.priority);
      if (r !== 0) return r;
      return a.title.localeCompare(b.title);
    });
  }, [tasks]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = text.trim();
    if (!title) return;
    try {
      await create.mutateAsync({
        title,
        status: 'pending',
        priority: 'medium',
        plannedDate: todayIso(),
        tagIds: [],
      });
      setText('');
    } catch {
      /* ignore */
    }
  };

  const toggle = (t: TaskDto) => {
    update.mutate({ id: t.id, status: t.status === 'done' ? 'pending' : 'done' });
  };

  const rows = tab === 'today' ? sorted : overdue;

  return (
    <div className="card p-4 flex flex-col min-h-0">
      <div className="flex items-center gap-2 mb-3 shrink-0">
        <ListTodo size={16} className="text-kibo-accent" />
        <span className="text-sm font-medium">Tareas</span>
        <div className="ml-auto flex items-center gap-1 text-xs">
          <TabBtn active={tab === 'today'} onClick={() => setTab('today')}>
            Hoy <span className="text-kibo-muted ml-1">{sorted.length}</span>
          </TabBtn>
          <TabBtn
            active={tab === 'overdue'}
            onClick={() => setTab('overdue')}
            danger={overdue.length > 0}
          >
            Atrasadas <span className={overdue.length > 0 ? 'text-red-400 ml-1' : 'text-kibo-muted ml-1'}>{overdue.length}</span>
          </TabBtn>
        </div>
      </div>

      {tab === 'today' && (
        <>
          <div className="h-1.5 rounded-full bg-kibo-bg/60 overflow-hidden mb-3 shrink-0">
            <div
              className="h-full bg-kibo-accent transition-[width] duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <form onSubmit={submit} className="flex items-center gap-2 mb-2 shrink-0">
            <Plus size={14} className="text-kibo-muted ml-1" />
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Añadir tarea para hoy…"
              className="flex-1 bg-transparent outline-none text-sm py-1.5"
            />
            <button
              type="submit"
              disabled={!text.trim() || create.isPending}
              className="text-xs px-3 h-7 rounded-md bg-kibo-accentDeep hover:bg-kibo-accent text-white disabled:opacity-40"
            >
              Añadir
            </button>
          </form>
        </>
      )}

      {rows.length === 0 ? (
        <div className="text-sm text-kibo-muted flex-1 flex items-center justify-center text-center px-6">
          {tab === 'today' ? 'Nada por ahora. Añadí arriba con Enter.' : 'Sin tareas atrasadas. 🎯'}
        </div>
      ) : (
        <ul className="space-y-0.5 overflow-y-auto pr-1 flex-1 min-h-0">
          {rows.map((t) => (
            <li key={t.id} className="flex items-start gap-2 py-1 rounded-md hover:bg-kibo-bg/40 px-1">
              <button
                onClick={() => toggle(t)}
                className="mt-0.5 text-kibo-muted hover:text-kibo-accent shrink-0"
                aria-label="toggle done"
              >
                {t.status === 'done' ? (
                  <CheckCircle2 size={16} className="text-kibo-accent" />
                ) : (
                  <Circle size={16} />
                )}
              </button>
              <div className="flex-1 min-w-0">
                <div
                  className={
                    'text-sm truncate ' +
                    (t.status === 'done' ? 'line-through text-kibo-muted' : '')
                  }
                >
                  {t.title}
                </div>
                <div className="flex items-center gap-2 text-[11px] text-kibo-muted mt-0.5">
                  <span
                    className={
                      t.priority === 'high'
                        ? 'text-red-400'
                        : t.priority === 'medium'
                          ? 'text-amber-400'
                          : ''
                    }
                  >
                    {t.priority === 'high' ? 'P1' : t.priority === 'medium' ? 'P2' : 'P3'}
                  </span>
                  {t.plannedStart && (
                    <span className="font-mono tabular-nums">{timeStr(t.plannedStart)}</span>
                  )}
                  {t.estimatedMinutes && (
                    <span className="inline-flex items-center gap-0.5">
                      <Timer size={10} /> {t.estimatedMinutes}m
                    </span>
                  )}
                  {tab === 'overdue' && t.dueDate && (
                    <span className="ml-auto text-red-400 font-mono tabular-nums">
                      vencía {t.dueDate.slice(5)}
                    </span>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TabBtn({
  active,
  danger,
  onClick,
  children,
}: {
  active: boolean;
  danger?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        'px-2 h-7 rounded-md text-xs transition-colors ' +
        (active
          ? danger
            ? 'bg-red-400/10 border border-red-400/30 text-red-300'
            : 'bg-kibo-accent/10 border border-kibo-accent/30 text-kibo-text'
          : 'border border-transparent text-kibo-muted hover:text-kibo-text')
      }
    >
      {children}
    </button>
  );
}
