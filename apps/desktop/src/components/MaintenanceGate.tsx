import { Wrench, Shield } from 'lucide-react';
import { usePublicFlags, useAdminMe } from '../hooks/useFlags';

interface Props {
  children: React.ReactNode;
}

export function MaintenanceGate({ children }: Props) {
  const flags = usePublicFlags();
  const admin = useAdminMe();
  const isAdmin = Boolean(admin.data?.email);

  if (flags.data?.maintenanceMode && !isAdmin) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-kibo-bg p-6">
        <div className="max-w-md w-full text-center rounded-2xl border border-amber-500/40 bg-amber-500/5 p-8">
          <Wrench size={40} className="mx-auto text-amber-400 mb-3" />
          <h1 className="text-lg font-semibold mb-2">Estamos de mantenimiento</h1>
          <p className="text-sm text-kibo-muted whitespace-pre-wrap">
            {flags.data.maintenanceMessage ?? 'Volvemos en breve. Gracias por la paciencia.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      {flags.data?.maintenanceMode && isAdmin && (
        <div className="fixed top-0 inset-x-0 z-50 bg-amber-500/90 text-amber-950 text-xs py-1 px-3 flex items-center justify-center gap-2">
          <Shield size={12} /> Modo mantenimiento activo (solo vos podés ver la app).
        </div>
      )}
      {children}
    </>
  );
}
