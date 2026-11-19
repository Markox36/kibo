# Kibo — Especificación inicial del producto

> Versión: `v0.1`  
> Estado: lista para iniciar desarrollo  
> Tipo de proyecto: app personal de organización, local-first, escritorio + web  
> Nombre final: **Kibo**

---

## 1. Resumen del producto

**Kibo** es una app de organización personal que mezcla calendario avanzado, gestor de tareas, inbox rápido, planificación diaria y sincronización entre dispositivos.

La idea principal es abrir la app y saber claramente:

- qué tengo que hacer hoy;
- qué eventos tengo en el calendario;
- qué tareas están pendientes;
- qué cosas he capturado en el inbox;
- qué puedo planificar en huecos libres;
- qué está sincronizado y qué sigue solo en local.

Kibo nace con enfoque **local-first**: la app de escritorio funciona sin internet usando SQLite local. Si el usuario inicia sesión y tiene conexión, sincroniza contra una API propia con MongoDB Atlas.

---

## 2. Objetivo del MVP

El MVP debe ser útil como app diaria real, sin intentar copiar Notion completo desde el primer día.

### Prioridad principal

1. Dashboard diario.
2. Calendario grande y usable.
3. Gestor de tareas potente.
4. Inbox global para capturar rápido.
5. Sincronización local-first.

### Fuera del MVP

Quedan para fase 2:

- notas tipo Notion;
- proyectos;
- integración completa con Google Calendar;
- integración con GitHub;
- estadísticas avanzadas;
- móvil;
- colaboración visible;
- IA avanzada.

---

## 3. Plataformas

### MVP

- **Desktop:** Tauri.
- **Web:** React/Vite desplegado en Vercel.
- **Backend:** Fastify + TypeScript en servidor propio.
- **Base local desktop:** SQLite.
- **Base remota:** MongoDB Atlas.

### Futuro

- App móvil.
- Offline-first también en móvil.
- Web con capacidades offline si se considera necesario.

---

## 4. Nombre e identidad

### Nombre

**Kibo**

### Módulos con naming interno

- Kibo Dashboard
- Kibo Calendar
- Kibo Tasks
- Kibo Inbox
- Kibo Focus
- Kibo Sync
- Kibo Command

### Estilo visual elegido

**Dev / Raycast-like**

Características:

- modo oscuro por defecto;
- interfaz rápida y limpia;
- command palette protagonista;
- estética dev/productividad;
- acentos azul/violeta;
- tarjetas compactas;
- bordes sutiles;
- sensación premium.

### Icono elegido

**A1 Minimal — calendario + check**

Dirección:

- icono moderno con volumen estilo macOS/Tauri;
- cuadrado redondeado;
- fondo oscuro;
- calendario estilizado;
- check azul/violeta;
- suficientemente simple para verse bien pequeño.

---

## 5. Tono de la interfaz

Kibo debe hablar de forma **cercana pero breve**.

Ejemplos:

```txt
Listo, tarea creada.
Todo sincronizado.
No hay conexión. Seguimos en local.
No se pudo sincronizar. Tus cambios siguen guardados en este dispositivo.
Verifica tu email para activar la sincronización.
```

No debe sonar excesivamente motivacional ni demasiado técnico para mensajes normales.

---

## 6. Pantallas principales del MVP

### 6.1 Dashboard

Primera pantalla al abrir la app.

Debe ser un **dashboard-calendar-first**:

- calendario grande como centro;
- tareas de hoy visibles;
- inbox visible;
- creación rápida arriba;
- estado de sincronización visible;
- filtros básicos;
- acceso rápido a focus mode.

Layout conceptual:

```txt
┌──────────────────────────────────────────────────────┐
│ Topbar: búsqueda, crear rápido, sync, perfil          │
├───────────────┬──────────────────────────────────────┤
│ Sidebar       │ Calendario grande                    │
│ - Hoy         │ Vista semana/día/mes                  │
│ - Calendario  │ Eventos + tareas planificadas         │
│ - Tareas      │                                      │
│ - Inbox       ├──────────────────────────────────────┤
│ - Categorías  │ Tareas de hoy / Inbox / sugerencias   │
└───────────────┴──────────────────────────────────────┘
```

### 6.2 Calendario

Vista grande con:

- día;
- semana;
- mes;
- vista semanal por defecto;
- eventos internos;
- tareas planificadas;
- calendarios importados `.ics`;
- calendarios vinculados por URL `.ics` en solo lectura;
- colores por calendario y categoría;
- filtros por calendario.

### 6.3 Tareas

Pantalla dedicada con dos vistas:

- lista;
- Kanban.

Vista Kanban:

```txt
Inbox → Pendiente → En progreso → Bloqueada → Hecha → Cancelada
```

Vista lista con filtros avanzados.

### 6.4 Inbox

Inbox global para capturar cualquier cosa sin decidir estructura desde el inicio.

Un item puede convertirse en:

- tarea;
- evento;
- nota futura;
- idea sin clasificar.

### 6.5 Focus

Dos variantes:

- Focus calendario;
- Focus tarea.

Focus tarea incluye:

- título;
- descripción;
- subtareas;
- prioridad;
- categoría;
- deadline;
- duración estimada;
- temporizador.

### 6.6 Ajustes

Apartados del MVP:

- Cuenta;
- Sincronización;
- Apariencia;
- Notificaciones;
- Calendarios;
- Categorías;
- Atajos;
- Importar / Exportar.

---

## 7. Navegación

### Sidebar

La app usará:

- sidebar izquierda;
- command palette.

La sidebar tendrá tres estados:

```txt
Expandida   → icono + texto + badges
Colapsada   → solo iconos
Modo focus  → oculta completamente
```

Items principales:

- Hoy / Dashboard;
- Calendario;
- Tareas;
- Inbox;
- Categorías;
- Ajustes.

### Command palette

Abrir con:

```txt
Ctrl/Cmd + K
```

Acciones:

- buscar tareas;
- buscar eventos;
- buscar inbox;
- crear tarea;
- crear evento;
- navegar a pantallas;
- filtrar vistas;
- ejecutar acciones rápidas.

---

## 8. Atajos de teclado MVP

```txt
Ctrl/Cmd + K          → abrir command palette
Ctrl/Cmd + N          → crear rápido
Ctrl/Cmd + Shift + T  → nueva tarea
Ctrl/Cmd + Shift + E  → nuevo evento
G luego D             → ir al dashboard
G luego C             → ir al calendario
G luego T             → ir a tareas
Esc                   → cerrar modal/panel
```

---

## 9. Tema visual

### Tema

- oscuro por defecto;
- claro opcional;
- opción seguir sistema.

### Color de acento

Opciones cerradas:

- azul;
- violeta;
- verde;
- naranja.

Por defecto: azul/violeta.

### Tipografía

- UI principal: Inter / SF Pro / similar.
- Detalles dev: monospace para atajos, timestamps y metadatos.

### i18n

- UI visible en español en MVP.
- Sistema preparado para varios idiomas.
- Textos centralizados en archivos tipo `es.json` y `en.json`.

---

## 10. Onboarding

Onboarding corto.

Flujo:

1. Bienvenida.
2. Nombre opcional.
3. Crear calendario `Personal` por defecto.
4. Elegir categorías iniciales.
5. Preguntar si quiere iniciar sesión para sincronizar.
6. Importar calendario opcional.
7. Entrar al dashboard.

Si no hay internet:

```txt
Sin conexión → saltar login → modo local
```

Categorías sugeridas:

- Personal;
- Trabajo;
- Casa;
- Estudios;
- Salud;
- Servidores;
- Compras;
- Finanzas.

El usuario elige cuáles activar.

---

## 11. Tareas

### Estados

```txt
Inbox
Pendiente
En progreso
Bloqueada
Hecha
Cancelada
```

### Prioridad

```txt
Baja
Media
Alta
```

### Energía requerida

```txt
Baja
Media
Alta
```

### Campos principales

```txt
id
workspaceId
title
description
status
priority
energy
categoryId
tagIds
plannedDate
plannedStart
plannedEnd
timeBlock
dueDate
estimatedMinutes
recurrence
reminder
subtasks
createdAt
updatedAt
deletedAt
version
syncStatus
```

### Fecha límite vs fecha planificada

Diferenciar:

```txt
Fecha límite      → cuándo debe estar terminada
Fecha planificada → cuándo quiero trabajar en ella
```

Una tarea puede tener:

- ninguna fecha;
- solo deadline;
- solo fecha planificada;
- fecha planificada con bloque;
- fecha planificada con hora exacta;
- deadline + fecha planificada.

### Subtareas

Subtareas simples con checkbox:

```txt
text
done
order
```

Sin fecha, prioridad ni estado propios en MVP.

### Repetición

Repeticiones básicas:

- ninguna;
- diaria;
- semanal;
- mensual.

### Recordatorios

Un recordatorio configurable por tarea/evento:

- ninguno;
- a la hora planificada;
- 5 min antes;
- 15 min antes;
- 1 hora antes;
- 1 día antes.

### Duración estimada

Opcional.

Si no hay duración, se puede usar valor por defecto en calendario, por ejemplo 30 minutos.

---

## 12. Calendario

### Vistas

- Día.
- Semana.
- Mes.

Vista por defecto: **semana por horas**.

### Librería

**FullCalendar** para MVP.

Motivo:

- drag & drop;
- resize;
- vistas listas;
- ecosistema maduro;
- acelera el MVP.

### Tareas dentro del calendario

Las tareas se pueden:

- arrastrar al calendario;
- crear con fecha/hora;
- dejar sin fecha;
- dejar con fecha pero sin hora;
- asignar a bloque mañana/tarde/noche.

Modelo:

```txt
Tarea sin fecha
→ Inbox / Backlog

Tarea con fecha
→ aparece en el día

Tarea con fecha + bloque
→ aparece en Mañana / Tarde / Noche

Tarea con fecha + hora
→ aparece como bloque horario
```

### Bloques de tiempo

MVP:

```txt
Mañana: 06:00 - 12:00
Tarde: 12:00 - 20:00
Noche: 20:00 - 00:00
```

Configurables después.

### Eventos simples

Campos:

```txt
id
workspaceId
calendarId
title
description
start
end
categoryId
tagIds
reminder
createdAt
updatedAt
deletedAt
version
syncStatus
```

Diferencia:

```txt
Tarea  → algo que completar
Evento → algo que ocurre en un horario
```

---

## 13. Calendarios internos y externos

### Calendarios internos

MVP permite varios calendarios internos.

Al primer arranque se crea:

```txt
Personal
```

como calendario predeterminado.

El usuario puede cambiarlo en ajustes.

Campos:

```txt
id
workspaceId
name
color
visible
type: internal
order
archivedAt
createdAt
updatedAt
deletedAt
version
syncStatus
```

### Calendarios externos

MVP:

- importar archivo `.ics`;
- vincular URL `.ics` en solo lectura.

Fase 2:

- Google Calendar OAuth;
- leer eventos;
- elegir calendarios;
- crear/editar eventos de Google más adelante.

### Visualización

Los calendarios se muestran mezclados visualmente, pero con filtros:

```txt
[✓] Personal
[✓] Trabajo
[✓] Festivos
[ ] Cumpleaños
```

### Colores

Regla:

- calendario tiene color base;
- categoría puede sobrescribir color del evento/tarea;
- tareas planificadas usan color de categoría si existe.

---

## 14. Inbox

### Tipo opcional

Un item de inbox puede tener tipo opcional:

```txt
Tarea
Evento
Nota futura
Idea / sin clasificar
```

### Campos

```txt
id
workspaceId
text
type
categoryId
tagIds
dateHint
status: pending | processed | archived
createdAt
updatedAt
deletedAt
version
syncStatus
```

### Procesamiento

Debe permitir:

- convertir en tarea;
- convertir en evento;
- añadir categoría;
- planificar;
- archivar;
- editar detalles.

---

## 15. Categorías y etiquetas

### Categorías

Categorías con:

```txt
id
workspaceId
name
color
icon
order
archivedAt
createdAt
updatedAt
deletedAt
version
syncStatus
```

Uso:

- una categoría principal por tarea/evento;
- color e icono;
- organización principal.

### Etiquetas

Etiquetas globales preparadas para:

- tareas;
- eventos;
- notas futuras.

Campos:

```txt
id
workspaceId
name
color
createdAt
updatedAt
deletedAt
version
syncStatus
```

Uso:

- varias por item;
- filtros;
- búsqueda;
- clasificación flexible.

---

## 16. Planificación automática

MVP: sugerencias básicas, no auto-planificación agresiva.

La app debe sugerir huecos libres usando:

- duración estimada;
- prioridad;
- energía;
- deadlines;
- disponibilidad;
- eventos existentes.

Ejemplo:

```txt
Tarea: Revisar backups
Duración: 30 min
Prioridad: Media
Energía: Baja
Deadline: viernes

Hueco sugerido:
Miércoles 18:30 - 19:00

Acciones:
[Planificar aquí] [Buscar otro hueco] [Ignorar]
```

### Disponibilidad MVP

Simple:

- días activos seleccionables;
- hora inicio;
- hora fin;
- eventos bloquean huecos automáticamente.

Avanzado después.

---

## 17. Focus mode y time tracking

### Focus calendario

- oculta sidebar;
- oculta paneles secundarios;
- maximiza calendario.

### Focus tarea

Muestra:

- tarea actual;
- descripción;
- subtareas;
- prioridad;
- categoría;
- deadline;
- duración estimada;
- timer.

### Timer

MVP incluye:

- cronómetro libre;
- Pomodoro simple.

Pomodoro:

```txt
25 min trabajo
5 min descanso
```

### Time tracking

Guardar sesiones individuales.

Campos:

```txt
id
workspaceId
taskId
startedAt
endedAt
durationSeconds
type: stopwatch | pomodoro
note
createdAt
updatedAt
deletedAt
version
syncStatus
```

No habrá pantalla de estadísticas en MVP, pero los datos quedan guardados para fase 2.

---

## 18. Notificaciones

### Tipos MVP

- recordatorios de tareas;
- recordatorios de eventos;
- avisos importantes de sync.

### Sistema

- notificaciones nativas para recordatorios;
- avisos internos para sync, errores y estado local.

### Permiso

Pedir permiso cuando el usuario cree el primer recordatorio, no en onboarding.

Flujo:

```txt
Usuario crea primer recordatorio
→ Kibo explica para qué necesita notificaciones
→ [Permitir notificaciones] [Solo avisos dentro de Kibo]
```

---

## 19. Papelera y borrado

Kibo usará papelera visible + soft delete interno.

Campos:

```txt
deletedAt
purgeAfter
```

Regla:

```txt
Borrar item
→ se marca deletedAt
→ desaparece de vistas normales
→ aparece en Papelera
→ se puede restaurar durante 30 días
→ después puede purgarse automáticamente
```

Papelera MVP:

- tareas borradas;
- eventos borrados;
- inbox items borrados;
- categorías borradas/archivadas;
- restaurar;
- eliminar definitivamente;
- vaciar papelera.

---

## 20. Importación, exportación y backups

### Exportación MVP

- backup completo en JSON;
- calendario/eventos en `.ics`;
- tareas en CSV;
- tareas en JSON.

### Importación MVP

- calendarios `.ics`;
- backup JSON de Kibo;
- tareas desde CSV.

### Backups locales automáticos

- frecuencia diaria;
- formato JSON comprimido;
- retención de últimos 14 backups;
- ubicación en carpeta local de Kibo;
- backup manual desde ajustes;
- restauración desde archivo JSON.

### Cifrado de backups

Backups cifrados automáticamente usando almacenamiento seguro del sistema.

- Windows: Credential Manager o equivalente.
- macOS: Keychain.
- Linux: Secret Service / keyring.

Si no está disponible:

```txt
No se pudo activar el cifrado automático de backups.
Puedes seguir usando backups locales sin cifrar o configurar una contraseña manual.
```

---

## 21. Cuenta y autenticación

### Modo de uso

Kibo permite:

```txt
Sin cuenta / sin internet
→ modo local con SQLite

Con cuenta + internet
→ sync con MongoDB Atlas
```

La cuenta no bloquea el uso local.

### Métodos de login

MVP:

- email + contraseña;
- Google login.

GitHub login queda para fase 2.

### Backend auth

- JWT access token;
- refresh token;
- rotación de refresh tokens;
- revocación al cerrar sesión.

Duraciones:

```txt
Access token: 15 min
Refresh token: 30 días
```

### Contraseñas

- mínimo 10 caracteres;
- sin reglas raras de símbolos/mayúsculas;
- permitir passphrases.

### Verificación de email

Obligatoria para activar sync.

Flujo:

```txt
Usuario crea cuenta
→ se envía email de verificación
→ puede usar Kibo local
→ sync queda pausada hasta verificar email
```

### Recuperación de contraseña

MVP incluye:

- email de recuperación;
- enlace temporal;
- caducidad 1 hora;
- token de un solo uso;
- invalidación de refresh tokens antiguos tras cambiar contraseña.

### Email

Proveedor:

- SMTP propio.

Remitente:

```txt
Kibo <kibo@markox.dev>
```

Variables:

```env
SMTP_HOST=smtp.markox.dev
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=...
SMTP_PASSWORD=...
SMTP_FROM="Kibo <kibo@markox.dev>"
```

---

## 22. Usuarios, workspace y colaboración futura

### MVP

- app personal;
- sin roles;
- sin colaboración visible;
- un usuario tiene un espacio personal.

### Preparado internamente

Aunque no se vea, habrá `workspaceId` desde el principio.

Modelo futuro:

```txt
users
workspaces
workspaceMembers futuro
```

Cada entidad sincronizable tendrá:

```txt
userId
workspaceId
```

En MVP se crea automáticamente un workspace personal.

---

## 23. Datos, IDs y timestamps

### IDs

Usar **ULID** para todas las entidades.

Motivo:

- se generan offline;
- ordenables por tiempo;
- funcionan en SQLite;
- funcionan en MongoDB como string;
- evitan depender de ObjectId.

### Timestamps

ISO string en UTC.

Ejemplo:

```txt
2026-07-03T18:42:15.000Z
```

Campos comunes:

```txt
createdAt
updatedAt
deletedAt
lastSyncedAt
```

### Timezone

MVP:

- usar zona horaria local del dispositivo;
- guardar timestamps en UTC;
- preparado para `timezone` por evento en fase 2.

---

## 24. Local-first y sincronización

### Estrategia general

Desktop usa SQLite como fuente principal.

Cuando hay cuenta + conexión:

```txt
SQLite local
→ Sync Engine
→ Fastify API
→ MongoDB Atlas
```

Web usa backend directamente:

```txt
Web
→ API
→ MongoDB Atlas
```

### Estados locales de sync

```txt
synced
pending_create
pending_update
pending_delete
conflict
error
```

### sync_queue

Estrategia híbrida:

- cada entidad tiene `syncStatus`;
- además existe `sync_queue` para operaciones críticas, reintentos y trazabilidad.

Campos `sync_queue`:

```txt
id
workspaceId
entityType
entityId
operation
payloadSnapshot
attempts
lastAttemptAt
errorMessage
createdAt
updatedAt
```

### Endpoint principal

```http
POST /sync
```

Hace:

1. recibe cambios locales pendientes;
2. aplica cambios en MongoDB;
3. escribe `change_log`;
4. detecta conflictos básicos;
5. devuelve cambios remotos desde cursor;
6. indica si hace falta full resync;
7. devuelve nuevo cursor.

### change_log remoto

Colección en MongoDB desde el MVP.

Campos:

```txt
id: ULID
workspaceId
entityType
entityId
operation: create | update | delete
changedAt
version
actorUserId
payloadSnapshot
```

### Cursor

`lastSyncCursor` = último `change_log.id` aplicado.

Como `change_log.id` es ULID, se puede pedir:

```txt
id > lastSyncCursor
order by id asc
```

### Payload del change_log

MVP guarda snapshot completo del documento tras el cambio.

Para delete:

```txt
payloadSnapshot mínimo:
id
deletedAt
version
```

### Retención del change_log

90 días.

Si un cliente lleva más de 90 días sin sincronizar:

```txt
API responde FULL_RESYNC_REQUIRED
```

### Full resync

Regla:

1. comprobar cambios locales pendientes;
2. subir cambios locales primero;
3. descargar snapshot completo del workspace;
4. aplicar en SQLite;
5. marcar entidades como `synced`;
6. actualizar `lastSyncCursor`.

### Conflictos

MVP:

- último cambio gana;
- guardar historial interno básico;
- no mostrar historial al usuario salvo conflicto relevante.

### Versionado

Cada entidad sincronizable tendrá `version` incremental.

Regla:

```txt
Create → version = 1
Update → version + 1
Delete → version + 1 + deletedAt
```

---

## 25. Dispositivos / clientes

Registrar clientes desde MVP.

Campos:

```txt
clientId
userId
workspaceId
deviceName
platform: desktop | web | mobile
appVersion
lastSyncAt
lastSyncCursor
createdAt
updatedAt
```

Nombre del dispositivo:

- automático desde el sistema;
- editable después;
- fallback si no se puede obtener.

En ajustes:

```txt
Cuenta → Dispositivos
├─ Este dispositivo
├─ Última sincronización
└─ Cerrar sesión en este dispositivo
```

---

## 26. Stack técnico

### Monorepo

- Turborepo;
- pnpm workspaces.

Estructura:

```txt
kibo/
├─ apps/
│  ├─ api/         # Fastify + TypeScript
│  ├─ web/         # React + Vite
│  └─ desktop/     # Tauri + React/Vite
│
├─ packages/
│  ├─ shared/      # tipos, Zod schemas, DTOs
│  ├─ ui/          # componentes compartidos
│  ├─ config/      # eslint, tsconfig, prettier
│  └─ db/          # helpers/modelos comunes si aplica
│
├─ turbo.json
├─ pnpm-workspace.yaml
└─ package.json
```

### Frontend

- React;
- Vite;
- TypeScript;
- TanStack Router;
- TanStack Query;
- Zustand;
- React Hook Form;
- Zod;
- shadcn/ui;
- Tailwind CSS;
- FullCalendar.

### Desktop

- Tauri;
- SQLite local;
- lógica local SQLite desde Rust mediante comandos Tauri propios;
- almacenamiento seguro del sistema para tokens/backups.

### Backend

- Node.js;
- Fastify;
- TypeScript;
- MongoDB Driver oficial;
- Zod o TypeBox para validación;
- JWT;
- SMTP propio.

### Base de datos remota

MongoDB Atlas:

```txt
Cluster compartido
├─ kibo_dev
└─ kibo_prod
```

### Desarrollo local

Sistema principal: Linux.

Dev local:

- API con pnpm local;
- MongoDB Atlas dev remoto;
- web con pnpm;
- desktop con Tauri dev.

Comandos esperados:

```bash
pnpm dev
pnpm dev:api
pnpm dev:web
pnpm dev:desktop
pnpm build
pnpm lint
pnpm test
```

---

## 27. Backend: estructura recomendada

```txt
apps/api/src/
├─ modules/
│  ├─ auth/
│  │  ├─ auth.routes.ts
│  │  ├─ auth.controller.ts
│  │  ├─ auth.service.ts
│  │  ├─ auth.repository.ts
│  │  └─ auth.schemas.ts
│  │
│  ├─ tasks/
│  ├─ events/
│  ├─ calendars/
│  ├─ categories/
│  ├─ tags/
│  ├─ inbox/
│  ├─ sync/
│  ├─ users/
│  ├─ workspaces/
│  ├─ devices/
│  └─ email/
│
├─ plugins/
│  ├─ db.plugin.ts
│  ├─ auth.plugin.ts
│  ├─ cors.plugin.ts
│  └─ rate-limit.plugin.ts
│
├─ config/
│  └─ env.ts
│
├─ utils/
└─ server.ts
```

---

## 28. API inicial

### Auth

```http
POST /auth/register
POST /auth/login
POST /auth/google
POST /auth/refresh
POST /auth/logout
POST /auth/verify-email
POST /auth/resend-verification
POST /auth/request-password-reset
POST /auth/reset-password
```

### User / workspace

```http
GET /me
PATCH /me
GET /workspaces/current
```

### Sync

```http
POST /sync
GET /sync/snapshot
```

### Devices

```http
GET /devices
PATCH /devices/:id
POST /devices/:id/logout
```

### CRUD cloud opcional para web

La web puede usar endpoints REST normales o pasar por sync. Para simplicidad inicial:

```http
GET /tasks
POST /tasks
PATCH /tasks/:id
DELETE /tasks/:id

GET /events
POST /events
PATCH /events/:id
DELETE /events/:id

GET /calendars
POST /calendars
PATCH /calendars/:id
DELETE /calendars/:id

GET /categories
POST /categories
PATCH /categories/:id
DELETE /categories/:id

GET /tags
POST /tags
PATCH /tags/:id
DELETE /tags/:id

GET /inbox
POST /inbox
PATCH /inbox/:id
DELETE /inbox/:id
```

Nota: todos los cambios cloud deben escribir en `change_log`.

---

## 29. Deploy

### Web

```txt
app.markox.dev
→ Vercel
→ React + Vite
```

Variable:

```env
VITE_API_URL=https://api.markox.dev
```

### API

```txt
api.markox.dev
→ Cloudflare Tunnel
→ servidor propio
→ Docker Compose
→ kibo-api Fastify
→ MongoDB Atlas
```

Variables API:

```env
NODE_ENV=production
PORT=3000
API_PUBLIC_URL=https://api.markox.dev
WEB_ORIGIN=https://app.markox.dev
MONGODB_URI=mongodb+srv://...
MONGODB_DB_NAME=kibo_prod
JWT_SECRET=...
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=30d
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
SMTP_HOST=smtp.markox.dev
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=...
SMTP_PASSWORD=...
SMTP_FROM="Kibo <kibo@markox.dev>"
```

### CORS

Permitir:

```txt
https://app.markox.dev
http://localhost:5173
tauri dev origin correspondiente
```

### Docker Compose producción

Servicios mínimos:

```txt
kibo-api
cloudflared externo o servicio separado
```

MongoDB no corre local; se usa Atlas.

---

## 30. Testing

Testing desde el inicio.

### MVP testing mínimo

- unit tests de schemas y lógica crítica;
- integration tests de API;
- tests de auth;
- tests de sync;
- tests de repositorios;
- tests de validaciones.

Stack recomendado:

- Vitest para paquetes TS;
- testing de Fastify con inyección HTTP;
- MongoDB test DB `kibo_test` o entorno controlado.

---

## 31. CI/CD

Usar GitHub Actions desde el principio.

Pipeline mínimo:

```txt
on pull_request / push
├─ pnpm install
├─ lint
├─ typecheck
├─ test
└─ build
```

Jobs recomendados:

- `lint`
- `typecheck`
- `test`
- `build:web`
- `build:api`
- `build:desktop` más adelante, porque Tauri puede requerir runners específicos.

---

## 32. Roadmap de desarrollo recomendado

### Fase 0 — Setup base

Objetivo: repo arrancado y DX limpio.

Tareas:

- crear monorepo Turborepo + pnpm;
- configurar TypeScript;
- configurar ESLint/Prettier;
- configurar Tailwind;
- crear apps `api`, `web`, `desktop`;
- crear packages `shared`, `ui`, `config`;
- configurar GitHub Actions básico.

Resultado:

```txt
pnpm dev funciona
pnpm lint funciona
pnpm typecheck funciona
```

### Fase 1 — Shared schemas y modelo base

Objetivo: tipos compartidos.

Tareas:

- definir enums;
- schemas Zod para task/event/calendar/category/tag/inbox;
- helpers de ULID;
- helpers de timestamps;
- DTOs de sync.

Resultado:

```txt
packages/shared usable por API, web y desktop
```

### Fase 2 — API base + auth

Objetivo: backend funcional.

Tareas:

- Fastify app;
- env validation;
- MongoDB plugin;
- auth email/password;
- JWT access/refresh;
- SMTP email;
- verificación email;
- recuperación contraseña;
- Google OAuth básico.

Resultado:

```txt
registro/login/verificación/refresh funcionando
```

### Fase 3 — Desktop local SQLite

Objetivo: app desktop offline mínima.

Tareas:

- Tauri setup;
- SQLite desde Rust;
- migraciones locales;
- crear/listar/editar tareas localmente;
- crear/listar eventos localmente;
- syncStatus local;
- backup local básico.

Resultado:

```txt
Kibo Desktop funciona sin internet con tareas/eventos
```

### Fase 4 — UI base Kibo

Objetivo: shell visual.

Tareas:

- tema oscuro Raycast-like;
- sidebar expandida/colapsada;
- topbar;
- command palette;
- dashboard layout;
- ajustes básicos;
- componentes de tarea/evento/categoría.

Resultado:

```txt
UI principal navegable y coherente
```

### Fase 5 — Calendario MVP

Objetivo: calendario grande usable.

Tareas:

- integrar FullCalendar;
- vistas día/semana/mes;
- eventos internos;
- tareas planificadas;
- drag & drop;
- resize;
- colores por categoría/calendario;
- filtros por calendario.

Resultado:

```txt
Dashboard con calendario real
```

### Fase 6 — Tareas avanzadas + Inbox

Objetivo: flujo diario completo.

Tareas:

- vista lista;
- vista Kanban;
- filtros completos;
- subtareas;
- prioridades;
- energía;
- duración;
- deadlines;
- recordatorios;
- inbox global;
- acciones rápidas de procesamiento.

Resultado:

```txt
Kibo ya sirve para organizar el día completo
```

### Fase 7 — Sync MVP

Objetivo: desktop local-first sincronizado.

Tareas:

- endpoint `POST /sync`;
- `change_log`;
- cursor ULID;
- sync engine desktop;
- resolución último cambio gana;
- full resync;
- dispositivos;
- estados de sync UI.

Resultado:

```txt
Desktop sincroniza con MongoDB Atlas
```

### Fase 8 — Web MVP

Objetivo: acceso desde navegador.

Tareas:

- login web;
- dashboard web;
- tareas/eventos/calendario desde API;
- cuenta y ajustes básicos;
- deploy Vercel.

Resultado:

```txt
app.markox.dev funcional
```

### Fase 9 — Import/export/backups/notificaciones

Objetivo: cerrar MVP robusto.

Tareas:

- importar `.ics`;
- vincular URL `.ics` solo lectura;
- exportar JSON/CSV/ICS;
- backups diarios cifrados;
- notificaciones nativas;
- papelera;
- CI más completo;
- Docker Compose producción.

Resultado:

```txt
MVP serio y usable
```

---

## 33. Fase 2 sugerida

Después del MVP:

- notas Markdown;
- proyectos;
- Google Calendar OAuth completo;
- GitHub integration;
- estadísticas de time tracking;
- IA para texto natural;
- planificación más inteligente;
- colaboración;
- móvil;
- workspaces visibles;
- estados personalizados;
- calendario custom si FullCalendar limita demasiado.

---

## 34. Decisiones finales cerradas

```txt
Nombre: Kibo
Estilo: Dev / Raycast-like
Icono: A1 Minimal, calendario + check
Desktop: Tauri
Web: React + Vite en Vercel
Backend: Fastify + TypeScript
Repo: Turborepo + pnpm
Local DB: SQLite desde Rust/Tauri
Remote DB: MongoDB Atlas
Mongo driver: oficial
Auth: JWT access + refresh
Login: email/password + Google
Email: SMTP propio, kibo@markox.dev
Sync: local-first con change_log
IDs: ULID
Timestamps: ISO UTC
Deploy API: Docker Compose + Cloudflare Tunnel
Web domain: app.markox.dev
API domain: api.markox.dev
Testing: unit + integration
CI/CD: GitHub Actions
Proyecto: privado
Sistema principal dev: Linux
```

---

## 35. Primeros comandos recomendados

Cuando empieces el repo:

```bash
mkdir kibo
cd kibo
pnpm init
pnpm add -D turbo typescript eslint prettier
```

Estructura inicial:

```bash
mkdir -p apps/api apps/web apps/desktop packages/shared packages/ui packages/config
```

Luego crear:

```txt
pnpm-workspace.yaml
turbo.json
package.json raíz
tsconfig base
eslint config
prettier config
```

---

## 36. Regla de oro del proyecto

Kibo debe priorizar siempre:

```txt
1. rapidez de captura
2. claridad del día
3. control del usuario
4. funcionamiento offline
5. sincronización fiable
6. interfaz limpia y potente
```

Si una feature rompe alguna de esas reglas, se deja para fase 2.
