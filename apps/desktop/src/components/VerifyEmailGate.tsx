import { useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { MailCheck, RefreshCw, LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '../store/auth';
import { authApi } from '../lib/auth-api';
import { ApiError } from '../lib/api';
import { Logo } from './Logo';

interface Props {
  children: React.ReactNode;
}

export function VerifyEmailGate({ children }: Props) {
  const { user, refreshToken, setSession, clear } = useAuthStore();
  const nav = useNavigate();
  const [resending, setResending] = useState(false);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!user || user.emailVerifiedAt) return;
    let cancelled = false;
    const check = async () => {
      try {
        const me = await authApi.me();
        if (cancelled) return;
        if (me.emailVerifiedAt) {
          setSession({
            accessToken: useAuthStore.getState().accessToken!,
            refreshToken: useAuthStore.getState().refreshToken!,
            workspaceId: me.workspaceId,
            user: {
              id: me.id,
              email: me.email,
              name: me.name,
              emailVerifiedAt: me.emailVerifiedAt,
            },
          });
        }
      } catch {
        // ignore poll errors
      }
    };
    const onFocus = () => void check();
    window.addEventListener('focus', onFocus);
    const t = setInterval(check, 15_000);
    return () => {
      cancelled = true;
      clearInterval(t);
      window.removeEventListener('focus', onFocus);
    };
  }, [user, setSession]);

  if (!user || user.emailVerifiedAt) return <>{children}</>;

  const resend = async () => {
    setResending(true);
    try {
      await authApi.resendVerification(user.email);
      toast.success('Email de verificación reenviado.');
    } catch (err) {
      if (err instanceof ApiError) toast.error(`No se pudo reenviar (${err.code}).`);
      else toast.error('No se pudo reenviar.');
    } finally {
      setResending(false);
    }
  };

  const check = async () => {
    setChecking(true);
    try {
      const me = await authApi.me();
      if (me.emailVerifiedAt) {
        setSession({
          accessToken: useAuthStore.getState().accessToken!,
          refreshToken: useAuthStore.getState().refreshToken!,
          workspaceId: me.workspaceId,
          user: {
            id: me.id,
            email: me.email,
            name: me.name,
            emailVerifiedAt: me.emailVerifiedAt,
          },
        });
        toast.success('Email verificado.');
      } else {
        toast.info('Aún no está verificado.');
      }
    } catch {
      toast.error('No se pudo comprobar.');
    } finally {
      setChecking(false);
    }
  };

  const logout = async () => {
    if (refreshToken) await authApi.logout(refreshToken).catch(() => {});
    clear();
    nav({ to: '/login' });
  };

  return (
    <div className="fixed inset-0 z-50 bg-kibo-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-kibo-border bg-kibo-surface shadow-2xl overflow-hidden">
        <div className="px-6 pt-7 pb-6 text-center">
          <div className="flex justify-center mb-4">
            <Logo size={44} />
          </div>
          <div className="mx-auto mb-5 w-14 h-14 rounded-full flex items-center justify-center bg-kibo-accent/15 text-kibo-accent ring-1 ring-kibo-accent/30">
            <MailCheck size={26} />
          </div>
          <h1 className="text-lg font-semibold tracking-tight mb-1">
            Verifica tu email
          </h1>
          <p className="text-sm text-kibo-muted leading-relaxed">
            Enviamos un enlace de verificación a{' '}
            <span className="text-kibo-text font-medium">{user.email}</span>. Confírmalo para
            activar la sincronización y empezar a usar Kibo.
          </p>
        </div>
        <div className="px-6 pb-6 flex flex-col gap-2">
          <button
            onClick={check}
            disabled={checking}
            className="btn-primary h-9 text-sm"
          >
            <RefreshCw size={14} className={checking ? 'animate-spin' : ''} />
            {checking ? 'Comprobando…' : 'Ya lo he verificado'}
          </button>
          <button
            onClick={resend}
            disabled={resending}
            className="btn-outline h-9 text-sm"
          >
            {resending ? 'Reenviando…' : 'Reenviar email'}
          </button>
        </div>
        <div className="border-t border-kibo-border px-6 py-3 flex items-center justify-between text-xs text-kibo-muted">
          <span>Comprobamos automáticamente cada 15 s.</span>
          <button
            onClick={logout}
            className="inline-flex items-center gap-1 hover:text-kibo-text"
            title="Cerrar sesión"
          >
            <LogOut size={12} /> Salir
          </button>
        </div>
      </div>
    </div>
  );
}
