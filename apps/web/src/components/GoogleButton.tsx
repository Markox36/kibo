import { useEffect, useRef, useState } from 'react';
import { GOOGLE_CLIENT_ID } from '../lib/env';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (r: { credential: string }) => void;
            auto_select?: boolean;
            ux_mode?: 'popup' | 'redirect';
          }) => void;
          renderButton: (el: HTMLElement, opts: Record<string, unknown>) => void;
          prompt: () => void;
        };
      };
    };
  }
}

let scriptPromise: Promise<void> | null = null;

function loadGis(): Promise<void> {
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) {
      resolve();
      return;
    }
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Failed to load Google Identity Services'));
    document.head.appendChild(s);
  });
  return scriptPromise;
}

interface Props {
  onCredential: (idToken: string) => void | Promise<void>;
  text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
}

const MIN_WIDTH = 240;
const MAX_WIDTH = 400;

export function GoogleButton({ onCredential, text = 'continue_with' }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [width, setWidth] = useState(320);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    let cancelled = false;
    loadGis()
      .then(() => {
        if (cancelled || !window.google) return;
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: (r) => void onCredential(r.credential),
          ux_mode: 'popup',
        });
        setReady(true);
      })
      .catch((e) => console.error(e));
    return () => {
      cancelled = true;
    };
  }, [onCredential]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const w = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, Math.floor(el.clientWidth)));
      setWidth(w);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!ready || !btnRef.current || !window.google) return;
    btnRef.current.innerHTML = '';
    window.google.accounts.id.renderButton(btnRef.current, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      text,
      shape: 'pill',
      logo_alignment: 'left',
      width,
    });
  }, [ready, width, text]);

  if (!GOOGLE_CLIENT_ID) {
    return (
      <div className="rounded-md border border-dashed border-kibo-border bg-kibo-bg/40 px-3 py-2 text-center text-[11px] text-kibo-muted">
        Configura <code className="font-mono text-kibo-text/80">VITE_GOOGLE_CLIENT_ID</code> para habilitar Google.
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full">
      <div ref={btnRef} className="flex justify-center [color-scheme:light]" />
    </div>
  );
}
