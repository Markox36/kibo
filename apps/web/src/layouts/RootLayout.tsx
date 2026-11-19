import { Outlet } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { Sidebar } from '../components/Sidebar';
import { Topbar } from '../components/Topbar';
import { CommandPalette } from '../components/CommandPalette';
import { VerifyEmailGate } from '../components/VerifyEmailGate';
import { FocusPanel } from '../components/FocusPanel';
import { MaintenanceGate } from '../components/MaintenanceGate';
import { useUiStore } from '../store/ui';
import { useReminders } from '../hooks/useReminders';
import { useFocusTicker } from '../hooks/useFocusTicker';

export function RootLayout() {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [focusOpen, setFocusOpen] = useState(false);
  const sidebarState = useUiStore((s) => s.sidebarState);

  useReminders();
  useFocusTicker();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
      if (e.key === 'Escape') setPaletteOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <VerifyEmailGate>
      <MaintenanceGate>
      <div className="flex h-screen w-full overflow-hidden">
        {sidebarState !== 'focus' && <Sidebar />}
        <div className="flex-1 flex flex-col min-w-0">
          <Topbar
            onOpenPalette={() => setPaletteOpen(true)}
            onOpenFocus={() => setFocusOpen(true)}
          />
          <main className="flex-1 overflow-auto p-3 sm:p-4 md:p-6">
            <Outlet />
          </main>
        </div>
        {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} />}
        <FocusPanel open={focusOpen} onClose={() => setFocusOpen(false)} />
      </div>
      </MaintenanceGate>
    </VerifyEmailGate>
  );
}
