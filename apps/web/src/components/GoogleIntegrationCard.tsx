import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, RefreshCw, Unplug, Loader2, LogIn, AlertTriangle, ShieldCheck, X } from 'lucide-react';
import {
  useDisconnectGoogle,
  useGoogleIntegration,
  useStartGoogleIntegration,
  useSyncGoogleIntegration,
} from '../hooks/useIntegrations';
import { usePublicFlags } from '../hooks/useFlags';
import { ApiError } from '../lib/api';

interface Props {
  compact?: boolean;
}

export function GoogleIntegrationCard({ compact }: Props) {
  const status = useGoogleIntegration();
  const start = useStartGoogleIntegration();
  const sync = useSyncGoogleIntegration();
  const disconnect = useDisconnectGoogle();
  const qc = useQueryClient();
  const flags = usePublicFlags();
  const [disclosureOpen, setDisclosureOpen] = useState(false);

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (!e.data || e.data.type !== 'kibo-google-integration') return;
      const p = e.data.payload as { ok: boolean; error?: string; email?: string; eventsInserted?: number };
      if (p.ok) {
        toast.success(
          `Google Calendar vinculado${p.email ? ` (${p.email})` : ''}. ${p.eventsInserted ?? 0} eventos importados.`,
        );
        qc.invalidateQueries({ queryKey: ['integrations', 'google'] });
        qc.invalidateQueries({ queryKey: ['events'] });
        qc.invalidateQueries({ queryKey: ['calendars'] });
      } else {
        toast.error(`No se pudo vincular: ${p.error ?? 'desconocido'}`);
      }
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [qc]);

  const openDisclosure = () => setDisclosureOpen(true);

  const proceedWithGoogle = async () => {
    setDisclosureOpen(false);
    try {
      const { authUrl } = await start.mutateAsync({});
      const w = 480;
      const h = 640;
      const y = window.top!.outerHeight / 2 + window.top!.screenY - h / 2;
      const x = window.top!.outerWidth / 2 + window.top!.screenX - w / 2;
      window.open(
        authUrl,
        'kibo-google-oauth',
        `popup=yes,width=${w},height=${h},left=${x},top=${y}`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown';
      toast.error(`No se pudo iniciar: ${msg}`);
    }
  };

  const doSync = async () => {
    try {
      const res = await sync.mutateAsync();
      toast.success(
        `Sincronizado: ${res.eventsInserted} nuevos · ${res.eventsUpdated} actualizados · ${res.eventsDeleted} borrados.`,
      );
    } catch (err) {
      if (err instanceof ApiError && err.code === 'reauth_required') {
        // Refetch status so the card switches to the re-link state.
        qc.invalidateQueries({ queryKey: ['integrations', 'google'] });
        toast.error('La conexión con Google caducó. Volvé a conectar tu cuenta.');
        return;
      }
      toast.error('No se pudo sincronizar.');
    }
  };

  const doDisconnect = async () => {
    if (!confirm('¿Desvincular Google Calendar? El calendario ya importado se mantiene, pero dejará de sincronizarse.')) {
      return;
    }
    try {
      await disconnect.mutateAsync();
      toast.success('Google Calendar desvinculado.');
    } catch {
      toast.error('No se pudo desvincular.');
    }
  };

  if (status.isLoading) {
    return (
      <div className={compact ? '' : 'card p-5'}>
        <p className="text-xs text-kibo-muted flex items-center gap-2">
          <Loader2 size={12} className="animate-spin" /> Comprobando…
        </p>
      </div>
    );
  }

  const data = status.data;

  const flagDisabled = flags.data?.googleCalendarEnabled === false;

  if (flagDisabled) {
    return (
      <div className={compact ? '' : 'card p-5'}>
        <div className="flex items-start gap-2 text-[12px] text-amber-200 bg-amber-500/5 border border-amber-500/30 rounded-lg p-3">
          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
          <div>
            <div className="font-medium">Integración con Google deshabilitada.</div>
            <div className="text-kibo-muted mt-1">
              El administrador desactivó temporalmente esta función (p. ej. mientras Google verifica
              la app). Volverá pronto.
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!data?.configured) {
    return (
      <div className={compact ? '' : 'card p-5'}>
        <div className="flex items-start gap-2 text-[12px] text-amber-200 bg-amber-500/5 border border-amber-500/30 rounded-lg p-3">
          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
          <div>
            <div className="font-medium">Google no configurado en el servidor.</div>
            <div className="text-kibo-muted mt-1">
              Faltan variables <code>GOOGLE_CLIENT_ID</code>, <code>GOOGLE_CLIENT_SECRET</code>,{' '}
              <code>GOOGLE_OAUTH_REDIRECT_URI</code>, <code>INTEGRATIONS_KEY</code>.
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={compact ? '' : 'card p-5'}>
      {!compact && (
        <h2 className="font-medium mb-3 flex items-center gap-2">
          <GoogleLogo /> Google Calendar
        </h2>
      )}

      {data.connected ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle2 size={14} className="text-emerald-400" />
            <span>Vinculado{data.email ? ` como ` : '.'}</span>
            {data.email && <span className="font-medium">{data.email}</span>}
          </div>
          {data.needsReauth ? (
            <div className="flex items-start gap-2 text-[12px] text-amber-200 bg-amber-500/5 border border-amber-500/30 rounded-lg p-3">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              <div>
                La conexión con Google caducó (token de acceso revocado o expirado). Volvé a
                conectar tu cuenta para seguir sincronizando; se reutilizará el calendario ya
                importado.
              </div>
            </div>
          ) : (
            <p className="text-[11px] text-kibo-muted">
              Los tokens se guardan cifrados (AES-256-GCM). Podés sincronizar bajo demanda; el
              refresh token permite actualizar sin volver a autorizar.
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            {data.needsReauth ? (
              <button
                onClick={openDisclosure}
                disabled={start.isPending}
                className="btn-primary h-8 text-xs px-3"
              >
                {start.isPending ? <Loader2 size={12} className="animate-spin" /> : <LogIn size={12} />}
                Volver a conectar
              </button>
            ) : (
              <button onClick={doSync} disabled={sync.isPending} className="btn-primary h-8 text-xs px-3">
                {sync.isPending ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                Sincronizar ahora
              </button>
            )}
            <button
              onClick={doDisconnect}
              disabled={disconnect.isPending}
              className="btn-outline h-8 text-xs px-3"
            >
              {disconnect.isPending ? <Loader2 size={12} className="animate-spin" /> : <Unplug size={12} />}
              Desvincular
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-sm">
            Vinculá tu cuenta de Google para importar y sincronizar tu Google Calendar.
          </p>
          <ul className="text-[12px] text-kibo-muted space-y-1 list-disc pl-4">
            <li>Solo lectura (<code>calendar.readonly</code>) + tu email para identificarte.</li>
            <li>Refresh token guardado cifrado para sincronizar sin volver a pedir permiso.</li>
            <li>Se creará un calendario nuevo con tus eventos.</li>
          </ul>
          <button onClick={openDisclosure} disabled={start.isPending} className="btn-primary h-9 text-sm px-4 w-fit">
            {start.isPending ? <Loader2 size={14} className="animate-spin" /> : <LogIn size={14} />}
            Conectar con Google
          </button>
        </div>
      )}

      {disclosureOpen && (
        <LimitedUseDisclosure
          onCancel={() => setDisclosureOpen(false)}
          onAccept={proceedWithGoogle}
          pending={start.isPending}
        />
      )}
    </div>
  );
}

function LimitedUseDisclosure({
  onCancel,
  onAccept,
  pending,
}: {
  onCancel: () => void;
  onAccept: () => void;
  pending: boolean;
}) {
  const [agreed, setAgreed] = useState(false);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative w-full max-w-lg rounded-xl border border-kibo-border bg-kibo-surface shadow-soft">
        <button
          type="button"
          onClick={onCancel}
          className="absolute right-3 top-3 text-kibo-muted hover:text-kibo-text"
          aria-label="Cerrar"
        >
          <X size={16} />
        </button>
        <div className="p-6">
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheck size={18} className="text-emerald-400" />
            <h3 className="font-semibold">Antes de conectar Google Calendar</h3>
          </div>
          <p className="text-sm text-kibo-muted mb-3">
            Kibo pedirá tu autorización a Google para acceder a los siguientes datos:
          </p>
          <ul className="text-sm space-y-1.5 mb-4 list-disc pl-5">
            <li>Tu email y perfil básico (<code>openid email profile</code>) — para identificarte.</li>
            <li>
              Lectura de tus eventos de Google Calendar (
              <code>calendar.readonly</code>) — para importarlos y sincronizarlos dentro de Kibo.
            </li>
          </ul>
          <div className="rounded-lg border border-kibo-border bg-kibo-bg/50 p-3 text-[12px] text-kibo-muted space-y-2 mb-4">
            <p>
              <strong className="text-kibo-text">Uso limitado.</strong> El uso que Kibo hace de la
              información recibida de las Google APIs cumple la{' '}
              <a
                href="https://developers.google.com/terms/api-services-user-data-policy"
                target="_blank"
                rel="noreferrer"
                className="text-kibo-accent hover:underline"
              >
                Google API Services User Data Policy
              </a>
              , incluyendo los requisitos de <em>Limited Use</em>.
            </p>
            <p>
              No vendemos tus datos, no los usamos para anuncios, no los leemos humanamente salvo
              con tu permiso explícito o por seguridad, y no los cedemos a terceros salvo lo
              indispensable para prestar el servicio.
            </p>
            <p>
              Podés revocar el acceso en cualquier momento desde este mismo panel o desde{' '}
              <a
                href="https://myaccount.google.com/permissions"
                target="_blank"
                rel="noreferrer"
                className="text-kibo-accent hover:underline"
              >
                myaccount.google.com/permissions
              </a>
              .
            </p>
            <p>
              Más detalle en la{' '}
              <a href="/privacy.html" target="_blank" rel="noreferrer" className="text-kibo-accent hover:underline">
                Política de Privacidad
              </a>{' '}
              y las{' '}
              <a href="/terms.html" target="_blank" rel="noreferrer" className="text-kibo-accent hover:underline">
                Condiciones del Servicio
              </a>
              .
            </p>
          </div>
          <label className="flex items-start gap-2 text-sm cursor-pointer mb-4">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5 accent-kibo-accent"
            />
            <span>
              He leído y acepto la Política de Privacidad y las Condiciones. Entiendo cómo Kibo
              usará mis datos de Google Calendar.
            </span>
          </label>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="h-9 px-4 rounded-md border border-kibo-border hover:bg-kibo-bg/40 text-sm"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={onAccept}
              disabled={!agreed || pending}
              className="btn-primary h-9 text-sm px-4 disabled:opacity-40"
            >
              {pending && <Loader2 size={14} className="animate-spin" />}
              Continuar a Google
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function GoogleLogo() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#EA4335"
        d="M24 9.5c3.5 0 6.6 1.2 9 3.4l6.7-6.7C35.6 2.5 30.1 0 24 0 14.7 0 6.7 5.4 2.9 13.2l7.9 6.1C12.7 13.2 17.9 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4 6.9-10 6.9-17.5z"
      />
      <path
        fill="#FBBC05"
        d="M10.8 28.7A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.7l-7.9-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.4 10.8l8.4-6.1z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.5 0 12-2.1 16-5.8l-7.5-5.8c-2.1 1.4-4.8 2.2-8.5 2.2-6.1 0-11.3-4.1-13.2-9.7l-8.4 6.1C6.6 42.6 14.6 48 24 48z"
      />
    </svg>
  );
}
