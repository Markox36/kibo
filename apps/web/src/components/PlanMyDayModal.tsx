import { useEffect, useMemo, useState } from 'react';
import { Sparkles, X, Check, Flag, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { suggestPlanForDay, type PlanSuggestion } from '@kibo/planning';
import { Modal } from './Modal';
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

function fmtRange(s: Date, e: Date): string {
  return `${fmtTime(s)} – ${fmtTime(e)}`;
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

  const date = targetDate ?? new Date();

  const suggestions = useMemo(() => {
    if (!open) return [];
    return suggestPlanForDay(
      date,
      (tasks.data ?? []).map(toPlannerTask),
      events.data ?? [],
      wh,
    );
  }, [open, date, tasks.data, events.data, wh]);

  useEffect(() => {
    if (open) setDismissed(new Set());
  }, [open, date.toISOString().slice(0, 10)]);

  const visible = suggestions.filter((s) => !dismissed.has(s.taskId));

  const apply = async () => {
    if (visible.length === 0) return;
    setApplying(true);
    const dateKey = toDateKey(date);
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
      toast.success(`Planificados ${visible.length} bloques en el calendario.`);
      onClose();
    } else {
      toast.error(`${failed} de ${visible.length} bloques no se pudieron aplicar.`);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Planificar mi día"
      description="Kibo sugiere bloques en tus huecos libres. Aceptalos, quitá los que no encajen y aplicá al calendario."
      size="lg"
      footer={
        <div className="flex items-center justify-between gap-2 w-full">
          <span className="text-xs text-kibo-muted tabular-nums">
            {visible.length} bloques · {fmtMinutes(visible.reduce((n, s) => n + s.minutes, 0))}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-outline"
              disabled={applying}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={apply}
              disabled={visible.length === 0 || applying}
              className="btn-primary"
            >
              <Check size={14} /> Aplicar planificación
            </button>
          </div>
        </div>
      }
    >
      {suggestions.length === 0 ? (
        <div className="text-center py-6">
          <Sparkles size={22} className="mx-auto text-kibo-muted mb-2" />
          <p className="text-sm text-kibo-muted">
            No hay huecos libres o no tienes tareas candidatas para planificar hoy.
          </p>
          <p className="text-[11px] text-kibo-muted mt-1">
            Revisa el horario laboral en Ajustes o añade duración estimada a tus tareas.
          </p>
        </div>
      ) : (
        <ul className="space-y-2 max-h-[55vh] overflow-y-auto">
          {suggestions.map((s) => {
            const isDismissed = dismissed.has(s.taskId);
            return (
              <li
                key={s.taskId}
                className={
                  'flex items-start gap-3 rounded-lg border px-3 py-2 transition-opacity ' +
                  (isDismissed
                    ? 'border-kibo-border/40 bg-kibo-bg/20 opacity-40'
                    : 'border-kibo-border bg-kibo-bg/40')
                }
              >
                <div className="text-xs font-mono text-kibo-muted w-24 shrink-0 pt-0.5 tabular-nums">
                  {fmtRange(s.start, s.end)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm truncate">{s.taskTitle}</p>
                  {s.reasons.length > 0 && (
                    <p className="text-[11px] text-kibo-muted mt-0.5 flex items-center gap-2 flex-wrap">
                      <Flag size={10} />
                      {s.reasons.join(' · ')}
                      <span className="flex items-center gap-1">
                        <Clock size={10} /> {fmtMinutes(s.minutes)}
                      </span>
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setDismissed((prev) => {
                      const next = new Set(prev);
                      if (isDismissed) next.delete(s.taskId);
                      else next.add(s.taskId);
                      return next;
                    });
                  }}
                  aria-label={isDismissed ? 'Restaurar bloque' : 'Descartar bloque'}
                  title={isDismissed ? 'Restaurar bloque' : 'Descartar bloque'}
                  className="h-7 w-7 rounded-md border border-kibo-border/60 text-kibo-muted hover:text-kibo-text hover:bg-kibo-bg/60 shrink-0 flex items-center justify-center"
                >
                  <X size={12} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Modal>
  );
}
