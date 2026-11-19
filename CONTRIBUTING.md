# Contribuir a Kibo

¡Gracias por querer ayudar! Esta guía explica cómo preparar el entorno y qué esperamos de una contribución.

## Antes de empezar

- **Bugs y propuestas pequeñas**: abre un issue o una Pull Request directamente.
- **Cambios grandes** (nuevas funcionalidades, cambios en el sync o en el esquema de datos): abre antes un issue para discutirlo y evitar trabajo perdido.
- **Vulnerabilidades**: no uses issues públicos; sigue [SECURITY.md](./SECURITY.md).

Al contribuir aceptas que tu aportación se publique bajo la licencia [MIT](./LICENSE) del proyecto.

## Entorno de desarrollo

Requisitos: Node.js ≥ 20, pnpm 11.5.1 (`corepack enable`), MongoDB para la API, y Rust estable + [dependencias de Tauri](https://tauri.app/start/prerequisites/) si tocas el escritorio.

```bash
git clone https://github.com/Markox36/kibo.git
cd kibo
pnpm install
pnpm --filter @kibo/shared build
cp apps/api/.env.example apps/api/.env   # rellena MONGODB_URI y JWT_SECRET
pnpm dev:app                             # API + web
```

El resto de la configuración (Google OAuth, SMTP, escritorio, móvil) está en el [README](./README.md#puesta-en-marcha). Usa siempre credenciales de desarrollo propias: **nunca** subas `.env`, keystores ni claves.

## Estructura

Monorepo con pnpm workspaces y Turborepo: `apps/{api,web,desktop,mobile}` y `packages/{shared,planning,editor,ui,config}`. Los esquemas Zod de `@kibo/shared` son el contrato entre cliente y servidor: si cambias un esquema, revisa todos los consumidores.

## Flujo de trabajo

1. Haz un fork y crea una rama desde `main`: `feat/...`, `fix/...`, `docs/...`.
2. Mantén la PR centrada en un solo cambio; no mezcles refactors ni formato con funcionalidad.
3. Comprueba lo que toques:

   ```bash
   pnpm --filter <paquete> lint
   pnpm --filter <paquete> typecheck
   pnpm --filter <paquete> test
   pnpm format            # Prettier
   ```

   > El typecheck global arrastra errores previos (por eso el workflow de CI es manual). Lo que se pide es que **no añadas errores nuevos** en los paquetes que modifiques.

4. Si arreglas un bug o añades lógica no trivial (planificación, sync, crypto), añade un test con Vitest.
5. Abre la PR explicando **qué** cambia y **por qué**, y cómo lo probaste. Si cambia la interfaz, adjunta capturas.

## Estilo de código

- TypeScript estricto; evita `any` y los casts innecesarios.
- Prettier y EditorConfig mandan (comillas simples, punto y coma, 100 columnas, 2 espacios; 4 en Rust). No discutas formato en la PR: ejecuta `pnpm format`.
- Valida toda entrada externa con Zod en el borde (API, sync, importadores).
- Rust (`apps/desktop/src-tauri`): `cargo fmt` y sin warnings nuevos de `cargo clippy`.
- Textos de interfaz: el idioma actual es español; mantén las cadenas compartidas en `packages/shared/src/i18n`.

## Commits

Usamos mensajes tipo [Conventional Commits](https://www.conventionalcommits.org/) en imperativo y en una línea:

```
feat: add ICS export for filtered calendars
fix: avoid duplicate reminders after resync
docs: clarify desktop build requirements
```

Tipos habituales: `feat`, `fix`, `docs`, `refactor`, `test`, `ci`, `chore`.

## Qué revisamos en una PR

- Resuelve el problema descrito sin ampliar el alcance.
- No rompe el sync local-first ni los datos existentes (migraciones SQLite/MongoDB incluidas).
- No introduce secretos, datos personales ni dependencias innecesarias.
- Mantiene compatibilidad entre escritorio, web y móvil cuando toca código compartido.

## Código de conducta

Participar en este proyecto implica aceptar el [Código de Conducta](./CODE_OF_CONDUCT.md). Los incumplimientos se reportan a [hello@markox.dev](mailto:hello@markox.dev).
