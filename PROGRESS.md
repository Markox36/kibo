# Kibo — Progreso de desarrollo

> Tracker para retomar trabajo si se corta la sesión.  
> Última actualización: 2026-07-06

## Estado global

**Fase actual:** Fases 2/3/4/5/7 completadas. Backend + web + desktop con SQLite + sync engine funcionando. Landing pública + docs legales + delete-account + Google Limited Use disclosure listos para verificación Google OAuth.  
**Siguiente:** Fase 9 (import/export .ics, notifs nativas, papelera, Docker prod) o tests integración

## Google OAuth verification — estado

- [x] `privacy.html` y `terms.html` en `apps/web/public/` con Limited Use + emails a `hello@markox.dev`.
- [x] Landing pública `apps/web/src/pages/Landing.tsx` en `/`. Dashboard mueve a `/today`.
- [x] Modal `LimitedUseDisclosure` en `GoogleIntegrationCard` con checkbox obligatoria pre-OAuth.
- [x] Botón desvincular Google (revoca token en `DELETE /integrations/google`).
- [x] `DELETE /me` backend + "Zona peligrosa" en Settings (confirma con email, revoca Google, borra workspace + user + collections).
- [x] Workflow `release.yml` para builds multi-plataforma (Linux/macOS/Windows) via `tauri-action` en tag `v*` o `workflow_dispatch`.
- [ ] Verificar dominio `markox.dev` en Google Search Console con misma cuenta Google Cloud.
- [ ] App logo cuadrado 120×120 (subido en OAuth consent screen).
- [ ] Video demo YouTube unlisted: OAuth flow + disclosure + uso Calendar en Kibo.
- [ ] Submit verification en Google Cloud Console con justificación por scope.

**Commits:**
- `8da09b3` scaffold inicial
- `377f20e` docs progreso
- `c2d8f57` Fases 4+5+devices module
- pendiente: Fase 3 completa (desktop CRUD + sync engine Rust + backup)

---

## Fase 0 — Setup base ✅

- [x] Leer KIBO_SPEC.md
- [x] Crear PROGRESS.md
- [x] Verificar node/pnpm (node v25.9.0, pnpm 11.5.1)
- [x] `package.json` raíz + workspace
- [x] `pnpm-workspace.yaml` (con `allowBuilds.esbuild: true`)
- [x] `turbo.json`
- [x] Estructura carpetas: `apps/{api,web,desktop}`, `packages/{shared,ui,config}`
- [x] `packages/config` (tsconfig.base/node/react + eslint)
- [x] `.prettierrc.json` + `.prettierignore`
- [x] `.gitignore`
- [x] `.editorconfig`
- [x] `tsconfig.json` raíz con project refs
- [x] GitHub Actions `.github/workflows/ci.yml`
- [x] `git init` + commit inicial (8da09b3)

## Fase 1 — Shared schemas ✅

- [x] `packages/shared` package.json + tsconfig
- [x] Enums en `src/enums.ts` (TaskStatus, Priority, Energy, TimeBlock, Recurrence, Reminder, SyncStatus, InboxType, InboxItemStatus, CalendarType, SyncOperation, TimeEntryType, DevicePlatform, AccentColor, ThemeMode)
- [x] Zod schemas: BaseEntity, Task+Subtask, Event, Calendar, Category, Tag, InboxItem, TimeEntry, Device, User, Workspace, ChangeLogEntry
- [x] Helpers: ulid (`newUlid`, `newMonotonicUlid`, `UlidSchema`), timestamps (`nowUtc`, `toIsoUtc`, `IsoUtc`, `IsoDateOnly`)
- [x] DTOs sync: `SyncRequest`, `SyncResponse`, `LocalChange`, `SyncConflict`, `FullSyncSnapshot`, `FULL_RESYNC_REQUIRED`
- [x] Textos i18n `es.json`
- [x] Tests unitarios pasan (5/5)

## Fase 2 — API base + auth ✅

- [x] `apps/api` Fastify + helmet + CORS + rate-limit
- [x] `env.ts` con Zod (JWT_SECRET, MONGODB_URI, SMTP, GOOGLE, WEB_ORIGIN...)
- [x] Plugin MongoDB con índices automáticos (users, tokens, tasks, events, change_log TTL 90d, etc.)
- [x] Plugin JWT (`@fastify/jwt`) + `requireAuth` decorator
- [x] Módulo auth: register, login, refresh (rotación + revoke on reuse), logout, verify-email (GET + POST), resend-verification, request-password-reset, reset-password, google
- [x] JWT access 15m + refresh 30d con hash SHA-256 en DB
- [x] SMTP service (`nodemailer`) — plantillas en HTML/texto para verificación y reset
- [x] Módulo users: `GET /me`, `PATCH /me`, `GET /workspaces/current`
- [x] Workspace personal autocreado en primer login/register
- [x] CRUD genérico factory: `/tasks`, `/events`, `/calendars`, `/categories`, `/tags`, `/inbox` (GET, GET/:id, POST, PATCH/:id, DELETE/:id con soft delete)
- [x] Módulo sync: `POST /sync` (last-write-wins + conflict report), `GET /sync/snapshot`, cursor ULID, `FULL_RESYNC_REQUIRED` detection
- [x] `change_log` con TTL 90 días + snapshot completo
- [x] Health endpoint `/health`
- [x] Módulo devices (`GET /devices`, `POST /devices`, `PATCH /devices/:id`, `POST /devices/:id/logout`)
- [ ] Tests integración auth/sync (pendiente)

## Fase 3 — Desktop local SQLite ✅

- [x] Estructura Tauri v2 en `apps/desktop/src-tauri` (Cargo.toml, tauri.conf.json, main.rs)
- [x] Rust: apertura SQLite + migración inicial (workspaces, calendars, categories, tags, tasks, events, inbox, time_entries, sync_queue, meta)
- [x] Comandos CRUD completos: tasks (list/create/update/delete), events (list/create/update/delete), calendars (list/create/update/delete), categories (list/create), inbox (list/create/update/delete), meta (get/set)
- [x] `enqueue_sync()` en cada mutación → `sync_queue` con snapshot JSON
- [x] `sync_status` local por entidad (`synced` / `pending_create` / `pending_update` / `pending_delete`)
- [x] Sync engine Rust (`sync.rs`):
  - `set_credentials`/`clear_credentials` con keyring del sistema (Windows Credential Manager, macOS Keychain, Linux Secret Service)
  - `sync_now`: recolecta queue → `POST /sync` con Bearer token → refresh en 401 → marca synced + aplica remote_changes con upsert
  - `get_sync_status`: authenticated + last_sync + cursor + pending_count
  - Cursor ULID persistido en tabla `meta`
- [x] Backup local JSON (`export_backup`, `import_backup`) con volcado/carga por entidad
- [x] Frontend TS con `@tauri-apps/api` (`tauriApi` wrapper) y App demo de tareas + botón Sincronizar
- [x] Icons RGBA placeholder en `apps/desktop/src-tauri/icons/`
- [x] `cargo check` compila limpio (0 warnings, 0 errors)

## Fase 4 — UI base Kibo ✅

- [x] `apps/web` Vite + React 18 + TS + Tailwind (tema kibo custom azul/violeta)
- [x] `packages/ui` (Button + `cn`)
- [x] Tema oscuro Raycast-like + estilos globales (`.card`, `.input`, `.btn-primary`)
- [x] Sidebar con `<Link>` de TanStack Router (expandida/colapsada/focus)
- [x] Topbar (buscar/crear/estado sync/logout)
- [x] Command palette Ctrl+K con navegación teclado + integración router
- [x] Dashboard con datos reales (eventos/tareas de hoy)
- [x] TanStack Router código-base (`AuthLayout` vs `RootLayout` + `beforeLoad` redirect)
- [x] TanStack Query hooks: `useTasks/useEvents/useCalendars/useInbox` + mutations con invalidación
- [x] Cliente HTTP `apiFetch` con refresh token automático (single-flight)
- [x] Auth store persistente con `zustand/middleware` (`localStorage: kibo.auth`)
- [x] Páginas Login/Register con React Hook Form + Zod resolvers + toasts (`sonner`)
- [x] Página Tareas: vista lista + Kanban por status, crear/toggle/delete
- [x] Página Inbox: capturar, convertir a tarea, archivar, borrar
- [x] Página Ajustes: cuenta + gestión calendarios (crear con color picker)
- [ ] Onboarding real (fase 2 posterior)

## Fase 5 — Calendario MVP ✅

- [x] FullCalendar integrado (timegrid, daygrid, interaction)
- [x] Vistas día/semana/mes con locale es, firstDay=1, slot 30min, 06:00-24:00
- [x] Drag & drop (`eventDrop` → PATCH)
- [x] Resize (`eventResize` → PATCH)
- [x] Crear evento por selección (`select` → prompt → POST, autocrea calendario Personal)
- [x] Click evento para borrar (con confirm)
- [x] Colores por calendario
- [x] Filtros por calendario en sidebar de la vista
- [x] Estilos dark theme custom (`.kibo-fc`)

## Fase 5 — Calendario MVP

- [ ] FullCalendar integrado
- [ ] Vistas día/semana/mes
- [ ] Drag & drop / resize
- [ ] Colores calendario/categoría
- [ ] Filtros

## Fase 6 — Tareas + Inbox

- [ ] Lista tareas
- [ ] Kanban
- [ ] Filtros
- [ ] Subtareas
- [ ] Inbox global
- [ ] Focus tarea + timer/Pomodoro

## Fase 7 — Sync MVP ✅

- [x] `POST /sync` backend
- [x] change_log en MongoDB con TTL 90d
- [x] Cursor ULID monotonic
- [x] Sync engine desktop (Rust) con reintento tras refresh 401
- [x] Full resync detection + snapshot endpoint

## Fase 8 — Web MVP

- [ ] Login web
- [ ] CRUD via REST
- [ ] Deploy Vercel config

## Fase 9 — Cierre MVP

- [x] Importar `.ics` (`import_ics` command en `src-tauri/src/ics.rs`)
- [x] Exportar JSON/CSV/ICS (`export_backup`, `export_csv`, `export_ics`)
- [x] Backups cifrados (AES-256-GCM + Argon2id, `crypto_backup.rs`)
- [x] Notificaciones nativas (`tauri-plugin-notification` + scheduler 30s en `notifications.rs`, tabla `notifications_fired`)
- [x] Papelera (`trash.rs`: `list_trash`, `restore_entity`, `purge_entity`, `empty_trash`, `purge_older_than`)
- [ ] Docker Compose prod
- [ ] UI web para trash/import-export/backup cifrado (comandos ya expuestos en `tauriApi`)

---

## Notas y decisiones

- Node v25.9.0, pnpm 11.5.1.
- Repo git inicializado en rama `main`, commit `8da09b3`.
- Sistema: Linux.
- `pnpm-workspace.yaml` tiene `allowBuilds: { esbuild: true, argon2: true }` — necesario para install limpio.
- Casts `as never` en `crud.factory.ts` y `sync.routes.ts` para sortear tipado estricto del driver MongoDB con `_id` string (ULID); funciona en runtime, tipos verificados por Zod al insertar.
- `apps/api/src/modules/crud/crud.factory.ts` es genérico — añadir nuevas entidades es una llamada a `crudRoutes({...})` en `modules/crud/index.ts`.

## Comandos útiles

```bash
pnpm install
pnpm typecheck    # 6/6 paquetes OK
pnpm test         # shared 5/5, resto passWithNoTests
pnpm build
pnpm dev          # arranca todo (falta MongoDB local para api)
pnpm --filter @kibo/web dev      # solo web
pnpm --filter @kibo/api dev      # solo api (necesita MONGODB_URI)
```

## Cómo retomar

1. Leer este archivo.
2. Ver última casilla marcada por fase.
3. Continuar por la siguiente marca sin `[x]`.
4. Marcar `[x]` al completar.
5. Commits pequeños por feature.

## Próximos pasos recomendados (en orden)

1. **Devices module** (fase 2 final): endpoints `GET /devices`, `PATCH`, `POST /:id/logout`. Colección `devices` ya indexada.
2. **Cliente HTTP web + auth flow**: fetch wrapper con refresh automático en `apps/web/src/lib/api.ts` + store Zustand para tokens en localStorage.
3. **TanStack Router en web**: reemplazar el `route` state por rutas reales.
4. **FullCalendar** (Fase 5): `pnpm --filter @kibo/web add @fullcalendar/core @fullcalendar/react @fullcalendar/daygrid @fullcalendar/timegrid @fullcalendar/interaction`. Vista semana por horas por defecto.
5. **Desktop CRUD completo** (Fase 3): expandir `commands.rs` con update/delete/events/inbox y llamar desde web/desktop.
6. **Sync engine desktop** (Fase 7): función Rust que empuje `sync_queue` a `POST /sync` con reintentos.
7. **Tests integración auth** (`apps/api`): `Fastify.inject()` contra Mongo memory server, cubrir register+login+refresh+reset+google.

## Estructura final

```
kibo/
├── apps/
│   ├── api/     Fastify + Mongo + auth + sync
│   ├── web/     React + Vite + Tailwind
│   └── desktop/ Tauri v2 + React (frontend) + Rust (backend SQLite)
├── packages/
│   ├── shared/  Enums + Zod schemas + ULID + sync DTOs
│   ├── ui/      Button + cn
│   └── config/  tsconfig + eslint compartidos
├── .github/workflows/ci.yml
├── turbo.json
├── pnpm-workspace.yaml
└── PROGRESS.md
```
