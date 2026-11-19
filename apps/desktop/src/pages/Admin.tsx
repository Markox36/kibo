import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Shield, RotateCcw, Loader2, AlertTriangle, Wrench } from 'lucide-react';
import { adminApi, type FeatureFlags } from '../lib/entities-api';
import { useNavigate } from '@tanstack/react-router';

const FLAG_META: Array<{
  key: keyof FeatureFlags;
  label: string;
  desc: string;
  group: 'features' | 'system';
}> = [
  {
    key: 'googleCalendarEnabled',
    label: 'Google Calendar',
    desc: 'Vinculación OAuth + sync.',
    group: 'features',
  },
  {
    key: 'icsFileImportEnabled',
    label: 'Importar .ics (archivo)',
    desc: 'Upload de calendarios locales.',
    group: 'features',
  },
  {
    key: 'icsUrlImportEnabled',
    label: 'Importar .ics (URL)',
    desc: 'Suscripción a feeds remotos.',
    group: 'features',
  },
  {
    key: 'bulkDeleteEnabled',
    label: 'Limpieza en bloque',
    desc: 'Eliminar eventos por filtro/regex.',
    group: 'features',
  },
  {
    key: 'notificationsEnabled',
    label: 'Notificaciones',
    desc: 'Recordatorios de eventos y tareas.',
    group: 'features',
  },
  {
    key: 'focusEnabled',
    label: 'Concentración',
    desc: 'Pomodoro y timer custom.',
    group: 'features',
  },
  { key: 'lofiEnabled', label: 'LoFi Radio', desc: 'Player integrado.', group: 'features' },
  {
    key: 'registrationEnabled',
    label: 'Registro público',
    desc: 'Permite nuevos usuarios.',
    group: 'system',
  },
  {
    key: 'readOnly',
    label: 'Modo solo lectura',
    desc: 'Bloquea escrituras no admin (bulk delete, etc).',
    group: 'system',
  },
  {
    key: 'maintenanceMode',
    label: 'Modo mantenimiento',
    desc: 'No-admin ve pantalla de mantenimiento y bloquea acciones.',
    group: 'system',
  },
];

export function AdminPage() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const me = useQuery({ queryKey: ['admin', 'me'], queryFn: adminApi.me, retry: false });
  const flagsQ = useQuery({ queryKey: ['admin', 'flags'], queryFn: adminApi.getFlags });
  const stats = useQuery({ queryKey: ['admin', 'stats'], queryFn: adminApi.stats });
  const [maintMsg, setMaintMsg] = useState('');

  useEffect(() => {
    if (me.isError) {
      toast.error('Acceso denegado.');
      nav({ to: '/' });
    }
  }, [me.isError, nav]);

  useEffect(() => {
    if (flagsQ.data?.flags.maintenanceMessage != null) {
      setMaintMsg(flagsQ.data.flags.maintenanceMessage);
    }
  }, [flagsQ.data?.flags.maintenanceMessage]);

  const patch = useMutation({
    mutationFn: (p: Partial<FeatureFlags>) => adminApi.patchFlags(p),
    onSuccess: (res) => {
      qc.setQueryData(['admin', 'flags'], (prev: { flags: FeatureFlags; defaults: FeatureFlags } | undefined) =>
        prev ? { ...prev, flags: res.flags } : prev,
      );
      qc.invalidateQueries({ queryKey: ['flags', 'public'] });
      toast.success('Flags actualizadas.');
    },
    onError: () => toast.error('No se pudo actualizar.'),
  });

  const reset = useMutation({
    mutationFn: () => adminApi.resetFlags(),
    onSuccess: (res) => {
      qc.setQueryData(['admin', 'flags'], (prev: { flags: FeatureFlags; defaults: FeatureFlags } | undefined) =>
        prev ? { ...prev, flags: res.flags } : prev,
      );
      qc.invalidateQueries({ queryKey: ['flags', 'public'] });
      toast.success('Flags reseteadas a valores por defecto.');
    },
  });

  if (me.isLoading || flagsQ.isLoading) {
    return (
      <p className="text-sm text-kibo-muted flex items-center gap-2">
        <Loader2 size={14} className="animate-spin" /> Cargando panel admin…
      </p>
    );
  }

  const flags = flagsQ.data?.flags;
  if (!flags) return null;

  const toggle = (key: keyof FeatureFlags) => {
    const val = flags[key];
    if (typeof val !== 'boolean') return;
    patch.mutate({ [key]: !val } as Partial<FeatureFlags>);
  };

  const grouped = {
    features: FLAG_META.filter((f) => f.group === 'features'),
    system: FLAG_META.filter((f) => f.group === 'system'),
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold mb-1 flex items-center gap-2">
          <Shield size={18} className="text-kibo-accent" /> Panel admin
        </h1>
        <p className="text-sm text-kibo-muted">
          Conectado como <span className="font-mono">{me.data?.email}</span>. Cambios aplican al
          instante para todos los usuarios (cache 10s).
        </p>
      </div>

      {stats.data && (
        <section className="card p-5 grid grid-cols-2 sm:grid-cols-5 gap-3">
          <Stat label="Usuarios" value={stats.data.users} />
          <Stat label="Eventos" value={stats.data.events} />
          <Stat label="Tareas" value={stats.data.tasks} />
          <Stat label="Calendarios" value={stats.data.calendars} />
          <Stat label="Integraciones" value={stats.data.integrations} />
        </section>
      )}

      <section className="card p-5">
        <h2 className="font-medium mb-3">Features</h2>
        <div className="divide-y divide-kibo-border/60">
          {grouped.features.map((f) => (
            <FlagRow
              key={f.key}
              label={f.label}
              desc={f.desc}
              enabled={Boolean(flags[f.key])}
              onToggle={() => toggle(f.key)}
              pending={patch.isPending}
            />
          ))}
        </div>
      </section>

      <section className="card p-5">
        <h2 className="font-medium mb-3 flex items-center gap-2">
          <Wrench size={14} /> Sistema
        </h2>
        <div className="divide-y divide-kibo-border/60">
          {grouped.system.map((f) => (
            <FlagRow
              key={f.key}
              label={f.label}
              desc={f.desc}
              enabled={Boolean(flags[f.key])}
              onToggle={() => toggle(f.key)}
              pending={patch.isPending}
              danger={f.key === 'maintenanceMode' || f.key === 'readOnly'}
            />
          ))}
        </div>

        {flags.maintenanceMode && (
          <div className="mt-4 flex flex-col gap-2 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3">
            <div className="flex items-center gap-2 text-sm text-amber-200">
              <AlertTriangle size={14} /> Modo mantenimiento ACTIVO.
            </div>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] uppercase tracking-wide text-kibo-muted">
                Mensaje personalizado (opcional)
              </span>
              <textarea
                value={maintMsg}
                onChange={(e) => setMaintMsg(e.target.value)}
                onBlur={() => patch.mutate({ maintenanceMessage: maintMsg || null })}
                rows={2}
                className="input h-auto py-2 text-sm"
                placeholder="Volvemos en 20 minutos, gracias por la paciencia."
              />
            </label>
          </div>
        )}
      </section>

      <div className="flex justify-end">
        <button
          onClick={() => reset.mutate()}
          disabled={reset.isPending}
          className="btn-outline h-8 text-xs px-3"
        >
          {reset.isPending ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
          Resetear todo a defaults
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-kibo-border bg-kibo-bg/40 p-3">
      <div className="text-[10px] uppercase tracking-wide text-kibo-muted">{label}</div>
      <div className="text-xl font-semibold font-mono">{value}</div>
    </div>
  );
}

function FlagRow({
  label,
  desc,
  enabled,
  onToggle,
  pending,
  danger,
}: {
  label: string;
  desc: string;
  enabled: boolean;
  onToggle: () => void;
  pending: boolean;
  danger?: boolean;
}) {
  return (
    <div className="py-3 flex items-center gap-4">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium">{label}</div>
        <div className="text-[11px] text-kibo-muted">{desc}</div>
      </div>
      <button
        onClick={onToggle}
        disabled={pending}
        aria-pressed={enabled}
        className={
          'relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ' +
          (enabled
            ? danger
              ? 'bg-amber-500'
              : 'bg-kibo-accent'
            : 'bg-kibo-border')
        }
      >
        <span
          className={
            'inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ' +
            (enabled ? 'translate-x-5' : 'translate-x-0.5')
          }
        />
      </button>
    </div>
  );
}
