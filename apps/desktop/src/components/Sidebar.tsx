import { CalendarDays, Inbox, ListTodo, LayoutDashboard, Settings, ChevronsLeft, X, Shield, CalendarClock, Zap } from 'lucide-react';
import clsx from 'clsx';
import { Link, useNavigate, useRouterState } from '@tanstack/react-router';
import { useEffect } from 'react';
import { useUiStore } from '../store/ui';
import { Logo } from './Logo';
import { useAdminMe } from '../hooks/useFlags';

const isMac =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.platform);
const modLabel = isMac ? '⌥' : 'Alt';

const items = [
  { to: '/', label: 'Hoy', icon: LayoutDashboard, shortcut: `${modLabel} 1`, key: '1', match: '/' },
  { to: '/calendar', label: 'Calendario', icon: CalendarDays, shortcut: `${modLabel} 2`, key: '2', match: '/calendar' },
  { to: '/tasks', label: 'Tareas', icon: ListTodo, shortcut: `${modLabel} 3`, key: '3', match: '/tasks' },
  { to: '/unscheduled', label: 'Sin planificar', icon: CalendarClock, shortcut: `${modLabel} 4`, key: '4', match: '/unscheduled' },
  { to: '/focus', label: 'Focus', icon: Zap, shortcut: `${modLabel} 5`, key: '5', match: '/focus' },
  { to: '/inbox', label: 'Inbox', icon: Inbox, shortcut: `${modLabel} 6`, key: '6', match: '/inbox' },
] as const;

const settingsItem = {
  to: '/settings',
  label: 'Ajustes',
  icon: Settings,
  shortcut: `${modLabel} 7`,
  key: '7',
  match: '/settings',
} as const;

const shortcutMap = [...items, settingsItem];

export function Sidebar() {
  const sidebarState = useUiStore((s) => s.sidebarState);
  const toggle = useUiStore((s) => s.toggleSidebar);
  const mobileOpen = useUiStore((s) => s.mobileNavOpen);
  const setMobileOpen = useUiStore((s) => s.setMobileNavOpen);
  const collapsed = sidebarState === 'collapsed';
  const path = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const adminMe = useAdminMe();
  const isAdmin = Boolean(adminMe.data?.email);

  useEffect(() => {
    setMobileOpen(false);
  }, [path, setMobileOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false);
      if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        const target = e.target as HTMLElement | null;
        const tag = target?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) return;
        const hit = shortcutMap.find((it) => it.key === e.key);
        if (hit) {
          e.preventDefault();
          navigate({ to: hit.to });
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setMobileOpen, navigate]);

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={clsx(
          'border-r border-kibo-border bg-kibo-surface flex flex-col transition-transform md:transition-all overflow-x-hidden',
          'fixed inset-y-0 left-0 z-50 w-64 md:static md:z-auto md:shrink-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
          collapsed ? 'md:w-14' : 'md:w-56',
        )}
      >
        <div className="h-12 flex items-center gap-2 px-3 border-b border-kibo-border">
          <Logo size={24} withText={!collapsed || mobileOpen} />
          <button
            onClick={() => setMobileOpen(false)}
            className="ml-auto text-kibo-muted hover:text-kibo-text md:hidden"
            aria-label="Cerrar menú"
          >
            <X size={18} />
          </button>
        </div>
        <nav className="flex-1 py-2 overflow-y-auto overflow-x-hidden">
          {items.map((it) => {
            const Icon = it.icon;
            const active = path === it.match;
            const showLabel = !collapsed || mobileOpen;
            return (
              <Link
                key={it.to}
                to={it.to}
                className={clsx(
                  'w-full flex items-center gap-2.5 px-3 py-2.5 md:py-1.5 text-sm rounded-md mx-1 my-0.5 transition-colors',
                  active
                    ? 'bg-kibo-border/60 text-kibo-text'
                    : 'text-kibo-muted hover:text-kibo-text hover:bg-kibo-border/40',
                )}
                title={collapsed && !mobileOpen ? it.label : undefined}
              >
                <Icon size={16} />
                {showLabel && <span className="flex-1 text-left">{it.label}</span>}
                {showLabel && it.shortcut && (
                  <span className="kbd hidden md:inline-flex">{it.shortcut}</span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="py-2 border-t border-kibo-border">
          {isAdmin && (
            <Link
              to="/admin"
              className={clsx(
                'w-full flex items-center gap-2.5 px-3 py-2.5 md:py-1.5 text-sm rounded-md mx-1 my-0.5 transition-colors',
                path === '/admin'
                  ? 'bg-amber-500/20 text-amber-100'
                  : 'text-amber-200/80 hover:text-amber-100 hover:bg-amber-500/10',
              )}
              title={collapsed && !mobileOpen ? 'Admin' : undefined}
            >
              <Shield size={16} />
              {(!collapsed || mobileOpen) && <span className="flex-1 text-left">Admin</span>}
            </Link>
          )}
          <Link
            to={settingsItem.to}
            className={clsx(
              'w-full flex items-center gap-2.5 px-3 py-2.5 md:py-1.5 text-sm rounded-md mx-1 my-0.5 transition-colors',
              path === settingsItem.match
                ? 'bg-kibo-border/60 text-kibo-text'
                : 'text-kibo-muted hover:text-kibo-text hover:bg-kibo-border/40',
            )}
            title={collapsed && !mobileOpen ? settingsItem.label : undefined}
          >
            <Settings size={16} />
            {(!collapsed || mobileOpen) && (
              <>
                <span className="flex-1 text-left">{settingsItem.label}</span>
                <span className="kbd hidden md:inline-flex">{settingsItem.shortcut}</span>
              </>
            )}
          </Link>
        </div>
        <div className="p-2 border-t border-kibo-border hidden md:block">
          <button
            onClick={toggle}
            className="w-full text-[11px] text-kibo-muted hover:text-kibo-text py-1 rounded flex items-center justify-center gap-1"
          >
            <ChevronsLeft size={12} className={clsx('transition-transform', collapsed && 'rotate-180')} />
            {!collapsed && 'Colapsar'}
          </button>
        </div>
      </aside>
    </>
  );
}
