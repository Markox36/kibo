import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';
import { authApi } from '../lib/auth-api';
import { useAuthStore } from '../store/auth';
import { ApiError } from '../lib/api';
import { GoogleButton } from '../components/GoogleButton';

const Schema = z.object({
  email: z.string().email('email inválido'),
  password: z.string().min(1, 'contraseña requerida'),
});
type FormValues = z.infer<typeof Schema>;

export function LoginPage() {
  const nav = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);
  const form = useForm<FormValues>({ resolver: zodResolver(Schema), defaultValues: { email: '', password: '' } });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const res = await authApi.login(values);
      setSession(res);
      nav({ to: '/today' });
    } catch (err) {
      if (err instanceof ApiError && err.code === 'invalid_credentials') {
        toast.error('Email o contraseña incorrectos.');
      } else {
        toast.error('No se pudo iniciar sesión.');
      }
    }
  });

  const onGoogle = async (idToken: string) => {
    try {
      const res = await authApi.google(idToken);
      setSession(res);
      nav({ to: '/today' });
    } catch (err) {
      if (err instanceof ApiError && err.code === 'google_not_configured') {
        toast.error('Google no está configurado en el servidor.');
      } else {
        toast.error('No se pudo entrar con Google.');
      }
    }
  };

  return (
    <div className="rounded-xl border border-kibo-border bg-kibo-surface p-6 shadow-soft">
      <h1 className="text-lg font-semibold mb-1">Entra en Kibo</h1>
      <p className="text-sm text-kibo-muted mb-5">Usa tu email y contraseña.</p>
      <form onSubmit={onSubmit} className="space-y-3">
        <Field label="Email" error={form.formState.errors.email?.message}>
          <input
            type="email"
            autoComplete="email"
            {...form.register('email')}
            className="input"
          />
        </Field>
        <Field label="Contraseña" error={form.formState.errors.password?.message}>
          <input
            type="password"
            autoComplete="current-password"
            {...form.register('password')}
            className="input"
          />
        </Field>
        <button
          type="submit"
          disabled={form.formState.isSubmitting}
          className="w-full h-9 rounded-md bg-kibo-accentDeep hover:bg-kibo-accent text-white text-sm font-medium disabled:opacity-50"
        >
          {form.formState.isSubmitting ? 'Entrando…' : 'Entrar'}
        </button>
      </form>

      <div className="flex items-center gap-3 my-4">
        <span className="flex-1 h-px bg-kibo-border" />
        <span className="text-[11px] text-kibo-muted uppercase tracking-wide">o</span>
        <span className="flex-1 h-px bg-kibo-border" />
      </div>

      <GoogleButton onCredential={onGoogle} text="signin_with" />

      <p className="text-sm text-kibo-muted mt-4">
        ¿Aún no tienes cuenta?{' '}
        <Link to="/register" className="text-kibo-accent hover:underline">
          Crear cuenta
        </Link>
      </p>
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-xs text-kibo-muted mb-1">{label}</span>
      {children}
      {error && <span className="block text-xs text-red-400 mt-1">{error}</span>}
    </label>
  );
}
