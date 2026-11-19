import { Link } from '@tanstack/react-router';
import {
  CalendarDays,
  ListTodo,
  Inbox,
  Timer,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  type LucideIcon,
} from 'lucide-react';
import { useAuthStore } from '../store/auth';
import { Logo } from '../components/Logo';
import { DownloadsSection } from '../components/DownloadsSection';

export function LandingPage() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const authed = Boolean(accessToken || refreshToken);

  return (
    <div className="min-h-screen bg-kibo-bg text-kibo-text">
      <header className="sticky top-0 z-30 border-b border-kibo-border bg-kibo-bg/80 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <Logo size={26} />
            <span className="font-semibold tracking-tight">Kibo</span>
          </Link>
          <nav className="flex items-center gap-2 text-sm">
            {authed ? (
              <Link
                to="/today"
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-kibo-accentDeep hover:bg-kibo-accent text-white font-medium"
              >
                Ir a la app <ArrowRight size={14} />
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="h-8 px-3 rounded-md text-kibo-muted hover:text-kibo-text inline-flex items-center"
                >
                  Entrar
                </Link>
                <Link
                  to="/register"
                  className="h-8 px-3 rounded-md bg-kibo-accentDeep hover:bg-kibo-accent text-white font-medium inline-flex items-center"
                >
                  Crear cuenta
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-4 pt-16 pb-20 md:pt-24 md:pb-28 text-center">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-kibo-border bg-kibo-surface px-3 py-1 text-xs text-kibo-muted mb-6">
            <Sparkles size={12} className="text-kibo-violet" />
            Early access · v0.1
          </div>
          <h1 className="text-4xl md:text-6xl font-semibold tracking-tight leading-[1.05]">
            Tu día, tu semana y tu foco
            <br />
            <span className="bg-gradient-to-r from-kibo-accent to-kibo-violet bg-clip-text text-transparent">
              en una sola app.
            </span>
          </h1>
          <p className="mt-6 mx-auto max-w-2xl text-kibo-muted text-lg">
            Calendario, tareas, notas rápidas y modo concentración en un flujo único.
            Pensado para quienes viven pegados al calendario y no quieren doce herramientas
            para organizarse.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            {authed ? (
              <Link
                to="/today"
                className="h-11 px-5 rounded-md bg-kibo-accentDeep hover:bg-kibo-accent text-white font-medium inline-flex items-center gap-1.5"
              >
                Abrir Kibo <ArrowRight size={16} />
              </Link>
            ) : (
              <>
                <Link
                  to="/register"
                  className="h-11 px-5 rounded-md bg-kibo-accentDeep hover:bg-kibo-accent text-white font-medium inline-flex items-center gap-1.5"
                >
                  Empieza gratis <ArrowRight size={16} />
                </Link>
                <Link
                  to="/login"
                  className="h-11 px-5 rounded-md border border-kibo-border hover:border-kibo-muted text-kibo-text font-medium inline-flex items-center"
                >
                  Ya tengo cuenta
                </Link>
              </>
            )}
          </div>
          <p className="mt-4 text-xs text-kibo-muted">
            Sin tarjeta. Sin anuncios. Datos exportables cuando quieras.
          </p>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-20">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <FeatureCard
              icon={CalendarDays}
              title="Calendario integrado"
              body="Vistas día · 3 días · semana · mes. Drag & drop, resize, recurrencia RRULE. Filtros por calendario y tipo."
            />
            <FeatureCard
              icon={ListTodo}
              title="Tareas con bloques reales"
              body="Prioridades P1/P2/P3, subtareas, estimación, energía, vencimiento independiente. Bloquea tiempo en el calendario."
            />
            <FeatureCard
              icon={Inbox}
              title="Inbox de captura rápida"
              body="Anota ideas sin fricción. Procesa después. Contador siempre visible."
            />
            <FeatureCard
              icon={Timer}
              title="Modo concentración"
              body="Pomodoro configurable, timer libre y player lofi integrado. Sesiones que no cortan tu flujo."
            />
            <FeatureCard
              icon={CalendarDays}
              title="Google Calendar & ICS"
              body="Conecta tu cuenta de Google, importa calendarios y sincroniza eventos. Import/export ICS estándar."
            />
            <FeatureCard
              icon={ShieldCheck}
              title="Tus datos, tuyos"
              body="TLS, JWT con refresh rotativo, tokens cifrados en servidor. Export JSON/CSV y backup cifrado con passphrase."
            />
          </div>
        </section>

        <section className="border-t border-kibo-border bg-kibo-surface/40">
          <div className="mx-auto max-w-4xl px-4 py-16 text-center">
            <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">
              Un solo login para desktop y web
            </h2>
            <p className="mt-3 text-kibo-muted">
              Kibo funciona en Linux, macOS, Windows y en cualquier navegador moderno.
              Todo sincronizado, sin extras que instalar.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              {authed ? (
                <Link
                  to="/today"
                  className="h-10 px-4 rounded-md bg-kibo-accentDeep hover:bg-kibo-accent text-white font-medium inline-flex items-center gap-1.5"
                >
                  Abrir Kibo <ArrowRight size={15} />
                </Link>
              ) : (
                <Link
                  to="/register"
                  className="h-10 px-4 rounded-md bg-kibo-accentDeep hover:bg-kibo-accent text-white font-medium inline-flex items-center gap-1.5"
                >
                  Crear cuenta <ArrowRight size={15} />
                </Link>
              )}
              <a
                href="#descargas"
                className="h-10 px-4 rounded-md border border-kibo-border hover:border-kibo-muted text-kibo-text font-medium inline-flex items-center"
              >
                Descargar desktop
              </a>
            </div>
          </div>
        </section>

        <DownloadsSection />
      </main>

      <footer className="border-t border-kibo-border">
        <div className="mx-auto max-w-6xl px-4 py-8 flex flex-col md:flex-row items-center gap-3 justify-between text-sm text-kibo-muted">
          <div className="flex items-center gap-2">
            <Logo size={18} />
            <span>© 2026 Kibo · Markox</span>
          </div>
          <nav className="flex items-center gap-5">
            <a href="/privacy.html" className="hover:text-kibo-text">Privacidad</a>
            <a href="/terms.html" className="hover:text-kibo-text">Condiciones</a>
            <a href="mailto:hello@markox.dev" className="hover:text-kibo-text">Contacto</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  body,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-xl border border-kibo-border bg-kibo-surface p-5 shadow-soft">
      <div className="w-9 h-9 rounded-md bg-kibo-accentDeep/15 text-kibo-accent inline-flex items-center justify-center mb-3">
        <Icon size={18} />
      </div>
      <h3 className="font-semibold tracking-tight">{title}</h3>
      <p className="mt-1.5 text-sm text-kibo-muted leading-relaxed">{body}</p>
    </div>
  );
}
