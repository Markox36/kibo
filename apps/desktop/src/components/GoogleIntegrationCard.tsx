import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, RefreshCw, Unplug, Loader2, LogIn, AlertTriangle } from 'lucide-react';
import {
  useDisconnectGoogle,
  useGoogleIntegration,
  useStartGoogleIntegration,
  useSyncGoogleIntegration,
} from '../hooks/useIntegrations';
import { usePublicFlags } from '../hooks/useFlags';
import { integrationsApi } from '../lib/entities-api';
import { tauriApi } from '../lib/tauri-api';
import { ApiError } from '../lib/api';

const OAUTH_TIMEOUT_MS = 5 * 60 * 1000;

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

  const [oauthPending, setOauthPending] = useState(false);
  const oauthStartLinkedAtRef = useRef<string | null>(null);

  const pollStatus = useQuery({
    queryKey: ['integrations', 'google', 'poll'],
    queryFn: integrationsApi.googleStatus,
    enabled: oauthPending,
    refetchInterval: oauthPending ? 2000 : false,
    refetchIntervalInBackground: true,
  });

  useEffect(() => {
    if (!oauthPending) return;
    const data = pollStatus.data;
    if (!data || !data.connected || !data.linkedAt) return;
    if (data.linkedAt === oauthStartLinkedAtRef.current) return;
    setOauthPending(false);
    toast.success(
      `Google Calendar vinculado${data.email ? ` (${data.email})` : ''}.`,
    );
    qc.invalidateQueries({ queryKey: ['integrations', 'google'] });
    qc.invalidateQueries({ queryKey: ['events'] });
    qc.invalidateQueries({ queryKey: ['calendars'] });
  }, [pollStatus.data, oauthPending, qc]);

  useEffect(() => {
    if (!oauthPending) return;
    const t = setTimeout(() => {
      setOauthPending(false);
      toast.error('Se agotó el tiempo esperando a Google (5 min).');
    }, OAUTH_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [oauthPending]);

  const connect = async () => {
    try {
      const snapshot = await integrationsApi.googleStatus();
      oauthStartLinkedAtRef.current = snapshot.linkedAt;
      const { authUrl } = await start.mutateAsync({});
      setOauthPending(true);
      await tauriApi.openExternalUrl(authUrl);
      toast.info('Completa el acceso en tu navegador. Kibo detectará automáticamente cuando termine.');
    } catch (err) {
      setOauthPending(false);
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
                onClick={connect}
                disabled={start.isPending || oauthPending}
                className="btn-primary h-8 text-xs px-3"
              >
                {start.isPending || oauthPending ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <LogIn size={12} />
                )}
                {oauthPending ? 'Esperando a Google…' : 'Volver a conectar'}
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
          <button
            onClick={connect}
            disabled={start.isPending || oauthPending}
            className="btn-primary h-9 text-sm px-4 w-fit"
          >
            {start.isPending || oauthPending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <LogIn size={14} />
            )}
            {oauthPending ? 'Esperando a Google…' : 'Conectar con Google'}
          </button>
        </div>
      )}
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
