import { Search, Plus, Cloud, LogOut, User, Menu, Timer, Radio, Pause, Play, Loader2 } from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';
import { useAuthStore } from '../store/auth';
import { authApi } from '../lib/auth-api';
import { useUiStore } from '../store/ui';
import { useFocus, currentRemainingMs, formatMs } from '../store/focus';
import { useLofi, currentStationLabel } from '../store/lofi';
import { useEffect, useState } from 'react';

interface Props {
  onOpenPalette: () => void;
  onOpenFocus: () => void;
}

export function Topbar({ onOpenPalette, onOpenFocus }: Props) {
  const nav = useNavigate();
  const { user, refreshToken, clear } = useAuthStore();
  const toggleMobileNav = useUiStore((s) => s.toggleMobileNav);
  const focusPhase = useFocus((s) => s.phase);
  const focus = useFocus();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (focusPhase === 'idle') return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [focusPhase]);

  const focusRunning = focusPhase !== 'idle';
  const remainingLabel = focusRunning ? formatMs(currentRemainingMs(focus, now)) : null;

  const lofi = useLofi();
  const lofiActive = lofi.playing || lofi.loading;
  const lofiLabel = currentStationLabel(lofi);

  const logout = async () => {
    if (refreshToken) await authApi.logout(refreshToken).catch(() => {});
    clear();
    nav({ to: '/login' });
  };

  return (
    <header className="h-12 shrink-0 border-b border-kibo-border bg-kibo-surface flex items-center gap-2 sm:gap-3 px-2 sm:px-4">
      <button
        onClick={toggleMobileNav}
        className="md:hidden text-kibo-muted hover:text-kibo-text p-1"
        aria-label="Abrir menú"
      >
        <Menu size={20} />
      </button>

      <button
        onClick={onOpenPalette}
        className="flex-1 max-w-md min-w-0 flex items-center gap-2 px-2.5 h-8 rounded-md border border-kibo-border bg-kibo-bg text-sm text-kibo-muted hover:text-kibo-text transition-colors"
      >
        <Search size={14} className="shrink-0" />
        <span className="truncate">Buscar o ejecutar…</span>
        <span className="kbd ml-auto hidden sm:inline-flex">⌘K</span>
      </button>

      <button
        onClick={onOpenPalette}
        className="h-8 px-2 sm:px-2.5 rounded-md border border-kibo-border bg-kibo-bg text-sm text-kibo-muted hover:text-kibo-text inline-flex items-center gap-1.5 shrink-0"
        aria-label="Crear"
      >
        <Plus size={14} />
        <span className="hidden sm:inline">Crear</span>
      </button>

      <div className="ml-auto flex items-center gap-2 sm:gap-3 text-xs text-kibo-muted">
        {lofiActive && (
          <div
            className="hidden sm:inline-flex items-center gap-1.5 h-8 pl-2 pr-1 rounded-md border border-kibo-accent/40 bg-kibo-accent/10 text-kibo-text max-w-[220px]"
            title={`Reproduciendo: ${lofiLabel}`}
          >
            <button
              onClick={onOpenFocus}
              className="inline-flex items-center gap-1.5 min-w-0"
              aria-label="Abrir panel"
            >
              {lofi.loading ? (
                <Loader2 size={12} className="animate-spin shrink-0" />
              ) : (
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-kibo-accent opacity-70 animate-ping" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-kibo-accent" />
                </span>
              )}
              <Radio size={12} className="text-kibo-accent shrink-0" />
              <span className="truncate text-[11px]">{lofiLabel}</span>
            </button>
            <button
              onClick={() => lofi.toggle()}
              className="w-6 h-6 rounded flex items-center justify-center text-kibo-muted hover:text-kibo-text hover:bg-kibo-border/40 shrink-0"
              aria-label={lofi.playing ? 'Pausar' : 'Reproducir'}
              title={lofi.playing ? 'Pausar radio' : 'Reanudar radio'}
            >
              {lofi.playing ? <Pause size={12} /> : <Play size={12} />}
            </button>
          </div>
        )}
        {lofiActive && (
          <button
            onClick={() => lofi.toggle()}
            className="sm:hidden h-8 w-8 rounded-md border border-kibo-accent/40 bg-kibo-accent/10 text-kibo-text flex items-center justify-center"
            title={`Radio: ${lofiLabel}`}
            aria-label="Radio"
          >
            {lofi.loading ? (
              <Loader2 size={13} className="animate-spin" />
            ) : lofi.playing ? (
              <Pause size={13} />
            ) : (
              <Play size={13} />
            )}
          </button>
        )}
        <button
          onClick={onOpenFocus}
          className={
            'h-8 px-2 sm:px-2.5 rounded-md border inline-flex items-center gap-1.5 transition-colors ' +
            (focusRunning
              ? 'border-kibo-accent/50 bg-kibo-accent/10 text-kibo-text'
              : 'border-kibo-border bg-kibo-bg hover:text-kibo-text')
          }
          title="Sesión de concentración"
          aria-label="Concentración"
        >
          <Timer size={14} />
          {remainingLabel ? (
            <span className="font-mono tabular-nums text-[11px]">{remainingLabel}</span>
          ) : (
            <span className="hidden sm:inline">Focus</span>
          )}
        </button>
        <span className="hidden lg:inline-flex items-center gap-1">
          <Cloud size={14} />
          Sincronizado
        </span>
        {user && (
          <span className="hidden md:inline-flex items-center gap-1.5 max-w-[160px] truncate">
            <User size={14} className="shrink-0" />
            <span className="truncate">{user.name ?? user.email}</span>
          </span>
        )}
        <button
          onClick={logout}
          className="inline-flex items-center gap-1 hover:text-kibo-text p-1"
          title="Cerrar sesión"
          aria-label="Cerrar sesión"
        >
          <LogOut size={14} />
        </button>
      </div>
    </header>
  );
}
