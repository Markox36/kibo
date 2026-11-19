import { useState } from 'react';
import { GOOGLE_DESKTOP_CLIENT_ID, GOOGLE_DESKTOP_CLIENT_SECRET } from '../lib/env';
import { tauriApi } from '../lib/tauri-api';

interface Props {
  onCredential: (idToken: string) => void | Promise<void>;
  text?: 'signin_with' | 'signup_with' | 'continue_with';
}

const LABELS: Record<NonNullable<Props['text']>, string> = {
  signin_with: 'Entrar con Google',
  signup_with: 'Registrarse con Google',
  continue_with: 'Continuar con Google',
};

export function GoogleButton({ onCredential, text = 'continue_with' }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!GOOGLE_DESKTOP_CLIENT_ID) {
    return (
      <div className="rounded-md border border-dashed border-kibo-border bg-kibo-bg/40 px-3 py-2 text-center text-[11px] text-kibo-muted">
        Configura <code className="font-mono text-kibo-text/80">VITE_GOOGLE_DESKTOP_CLIENT_ID</code> para habilitar Google.
      </div>
    );
  }

  const onClick = async () => {
    setError(null);
    setLoading(true);
    try {
      const idToken = await tauriApi.googleOauthLogin(
        GOOGLE_DESKTOP_CLIENT_ID,
        GOOGLE_DESKTOP_CLIENT_SECRET || undefined,
      );
      await onCredential(idToken);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('oauth_error')) setError('Login cancelado.');
      else setError('No se pudo entrar con Google.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={onClick}
        disabled={loading}
        className="w-full h-10 rounded-full border border-kibo-border bg-white text-black text-sm font-medium flex items-center justify-center gap-2 hover:bg-kibo-bg/10 disabled:opacity-50 [color-scheme:light]"
      >
        <GoogleLogo />
        <span>{loading ? 'Abriendo navegador…' : LABELS[text]}</span>
      </button>
      {error && (
        <div className="mt-2 text-center text-[11px] text-red-400">{error}</div>
      )}
    </div>
  );
}

function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
      <path fill="none" d="M0 0h48v48H0z"/>
    </svg>
  );
}
