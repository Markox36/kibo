import { useEffect, useState } from 'react';
import { X, Play, Pause, RotateCcw, SkipForward, Timer, Coffee } from 'lucide-react';
import clsx from 'clsx';
import {
  useFocus,
  currentRemainingMs,
  formatMs,
  phaseLabel,
  type FocusMode,
} from '../store/focus';
import { usePrefs } from '../store/prefs';
import { LofiPlayer } from './LofiPlayer';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function FocusPanel({ open, onClose }: Props) {
  const focus = useFocus();
  const pomodoro = usePrefs((s) => s.pomodoro);
  const customTimer = usePrefs((s) => s.customTimer);
  const setPrefs = usePrefs((s) => s.set);
  const setPomodoro = usePrefs((s) => s.setPomodoro);
  const setCustomTimer = usePrefs((s) => s.setCustomTimer);
  const [selectedMode, setSelectedMode] = useState<FocusMode>(focus.mode);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!open) return;
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const remaining = currentRemainingMs(focus, now);
  const running = focus.phase !== 'idle';

  const startSession = () => {
    const plan =
      selectedMode === 'pomodoro'
        ? pomodoro
        : {
            workMin: customTimer.workMin,
            shortBreakMin: customTimer.breakMin,
            longBreakMin: customTimer.breakMin,
            cyclesBeforeLong: 999,
          };
    focus.start(selectedMode, plan);
  };

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-sm h-full bg-kibo-surface border-l border-kibo-border shadow-2xl flex flex-col animate-in slide-in-from-right duration-150">
        <header className="h-12 flex items-center gap-2 px-4 border-b border-kibo-border">
          <Timer size={16} className="text-kibo-accent" />
          <h2 className="text-sm font-semibold">Concentración</h2>
          <button
            onClick={onClose}
            className="ml-auto text-kibo-muted hover:text-kibo-text w-7 h-7 rounded-md flex items-center justify-center hover:bg-kibo-border/50"
            aria-label="Cerrar"
          >
            <X size={16} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="rounded-2xl border border-kibo-border bg-kibo-bg/40 p-5 flex flex-col items-center gap-3">
            <div className="text-[11px] uppercase tracking-wider text-kibo-muted">
              {phaseLabel(focus.phase)}
            </div>
            <div
              className={clsx(
                'font-mono tabular-nums text-5xl font-semibold',
                focus.phase === 'work' && 'text-kibo-text',
                (focus.phase === 'short_break' || focus.phase === 'long_break') &&
                  'text-emerald-400',
                focus.phase === 'idle' && 'text-kibo-muted',
              )}
            >
              {formatMs(running ? remaining : 0)}
            </div>
            {running && (
              <div className="text-[11px] text-kibo-muted">
                Ciclos completados: <span className="font-mono">{focus.cyclesCompleted}</span>
                {focus.paused && <span className="ml-2 text-amber-400">· en pausa</span>}
              </div>
            )}

            <div className="flex items-center gap-2 mt-2">
              {!running && (
                <button
                  onClick={startSession}
                  className="btn-primary h-9 px-4"
                  aria-label="Iniciar sesión"
                >
                  <Play size={14} /> Empezar
                </button>
              )}
              {running && !focus.paused && (
                <button onClick={focus.pause} className="btn-outline h-9 px-4">
                  <Pause size={14} /> Pausar
                </button>
              )}
              {running && focus.paused && (
                <button onClick={focus.resume} className="btn-primary h-9 px-4">
                  <Play size={14} /> Reanudar
                </button>
              )}
              {running && (
                <>
                  <button
                    onClick={focus.skipPhase}
                    className="btn-outline h-9 px-3"
                    title="Saltar fase"
                  >
                    <SkipForward size={14} />
                  </button>
                  <button
                    onClick={focus.stop}
                    className="btn-outline h-9 px-3"
                    title="Terminar sesión"
                  >
                    <RotateCcw size={14} />
                  </button>
                </>
              )}
            </div>
          </div>

          {!running && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-1 p-0.5 rounded-lg border border-kibo-border bg-kibo-bg/40 w-fit">
                <ModeBtn
                  active={selectedMode === 'pomodoro'}
                  onClick={() => setSelectedMode('pomodoro')}
                >
                  Pomodoro
                </ModeBtn>
                <ModeBtn
                  active={selectedMode === 'custom'}
                  onClick={() => setSelectedMode('custom')}
                >
                  Custom
                </ModeBtn>
              </div>

              {selectedMode === 'pomodoro' ? (
                <div className="grid grid-cols-2 gap-2">
                  <NumField
                    label="Trabajo (min)"
                    value={pomodoro.workMin}
                    onChange={(v) => setPomodoro({ workMin: v })}
                  />
                  <NumField
                    label="Descanso corto"
                    value={pomodoro.shortBreakMin}
                    onChange={(v) => setPomodoro({ shortBreakMin: v })}
                  />
                  <NumField
                    label="Descanso largo"
                    value={pomodoro.longBreakMin}
                    onChange={(v) => setPomodoro({ longBreakMin: v })}
                  />
                  <NumField
                    label="Ciclos hasta largo"
                    value={pomodoro.cyclesBeforeLong}
                    onChange={(v) => setPomodoro({ cyclesBeforeLong: v })}
                    min={1}
                    max={12}
                  />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <NumField
                    label="Trabajo (min)"
                    value={customTimer.workMin}
                    onChange={(v) => setCustomTimer({ workMin: v })}
                  />
                  <NumField
                    label="Descanso (min)"
                    value={customTimer.breakMin}
                    onChange={(v) => setCustomTimer({ breakMin: v })}
                  />
                </div>
              )}
              <p className="text-[11px] text-kibo-muted flex items-center gap-1">
                <Coffee size={11} />
                {selectedMode === 'pomodoro'
                  ? `Ciclos de ${pomodoro.workMin}′ trabajo + ${pomodoro.shortBreakMin}′ descanso, largo cada ${pomodoro.cyclesBeforeLong}.`
                  : `Alternancia continua ${customTimer.workMin}′ / ${customTimer.breakMin}′.`}
              </p>
            </div>
          )}

          <LofiPlayer />
        </div>

        <footer className="p-3 border-t border-kibo-border">
          <label className="flex items-center gap-2 text-xs text-kibo-muted cursor-pointer">
            <input
              type="checkbox"
              checked={usePrefs.getState().notificationsEnabled}
              onChange={(e) => setPrefs({ notificationsEnabled: e.target.checked })}
              className="accent-kibo-accent"
            />
            Notificaciones del sistema
          </label>
        </footer>
      </div>
    </div>
  );
}

function ModeBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'px-3 h-7 rounded-md text-xs transition-colors',
        active
          ? 'bg-kibo-surface text-kibo-text border border-kibo-border'
          : 'text-kibo-muted hover:text-kibo-text',
      )}
    >
      {children}
    </button>
  );
}

function NumField({
  label,
  value,
  onChange,
  min = 1,
  max = 180,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-wide text-kibo-muted">{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (!Number.isFinite(n)) return;
          onChange(Math.min(max, Math.max(min, Math.round(n))));
        }}
        className="input h-8 text-sm"
      />
    </label>
  );
}
