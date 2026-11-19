import { useAuthStore } from '../store/auth';
import { useCalendars, useCreateCalendar } from '../hooks/useCalendars';
import { API_URL } from '../lib/env';
import { toast } from 'sonner';
import { useEffect, useState } from 'react';
import { Bell, BellOff, Minus, Plus, RotateCcw } from 'lucide-react';
import { usePrefs, ZOOM_MAX, ZOOM_MIN, ZOOM_STEP } from '../store/prefs';
import { currentPermission, requestPermission, type NotifPermission } from '../lib/notifications';
import { GoogleIntegrationCard } from '../components/GoogleIntegrationCard';

const COLORS = ['#7c8cff', '#a78bfa', '#22c55e', '#f97316', '#ef4444', '#eab308'];

export function SettingsPage() {
  const { user, workspaceId } = useAuthStore();
  const calendars = useCalendars();
  const create = useCreateCalendar();
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(COLORS[0]!);

  const addCalendar = async () => {
    if (!newName.trim()) return;
    try {
      await create.mutateAsync({ name: newName.trim(), color: newColor });
      setNewName('');
      toast.success('Calendario creado.');
    } catch {
      toast.error('No se pudo crear el calendario.');
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold mb-1">Ajustes</h1>
        <p className="text-sm text-kibo-muted">Cuenta, calendarios y preferencias.</p>
      </div>

      <section className="card p-5">
        <h2 className="font-medium mb-3">Cuenta</h2>
        <dl className="text-sm space-y-1.5">
          <Row k="Email" v={user?.email ?? '—'} />
          <Row k="Nombre" v={user?.name ?? '—'} />
          <Row k="Workspace" v={workspaceId ?? '—'} mono />
          <Row k="API" v={API_URL} mono />
        </dl>
      </section>

      <section className="card p-5">
        <h2 className="font-medium mb-3">Calendarios</h2>
        <ul className="space-y-1.5 mb-4">
          {(calendars.data ?? []).map((c) => (
            <li key={c.id} className="flex items-center gap-2 text-sm">
              <span className="w-3 h-3 rounded-full" style={{ background: c.color }} />
              <span className="flex-1">{c.name}</span>
              {c.isDefault && (
                <span className="text-[10px] uppercase tracking-wide text-kibo-muted">Default</span>
              )}
            </li>
          ))}
          {(calendars.data ?? []).length === 0 && (
            <li className="text-xs text-kibo-muted">Aún no hay calendarios.</li>
          )}
        </ul>
        <div className="flex items-center gap-2 flex-wrap">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nombre del calendario"
            className="input h-8 text-sm min-w-0 flex-1"
          />
          <div className="flex items-center gap-1 flex-wrap">
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setNewColor(c)}
                className="w-6 h-6 rounded-full ring-2 ring-offset-1 ring-offset-kibo-surface"
                style={{
                  background: c,
                  boxShadow: newColor === c ? `0 0 0 2px ${c}` : 'none',
                }}
              />
            ))}
          </div>
          <button onClick={addCalendar} className="btn-primary h-8 text-xs px-3">
            Añadir
          </button>
        </div>
      </section>

      <section>
        <h2 className="font-medium mb-2 px-1 text-sm text-kibo-muted uppercase tracking-wide">Integraciones</h2>
        <GoogleIntegrationCard />
      </section>

      <NotificationsSection />
      <FocusSection />

      <WorkingHoursSection />
      <AppearanceSection />
    </div>
  );
}

function NotificationsSection() {
  const prefs = usePrefs();
  const [perm, setPerm] = useState<NotifPermission>(currentPermission());

  useEffect(() => {
    setPerm(currentPermission());
  }, []);

  const enable = async () => {
    const res = await requestPermission();
    setPerm(res);
    if (res === 'granted') {
      prefs.set({ notificationsEnabled: true });
      toast.success('Notificaciones activadas.');
    } else if (res === 'denied') {
      toast.error('Permiso denegado. Habilítalo en el navegador.');
    }
  };

  return (
    <section className="card p-5">
      <h2 className="font-medium mb-3 flex items-center gap-2">
        {prefs.notificationsEnabled ? <Bell size={16} /> : <BellOff size={16} />}
        Notificaciones
      </h2>
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={prefs.notificationsEnabled}
              onChange={(e) => {
                if (e.target.checked && perm !== 'granted') {
                  enable();
                } else {
                  prefs.set({ notificationsEnabled: e.target.checked });
                }
              }}
              className="accent-kibo-accent"
            />
            Activar recordatorios
          </label>
          {perm === 'denied' && (
            <span className="text-[11px] text-red-400">Permiso bloqueado en el navegador.</span>
          )}
          {perm === 'default' && prefs.notificationsEnabled && (
            <button
              type="button"
              onClick={enable}
              className="text-[11px] underline text-kibo-muted hover:text-kibo-text"
            >
              Pedir permiso
            </button>
          )}
        </div>

        <label className="flex flex-col gap-1 max-w-xs">
          <span className="text-[11px] uppercase tracking-wide text-kibo-muted">
            Aviso previo (min)
          </span>
          <input
            type="number"
            min={1}
            max={240}
            value={prefs.reminderLeadMinutes}
            onChange={(e) =>
              prefs.set({
                reminderLeadMinutes: Math.max(1, Math.min(240, Number(e.target.value) || 10)),
              })
            }
            className="input h-8 text-sm"
          />
        </label>

        <div className="flex flex-wrap gap-4 text-sm">
          <Toggle
            label="Eventos"
            checked={prefs.notifyEvents}
            onChange={(v) => prefs.set({ notifyEvents: v })}
          />
          <Toggle
            label="Tareas planificadas"
            checked={prefs.notifyTaskPlanned}
            onChange={(v) => prefs.set({ notifyTaskPlanned: v })}
          />
          <Toggle
            label="Vencimientos"
            checked={prefs.notifyTaskDue}
            onChange={(v) => prefs.set({ notifyTaskDue: v })}
          />
        </div>
      </div>
    </section>
  );
}

function FocusSection() {
  const pomodoro = usePrefs((s) => s.pomodoro);
  const customTimer = usePrefs((s) => s.customTimer);
  const setPomodoro = usePrefs((s) => s.setPomodoro);
  const setCustomTimer = usePrefs((s) => s.setCustomTimer);
  return (
    <section className="card p-5">
      <h2 className="font-medium mb-3">Concentración</h2>
      <p className="text-xs text-kibo-muted mb-3">
        Duraciones por defecto. Podés cambiarlas también antes de arrancar cada sesión.
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <NumField
          label="Pomodoro trabajo"
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
        <NumField
          label="Custom trabajo"
          value={customTimer.workMin}
          onChange={(v) => setCustomTimer({ workMin: v })}
        />
        <NumField
          label="Custom descanso"
          value={customTimer.breakMin}
          onChange={(v) => setCustomTimer({ breakMin: v })}
        />
      </div>
    </section>
  );
}

function WorkingHoursSection() {
  const wh = usePrefs((s) => s.workingHours);
  const setWorkingHours = usePrefs((s) => s.setWorkingHours);
  return (
    <section className="card p-5">
      <h2 className="font-medium mb-3">Horario laboral</h2>
      <p className="text-xs text-kibo-muted mb-4">
        Kibo usa este horario para calcular la carga diaria y detectar días sobrecargados.
      </p>
      <div className="grid grid-cols-2 gap-3 max-w-md">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-kibo-muted">Inicio</span>
          <input
            type="time"
            value={wh.start}
            onChange={(e) => setWorkingHours({ start: e.target.value })}
            className="input"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-kibo-muted">Fin</span>
          <input
            type="time"
            value={wh.end}
            onChange={(e) => setWorkingHours({ end: e.target.value })}
            className="input"
          />
        </label>
      </div>
      <div className="mt-4">
        <Toggle
          label="Contar fines de semana como días laborables"
          checked={wh.workOnWeekends}
          onChange={(v) => setWorkingHours({ workOnWeekends: v })}
        />
      </div>
    </section>
  );
}

function AppearanceSection() {
  const zoom = usePrefs((s) => s.zoom);
  const zoomIn = usePrefs((s) => s.zoomIn);
  const zoomOut = usePrefs((s) => s.zoomOut);
  const zoomReset = usePrefs((s) => s.zoomReset);
  const setZoom = usePrefs((s) => s.setZoom);
  const [draft, setDraft] = useState<number | null>(null);
  const displayed = draft ?? zoom;
  const pct = Math.round(displayed * 100);
  const commit = () => {
    if (draft != null) {
      setZoom(draft);
      setDraft(null);
    }
  };
  const canZoomIn = displayed < ZOOM_MAX - 1e-6;
  const canZoomOut = displayed > ZOOM_MIN + 1e-6;
  return (
    <section className="card p-5">
      <h2 className="font-medium mb-3">Apariencia</h2>
      <div className="space-y-4">
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm">Zoom de la interfaz</span>
            <span className="text-xs text-kibo-muted tabular-nums">{pct}%</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={zoomOut}
              disabled={!canZoomOut}
              className="h-8 w-8 rounded-md border border-kibo-border hover:bg-kibo-bg/40 disabled:opacity-40 flex items-center justify-center"
              aria-label="Reducir zoom"
              title="Ctrl -"
            >
              <Minus size={14} />
            </button>
            <input
              type="range"
              min={ZOOM_MIN}
              max={ZOOM_MAX}
              step={ZOOM_STEP}
              value={displayed}
              onChange={(e) => setDraft(Number(e.target.value))}
              onPointerUp={commit}
              onKeyUp={commit}
              onBlur={commit}
              className="flex-1 accent-kibo-accent"
            />
            <button
              type="button"
              onClick={zoomIn}
              disabled={!canZoomIn}
              className="h-8 w-8 rounded-md border border-kibo-border hover:bg-kibo-bg/40 disabled:opacity-40 flex items-center justify-center"
              aria-label="Aumentar zoom"
              title="Ctrl +"
            >
              <Plus size={14} />
            </button>
            <button
              type="button"
              onClick={zoomReset}
              className="h-8 px-2 rounded-md border border-kibo-border hover:bg-kibo-bg/40 flex items-center gap-1 text-xs"
              title="Ctrl 0"
            >
              <RotateCcw size={12} />
              Reset
            </button>
          </div>
          <p className="text-[11px] text-kibo-muted mt-2">
            Atajos: <kbd className="kbd">Ctrl</kbd>+<kbd className="kbd">+</kbd> aumentar,{' '}
            <kbd className="kbd">Ctrl</kbd>+<kbd className="kbd">-</kbd> reducir,{' '}
            <kbd className="kbd">Ctrl</kbd>+<kbd className="kbd">0</kbd> restablecer. También{' '}
            <kbd className="kbd">Ctrl</kbd>+rueda del ratón.
          </p>
        </div>
        <p className="text-sm text-kibo-muted">Tema oscuro por defecto. Tema claro llegará después.</p>
      </div>
    </section>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="inline-flex items-center gap-2">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="accent-kibo-accent"
      />
      {label}
    </label>
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

function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <dt className="w-32 text-kibo-muted">{k}</dt>
      <dd className={mono ? 'font-mono text-xs' : ''}>{v}</dd>
    </div>
  );
}
