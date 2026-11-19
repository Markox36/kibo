import { useEffect, useRef, useState } from 'react';
import { Upload, Link as LinkIcon, Globe, Loader2, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Modal } from './Modal';
import {
  useGoogleImportStatus,
  useImportIcsFile,
  useImportIcsUrl,
  useStartGoogleImport,
} from '../hooks/useCalendars';
import { usePublicFlags } from '../hooks/useFlags';
import { tauriApi } from '../lib/tauri-api';
import { integrationsApi } from '../lib/entities-api';

const OAUTH_TIMEOUT_MS = 5 * 60 * 1000;

type Tab = 'file' | 'url' | 'google';

const PALETTE = ['#7c8cff', '#f59e0b', '#10b981', '#ef4444', '#a78bfa', '#06b6d4', '#f472b6'];

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ImportCalendarModal({ open, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('file');
  const [name, setName] = useState('');
  const [color, setColor] = useState(PALETTE[0]!);
  const [url, setUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const importFile = useImportIcsFile();
  const importUrl = useImportIcsUrl();
  const startGoogle = useStartGoogleImport();
  const googleStatus = useGoogleImportStatus();
  const flags = usePublicFlags();
  const qc = useQueryClient();

  const [oauthPending, setOauthPending] = useState(false);
  const oauthStartLinkedAtRef = useRef<string | null>(null);

  const integrationStatus = useQuery({
    queryKey: ['integrations', 'google'],
    queryFn: integrationsApi.googleStatus,
    enabled: open,
    refetchInterval: oauthPending ? 2000 : false,
    refetchIntervalInBackground: true,
  });

  useEffect(() => {
    if (!open) {
      setName('');
      setUrl('');
      setFile(null);
      setTab('file');
      setDragOver(false);
      setOauthPending(false);
    }
  }, [open]);

  useEffect(() => {
    if (!oauthPending) return;
    const data = integrationStatus.data;
    if (!data || !data.connected || !data.linkedAt) return;
    if (data.linkedAt === oauthStartLinkedAtRef.current) return;
    setOauthPending(false);
    toast.success('Google Calendar importado.');
    qc.invalidateQueries({ queryKey: ['calendars'] });
    qc.invalidateQueries({ queryKey: ['events'] });
    qc.invalidateQueries({ queryKey: ['integrations', 'google'] });
    onClose();
  }, [integrationStatus.data, oauthPending, onClose, qc]);

  useEffect(() => {
    if (!oauthPending) return;
    const t = setTimeout(() => {
      setOauthPending(false);
      toast.error('Se agotó el tiempo esperando a Google (5 min). Volvé a intentarlo.');
    }, OAUTH_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [oauthPending]);

  const submitFile = async () => {
    if (!file) return;
    try {
      const res = await importFile.mutateAsync({
        file,
        name: name.trim() || undefined,
        color,
      });
      toast.success(`Calendario importado (${res.eventsInserted} eventos).`);
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown';
      toast.error(`No se pudo importar: ${msg}`);
    }
  };

  const submitUrl = async () => {
    const u = url.trim();
    if (!u) return;
    try {
      const res = await importUrl.mutateAsync({
        url: u,
        name: name.trim() || undefined,
        color,
      });
      toast.success(`Calendario importado (${res.eventsInserted} eventos).`);
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown';
      toast.error(`No se pudo importar: ${msg}`);
    }
  };

  const submitGoogle = async () => {
    try {
      const snapshot = await integrationsApi.googleStatus();
      oauthStartLinkedAtRef.current = snapshot.linkedAt;
      const { authUrl } = await startGoogle.mutateAsync({
        name: name.trim() || undefined,
        color,
      });
      setOauthPending(true);
      await tauriApi.openExternalUrl(authUrl);
      toast.info('Completa el acceso en tu navegador. Kibo detectará automáticamente cuando termine.');
    } catch (err) {
      setOauthPending(false);
      const msg = err instanceof Error ? err.message : 'unknown';
      toast.error(`No se pudo iniciar OAuth: ${msg}`);
    }
  };

  const busy = importFile.isPending || importUrl.isPending || startGoogle.isPending || oauthPending;
  const googleReady = (googleStatus.data?.configured ?? false) && (flags.data?.googleCalendarEnabled ?? true);
  const fileEnabled = flags.data?.icsFileImportEnabled ?? true;
  const urlEnabled = flags.data?.icsUrlImportEnabled ?? true;
  const googleEnabled = flags.data?.googleCalendarEnabled ?? true;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Importar calendario"
      description="Añade eventos externos como nuevo calendario. Solo lectura."
      size="lg"
      footer={
        <>
          <button
            className="btn-outline h-8 text-xs px-3"
            onClick={onClose}
            disabled={importFile.isPending || importUrl.isPending || startGoogle.isPending}
          >
            Cancelar
          </button>
          {tab === 'file' && (
            <button
              className="btn-primary h-8 text-xs px-3"
              onClick={submitFile}
              disabled={!file || busy}
            >
              {importFile.isPending && <Loader2 size={13} className="animate-spin" />} Importar
            </button>
          )}
          {tab === 'url' && (
            <button
              className="btn-primary h-8 text-xs px-3"
              onClick={submitUrl}
              disabled={!url.trim() || busy}
            >
              {importUrl.isPending && <Loader2 size={13} className="animate-spin" />} Suscribirse
            </button>
          )}
          {tab === 'google' && (
            <button
              className="btn-primary h-8 text-xs px-3"
              onClick={submitGoogle}
              disabled={!googleReady || busy}
            >
              {(startGoogle.isPending || oauthPending) && (
                <Loader2 size={13} className="animate-spin" />
              )}
              {oauthPending ? 'Esperando a Google…' : 'Conectar Google'}
            </button>
          )}
        </>
      }
    >
      <div className="flex items-center gap-1 mb-4 p-0.5 rounded-lg border border-kibo-border bg-kibo-bg/40 w-fit">
        <TabButton
          active={tab === 'file'}
          onClick={() => setTab('file')}
          icon={<Upload size={13} />}
          disabled={!fileEnabled}
        >
          Archivo .ics
        </TabButton>
        <TabButton
          active={tab === 'url'}
          onClick={() => setTab('url')}
          icon={<LinkIcon size={13} />}
          disabled={!urlEnabled}
        >
          URL suscripción
        </TabButton>
        <TabButton
          active={tab === 'google'}
          onClick={() => setTab('google')}
          icon={<Globe size={13} />}
          disabled={!googleEnabled}
        >
          Google
        </TabButton>
      </div>

      {tab === 'file' && !fileEnabled && <FeatureDisabled />}
      {tab === 'url' && !urlEnabled && <FeatureDisabled />}
      {tab === 'google' && !googleEnabled && <FeatureDisabled />}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-wide text-kibo-muted">Nombre (opcional)</span>
          <input
            className="input"
            placeholder="ej. Trabajo, Facultad…"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <div className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-wide text-kibo-muted">Color</span>
          <div className="flex items-center gap-2 h-9">
            {PALETTE.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={
                  'w-6 h-6 rounded-full border-2 transition-transform ' +
                  (color === c ? 'scale-110' : 'border-transparent hover:scale-105')
                }
                style={{
                  background: c,
                  borderColor: color === c ? 'rgba(255,255,255,0.4)' : 'transparent',
                }}
                aria-label={c}
              />
            ))}
          </div>
        </div>
      </div>

      {tab === 'file' && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const f = e.dataTransfer.files?.[0];
            if (f) setFile(f);
          }}
          className={
            'rounded-xl border-2 border-dashed p-6 flex flex-col items-center justify-center gap-2 text-center cursor-pointer transition-colors ' +
            (dragOver
              ? 'border-kibo-accent bg-kibo-accent/5'
              : 'border-kibo-border hover:border-kibo-muted')
          }
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".ics,text/calendar"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) setFile(f);
            }}
          />
          {file ? (
            <>
              <FileText size={26} className="text-kibo-accent" />
              <div className="text-sm font-medium">{file.name}</div>
              <div className="text-[11px] text-kibo-muted">{(file.size / 1024).toFixed(1)} KB</div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setFile(null);
                }}
                className="text-[11px] text-kibo-muted hover:text-kibo-text underline mt-1"
              >
                Cambiar archivo
              </button>
            </>
          ) : (
            <>
              <Upload size={26} className="text-kibo-muted" />
              <div className="text-sm">Arrastra un archivo .ics o toca para elegir</div>
              <div className="text-[11px] text-kibo-muted">Máx. 5 MB · una vez importado, no se sincroniza</div>
            </>
          )}
        </div>
      )}

      {tab === 'url' && (
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] uppercase tracking-wide text-kibo-muted">
              URL del calendario (.ics)
            </span>
            <input
              className="input"
              placeholder="https://.../calendar.ics"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              type="url"
            />
          </label>
          <p className="text-[11px] text-kibo-muted leading-relaxed">
            La URL se guarda y se puede refrescar. Google Calendar → Configuración → Integrar calendario →
            <em> Dirección secreta en formato iCal</em>. Outlook: exporta / publica calendario.
          </p>
        </div>
      )}

      {tab === 'google' && (
        <div className="flex flex-col gap-3">
          {googleReady ? (
            <>
              <p className="text-sm text-kibo-text">
                Se abrirá una ventana de Google para autorizar acceso de solo lectura a tu Google Calendar.
                Los eventos se importarán a un calendario nuevo.
              </p>
              <ul className="text-[12px] text-kibo-muted space-y-1 list-disc pl-4">
                <li>Requiere permiso <code>calendar.readonly</code>.</li>
                <li>Rango: últimos 12 meses y próximos 24 meses.</li>
                <li>No se guardan tokens; el import es una foto puntual.</li>
              </ul>
            </>
          ) : (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-[12px] text-amber-200">
              Google OAuth no está configurado en el servidor. Faltan variables{' '}
              <code>GOOGLE_CLIENT_ID</code>, <code>GOOGLE_CLIENT_SECRET</code>,{' '}
              <code>GOOGLE_OAUTH_REDIRECT_URI</code>. Alternativa: importar la dirección secreta{' '}
              <em>iCal</em> desde la pestaña <strong>URL suscripción</strong>.
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

function TabButton({
  active,
  onClick,
  children,
  icon,
  disabled,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  icon: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={
        'inline-flex items-center gap-1.5 px-3 h-7 rounded-md text-xs transition-colors ' +
        (active
          ? 'bg-kibo-surface text-kibo-text border border-kibo-border'
          : 'text-kibo-muted hover:text-kibo-text') +
        (disabled ? ' opacity-40 line-through cursor-not-allowed' : '')
      }
      title={disabled ? 'Deshabilitado por el administrador' : undefined}
    >
      {icon}
      {children}
    </button>
  );
}

function FeatureDisabled() {
  return (
    <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-[12px] text-amber-200">
      Función deshabilitada por el administrador.
    </div>
  );
}
