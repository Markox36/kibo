# Desplegar Kibo en Vercel (gratis)

Se puede alojar tu propia instancia de Kibo sin pagar hosting usando **Vercel** (plan Hobby) para la web y la API, y **MongoDB Atlas** (plan M0) para la base de datos. La app de escritorio y la móvil se conectan a esa API.

| Pieza | Dónde | Coste |
|---|---|---|
| Web (`apps/web`) | Vercel, proyecto estático | Gratis |
| API (`apps/api`) | Vercel, función serverless | Gratis |
| Base de datos | MongoDB Atlas M0 (512 MB) | Gratis |
| Correo (verificación y reset) | Brevo, Resend, Gmail con contraseña de aplicación… | Gratis dentro de sus límites |

> El plan Hobby de Vercel es solo para uso **personal y no comercial**. Para uso comercial necesitas el plan Pro.

## 1. Base de datos

1. Crea un clúster gratuito (M0) en [MongoDB Atlas](https://www.mongodb.com/atlas).
2. Crea un usuario de base de datos y copia la cadena de conexión (`mongodb+srv://...`).
3. En **Network Access** permite `0.0.0.0/0`: las IPs de salida de Vercel no son fijas. Usa una contraseña larga y única.

## 2. API

[![Deploy API](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FMarkox36%2Fkibo&root-directory=apps%2Fapi&project-name=kibo-api&env=MONGODB_URI,JWT_SECRET,INTEGRATIONS_KEY,API_PUBLIC_URL,WEB_ORIGIN)

O manualmente: importa el repo en Vercel y fija **Root Directory = `apps/api`**. El `vercel.json` de esa carpeta ya define instalación, build y la función (`api/index.js`).

Variables de entorno (Settings → Environment Variables):

| Variable | Valor |
|---|---|
| `MONGODB_URI` | Cadena de Atlas |
| `MONGODB_DB_NAME` | p. ej. `kibo` |
| `JWT_SECRET` | `openssl rand -hex 32` |
| `INTEGRATIONS_KEY` | `openssl rand -hex 32` (solo si usas Google) |
| `API_PUBLIC_URL` | URL de este proyecto, p. ej. `https://kibo-api.vercel.app` |
| `WEB_ORIGIN` | URL de la web (paso 3) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | Tu proveedor de correo |
| `GOOGLE_*` | Opcional, ver el README |

Comprueba que funciona: `https://<tu-api>.vercel.app/health` debe devolver `{"status":"ok",...}`.

## 3. Web

[![Deploy Web](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FMarkox36%2Fkibo&root-directory=apps%2Fweb&project-name=kibo-web&env=VITE_API_URL)

Root Directory = `apps/web`. Variables: `VITE_API_URL` (URL de tu API, sin `/` final) y, si usas Google, `VITE_GOOGLE_CLIENT_ID`. Son variables de **build**: si las cambias, redespliega.

Como la URL de la web no se conoce hasta desplegarla, el orden práctico es: API (con `WEB_ORIGIN` provisional) → Web → actualizar `WEB_ORIGIN` en la API → **Redeploy** de la API.

## 4. Apps de escritorio y móvil

Compílalas con `VITE_API_URL` / `EXPO_PUBLIC_API_URL` apuntando a tu API (ver [README](../README.md#variables-de-entorno)). El escritorio funciona sin conexión; la API solo se usa para sincronizar.

## Limitaciones a tener en cuenta

- **Arranque en frío**: la primera petición tras un rato inactiva tarda más (conexión a Mongo + carga de Argon2).
- **Límite de tiempo**: la función tiene `maxDuration` de 30 s; importaciones muy grandes de ICS o Google pueden no caber. El plan Hobby admite hasta 60 s.
- **Rate limiting en memoria**: cada instancia serverless cuenta por separado, así que el límite (200 peticiones/min) es aproximado. Para un límite estricto haría falta un almacén compartido (p. ej. Redis).
- **Atlas M0**: 512 MB y sin copias de seguridad automáticas; exporta tus datos de vez en cuando desde la app (backup cifrado).
- **Variables**: `TRUST_PROXY=true` se activa solo en Vercel, para que el rate limiting vea la IP real del cliente.
