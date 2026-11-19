import { useMemo, useState } from 'react';
import { CalendarPlus, Check, Flag, Inbox as InboxIcon, Pencil, AlertTriangle, ArrowRight, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { useTasks, useUpdateTask } from '../hooks/useTasks';
import { TaskFormModal } from '../components/TaskFormModal';
import type { TaskDto } from '../lib/entities-api';

interface Buckets {
  overdue: TaskDto[];
  deadlineNoPlan: TaskDto[];
  draggedFromPast: TaskDto[];
  undated: TaskDto[];
}

function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${day}`;
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
  const byDeadline = (a: TaskDto, b: TaskDto) => {
    const ad = a.dueDate ?? '9999';
    const bd = b.dueDate ?? '9999';
    return ad.localeCompare(bd);
  };
  const byUpdated = (a: TaskDto, b: TaskDto) => b.updatedAt.localeCompare(a.updatedAt);
  out.overdue.sort(byDeadline);
  out.deadlineNoPlan.sort(byDeadline);
  out.draggedFromPast.sort(byUpdated);
  out.undated.sort(byUpdated);
  return out;
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

function daysBetween(a: string, b: string): number {
  const da = new Date(`${a}T00:00:00`).getTime();
  const db = new Date(`${b}T00:00:00`).getTime();
  return Math.abs(Math.round((db - da) / 86400000));
}

const PRIORITY_STYLES: Record<string, string> = {
  low: 'text-neutral-400',
  medium: 'text-kibo-accent',
  high: 'text-rose-400',
};

export function UnscheduledPage() {
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

  const scheduleToday = (t: TaskDto) => {
    update.mutate(
      { id: t.id, plannedDate: today, plannedStart: null, plannedEnd: null },
      {
        onSuccess: () => toast.success(`"${t.title}" planificada para hoy.`),
        onError: () => toast.error('No se pudo planificar.'),
      },
    );
  };

  const complete = (t: TaskDto) => {
    update.mutate(
      { id: t.id, status: 'done' },
      {
        onSuccess: () => toast.success(`"${t.title}" completada.`),
        onError: () => toast.error('No se pudo completar.'),
      },
    );
  };

  return (
    <div className="h-full flex flex-col gap-3 min-h-0 overflow-y-auto">
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <InboxIcon size={18} className="text-kibo-muted" /> Sin planificar
          </h1>
          <p className="text-xs text-kibo-muted mt-1 max-w-lg">
            Tareas pendientes que aún no tienen un día asignado en el calendario. Arrastralas al calendario o
            asignales una fecha rápida.
          </p>
        </div>
        {totalCount > 0 && (
          <span className="text-xs text-kibo-muted tabular-nums bg-kibo-bg/40 border border-kibo-border rounded-full px-3 py-1">
            {totalCount} pendientes
          </span>
        )}
      </header>

      {tasks.isLoading && <p className="text-sm text-kibo-muted">Cargando…</p>}
      {!tasks.isLoading && totalCount === 0 && (
        <div className="card p-8 text-center">
          <p className="text-sm text-kibo-muted">Ninguna tarea pendiente sin planificar. 🎉</p>
        </div>
      )}

      {buckets.overdue.length > 0 && (
        <Bucket
          title="Vencidas"
          subtitle="Tienen deadline pasado y no están completadas."
          tone="danger"
          items={buckets.overdue}
          today={today}
          onSchedule={scheduleToday}
          onComplete={complete}
          onEdit={setEditing}
        />
      )}
      {buckets.deadlineNoPlan.length > 0 && (
        <Bucket
          title="Con deadline pero sin fecha planificada"
          subtitle="Deberías reservarles hueco antes de que venzan."
          tone="warning"
          items={buckets.deadlineNoPlan}
          today={today}
          onSchedule={scheduleToday}
          onComplete={complete}
          onEdit={setEditing}
        />
      )}
      {buckets.draggedFromPast.length > 0 && (
        <Bucket
          title="Arrastradas de días pasados"
          subtitle="Estaban planificadas antes de hoy y no se completaron."
          tone="neutral"
          items={buckets.draggedFromPast}
          today={today}
          onSchedule={scheduleToday}
          onComplete={complete}
          onEdit={setEditing}
        />
      )}
      {buckets.undated.length > 0 && (
        <Bucket
          title="Sin fecha"
          subtitle="Ideas capturadas rápido. Priorizalas cuando puedas."
          tone="neutral"
          items={buckets.undated}
          today={today}
          onSchedule={scheduleToday}
          onComplete={complete}
          onEdit={setEditing}
        />
      )}

      <TaskFormModal open={editing !== null} onClose={() => setEditing(null)} task={editing} />
    </div>
  );
}

interface BucketProps {
  title: string;
  subtitle: string;
  tone: 'danger' | 'warning' | 'neutral';
  items: TaskDto[];
  today: string;
  onSchedule: (t: TaskDto) => void;
  onComplete: (t: TaskDto) => void;
  onEdit: (t: TaskDto) => void;
}

function Bucket({ title, subtitle, tone, items, today, onSchedule, onComplete, onEdit }: BucketProps) {
  const toneClasses =
    tone === 'danger'
      ? 'border-rose-500/30'
      : tone === 'warning'
      ? 'border-amber-500/30'
      : 'border-kibo-border';
  const toneIcon =
    tone === 'danger' ? (
      <AlertTriangle size={14} className="text-rose-400" />
    ) : tone === 'warning' ? (
      <AlertTriangle size={14} className="text-amber-400" />
    ) : (
      <ArrowRight size={14} className="text-kibo-muted" />
    );
  return (
    <section className={`card p-4 ${toneClasses}`}>
      <header className="mb-3">
        <h2 className="text-sm font-medium flex items-center gap-2">
          {toneIcon} {title}
          <span className="text-xs text-kibo-muted tabular-nums">({items.length})</span>
        </h2>
        <p className="text-[11px] text-kibo-muted mt-0.5">{subtitle}</p>
      </header>
      <ul className="space-y-2">
        {items.map((t) => (
          <li
            key={t.id}
            className="flex items-start gap-3 rounded-lg bg-kibo-bg/40 border border-kibo-border/60 px-3 py-2 hover:border-kibo-border transition-colors"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm text-kibo-text truncate">{t.title}</p>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-kibo-muted mt-1">
                {t.priority && (
                  <span className={`flex items-center gap-1 ${PRIORITY_STYLES[t.priority] ?? ''}`}>
                    <Flag size={10} /> {t.priority}
                  </span>
                )}
                {t.estimatedMinutes && (
                  <span className="flex items-center gap-1">
                    <Clock size={10} /> {t.estimatedMinutes}m
                  </span>
                )}
                {t.dueDate && (
                  <span
                    className={
                      t.dueDate.slice(0, 10) < today
                        ? 'text-rose-300'
                        : t.dueDate.slice(0, 10) === today
                        ? 'text-amber-300'
                        : ''
                    }
                  >
                    {fmtDueLabel(t.dueDate, today)}
                  </span>
                )}
                {t.plannedDate && t.plannedDate.slice(0, 10) < today && (
                  <span className="text-kibo-muted">
                    planificada {fmtDueLabel(t.plannedDate, today)}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <IconBtn label="Planificar hoy" onClick={() => onSchedule(t)}>
                <CalendarPlus size={14} />
              </IconBtn>
              <IconBtn label="Editar" onClick={() => onEdit(t)}>
                <Pencil size={14} />
              </IconBtn>
              <IconBtn label="Completar" onClick={() => onComplete(t)}>
                <Check size={14} />
              </IconBtn>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function IconBtn({
  children,
  onClick,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="h-7 w-7 rounded-md border border-kibo-border/60 text-kibo-muted hover:text-kibo-text hover:border-kibo-border hover:bg-kibo-bg/60 flex items-center justify-center transition-colors"
    >
      {children}
    </button>
  );
}
