import { Outlet, useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';
import { useAuthStore } from '../store/auth';
import { Logo } from '../components/Logo';

export function AuthLayout() {
  const nav = useNavigate();
  const accessToken = useAuthStore((s) => s.accessToken);
  const refreshToken = useAuthStore((s) => s.refreshToken);
  useEffect(() => {
    if (accessToken || refreshToken) nav({ to: '/today' });
  }, [accessToken, refreshToken, nav]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-kibo-bg px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-3 mb-8">
          <Logo size={80} />
          <span className="text-xl font-semibold tracking-tight">Kibo</span>
        </div>
        <Outlet />
      </div>
    </div>
  );
}
