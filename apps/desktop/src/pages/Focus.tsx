import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import {
  ArrowLeft,
  Check,
  Coffee,
  Pause,
  Play,
  Square,
  Timer,
  Zap,
  SkipForward,
} from 'lucide-react';
import { toast } from 'sonner';
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
import { MarkdownView } from '@kibo/editor';

interface FocusSearch {
  taskId?: string;
}

export function FocusPage() {
  const nav = useNavigate();
  const search = useSearch({ strict: false }) as FocusSearch;
  const focus = useFocus();
  const pomodoro = usePrefs((s) => s.pomodoro);
  const customTimer = usePrefs((s) => s.customTimer);
  const tasks = useTasks();
  const updateTask = useUpdateTask();
  const createTimeEntry = useCreateTimeEntry();
  const [now, setNow] = useState(Date.now());
  const [modeChoice, setModeChoice] = useState<FocusMode>('pomodoro');

  const activeTaskId = focus.taskId ?? search.taskId ?? null;
  const task = useMemo(
    () => (activeTaskId ? (tasks.data ?? []).find((t) => t.id === activeTaskId) ?? null : null),
    [activeTaskId, tasks.data],
  );

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (focus.phase === 'idle') return;
    const next = focus.tick(now);
    if (next && next !== 'work') {
      toast.message(`Comienza ${phaseLabel(next)}`);
    }
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
      const minutes = Math.round(payload.durationSeconds / 60);
      toast.success(`Sesión registrada · ${minutes}m`);
    } catch {
      toast.error('No se pudo guardar la sesión.');
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
        toast.success(`"${task.title}" completada.`);
      } catch {
        toast.error('No se pudo completar la tarea.');
      }
    }
    nav({ to: '/today' });
  };

  const goBack = () => {
    if (isRunning) {
      const ok = window.confirm('Tienes una sesión activa. ¿Salir sin guardar?');
      if (!ok) return;
    }
    focus.stop();
    nav({ to: '/today' });
  };

  const toggleSubtask = (subtaskId: string, done: boolean) => {
    if (!task) return;
    const nextSubtasks = task.subtasks.map((s) => (s.id === subtaskId ? { ...s, done } : s));
    updateTask.mutate({ id: task.id, subtasks: nextSubtasks });
  };

  return (
    <div className="fixed inset-0 z-50 bg-kibo-bg overflow-y-auto">
      <div className="max-w-2xl mx-auto min-h-full flex flex-col p-6 md:p-10">
        <header className="flex items-center justify-between mb-8">
          <button
            type="button"
            onClick={goBack}
            className="flex items-center gap-1.5 text-sm text-kibo-muted hover:text-kibo-text"
          >
            <ArrowLeft size={14} /> Salir
          </button>
          <span className="text-[11px] uppercase tracking-widest text-kibo-muted">Focus</span>
        </header>

        <main className="flex-1 flex flex-col gap-8">
          <section className="text-center">
            {task ? (
              <>
                <p className="text-[11px] uppercase tracking-widest text-kibo-muted mb-2">
                  Trabajando en
                </p>
                <h1 className="text-2xl md:text-3xl font-semibold leading-tight">{task.title}</h1>
                <div className="mt-2 flex items-center justify-center gap-3 text-xs text-kibo-muted">
                  {task.priority && <span>Prioridad {task.priority}</span>}
                  {task.estimatedMinutes && (
                    <span className="flex items-center gap-1">
                      <Timer size={11} /> {task.estimatedMinutes}m estimados
                    </span>
                  )}
                  {task.energy && (
                    <span className="flex items-center gap-1">
                      <Zap size={11} /> energía {task.energy}
                    </span>
                  )}
                </div>
              </>
            ) : (
              <h1 className="text-2xl font-semibold">Sesión de Focus libre</h1>
            )}
          </section>

          <section className="text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-kibo-border bg-kibo-surface/60 px-3 py-1 mb-4">
              {isBreak ? <Coffee size={12} /> : <Timer size={12} />}
              <span className="text-[11px] uppercase tracking-widest">{phaseLabel(focus.phase)}</span>
            </div>
            <div className="text-6xl md:text-7xl font-mono tabular-nums leading-none">
              {formatMs(remaining)}
            </div>
            {focus.mode === 'pomodoro' && isRunning && (
              <p className="text-xs text-kibo-muted mt-3">
                Ciclos completados: {focus.cyclesCompleted}
              </p>
            )}
          </section>

          {!isRunning ? (
            <section className="flex flex-col items-center gap-3">
              <div className="flex items-center gap-2 flex-wrap justify-center">
                <ModeChip
                  active={modeChoice === 'pomodoro'}
                  onClick={() => setModeChoice('pomodoro')}
                  label={`Pomodoro ${pomodoro.workMin}m`}
                />
                <ModeChip
                  active={modeChoice === 'custom'}
                  onClick={() => setModeChoice('custom')}
                  label={`Timer ${customTimer.workMin}m`}
                />
                <ModeChip
                  active={modeChoice === 'stopwatch'}
                  onClick={() => setModeChoice('stopwatch')}
                  label="Cronómetro"
                />
              </div>
              <button
                type="button"
                onClick={() => startFocus(modeChoice)}
                className="btn-primary h-11 px-6"
              >
                <Play size={16} /> Iniciar sesión
              </button>
            </section>
          ) : (
            <section className="flex items-center justify-center gap-2 flex-wrap">
              {focus.paused ? (
                <button type="button" onClick={focus.resume} className="btn-primary">
                  <Play size={14} /> Reanudar
                </button>
              ) : (
                <button type="button" onClick={focus.pause} className="btn-outline">
                  <Pause size={14} /> Pausar
                </button>
              )}
              {focus.mode !== 'stopwatch' && (
                <button type="button" onClick={focus.skipPhase} className="btn-outline">
                  <SkipForward size={14} /> Siguiente fase
                </button>
              )}
              <button type="button" onClick={stopAndSave} className="btn-outline">
                <Square size={14} /> Detener y guardar
              </button>
              {task && (
                <button type="button" onClick={stopAndComplete} className="btn-primary">
                  <Check size={14} /> Guardar y completar
                </button>
              )}
            </section>
          )}

          {task && task.subtasks.length > 0 && (
            <section className="card p-4">
              <h2 className="text-[11px] uppercase tracking-widest text-kibo-muted mb-3">
                Subtareas ({task.subtasks.filter((s) => s.done).length}/{task.subtasks.length})
              </h2>
              <ul className="space-y-2">
                {task.subtasks
                  .slice()
                  .sort((a, b) => a.order - b.order)
                  .map((s) => (
                    <li key={s.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={s.done}
                        onChange={(e) => toggleSubtask(s.id, e.target.checked)}
                        className="accent-kibo-accent w-4 h-4"
                      />
                      <span className={s.done ? 'line-through text-kibo-muted' : ''}>{s.text}</span>
                    </li>
                  ))}
              </ul>
            </section>
          )}

          {task?.description && (
            <section className="card p-5">
              <h2 className="text-[11px] uppercase tracking-widest text-kibo-muted mb-3">
                Notas
              </h2>
              <MarkdownView source={task.description} />
            </section>
          )}
        </main>
      </div>
    </div>
  );
}

function ModeChip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        'h-8 px-3 rounded-full border text-xs transition-colors ' +
        (active
          ? 'bg-kibo-accent/15 border-kibo-accent/40 text-kibo-accent'
          : 'border-kibo-border text-kibo-muted hover:text-kibo-text')
      }
    >
      {label}
    </button>
  );
}
