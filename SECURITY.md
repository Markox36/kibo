# Política de seguridad

## Versiones con soporte

Kibo está en early access. Solo se mantiene la **última versión publicada** (rama `main` y última release).

| Versión | Soporte |
|---|:---:|
| Última (`0.1.x`) | ✅ |
| Anteriores | ❌ |

## Cómo reportar una vulnerabilidad

**No abras un issue ni una Pull Request públicos.** Usa uno de estos canales privados:

1. **GitHub (preferido)**: pestaña [Security → Report a vulnerability](https://github.com/Markox36/kibo/security/advisories/new) de este repositorio.
2. **Email**: [hello@markox.dev](mailto:hello@markox.dev) con el asunto `[SECURITY] Kibo`.

Incluye, si puedes:

- Componente afectado (API, web, escritorio, móvil) y versión o commit.
- Descripción del problema y su impacto.
- Pasos para reproducirlo o una prueba de concepto mínima.
- Cualquier mitigación que conozcas.

No incluyas datos reales de otras personas en el reporte.

## Qué esperar

| Plazo | Acción |
|---|---|
| 5 días laborables | Acuse de recibo |
| 15 días | Valoración inicial (si es válido, severidad y plan) |
| Según severidad | Corrección y publicación de la release/aviso |

Es un proyecto mantenido por una sola persona: los plazos son orientativos, pero te mantendré informado. Si lo deseas, te mencionaré como descubridor en el aviso; dímelo en el reporte.

## Divulgación responsable

Pedimos que no divulgues públicamente el problema hasta que exista una corrección o hayan pasado **90 días** desde el reporte, lo que ocurra primero. No emprenderemos acciones legales contra quien actúe de buena fe conforme a esta política.

## Alcance

**En alcance**: el código de este repositorio (API, web, escritorio, móvil, paquetes compartidos) y la instancia oficial en `kibo.markox.dev`.

**Fuera de alcance**:

- Denegación de servicio por volumen, spam o ingeniería social.
- Pruebas contra cuentas o datos de otros usuarios; usa solo tus propias cuentas.
- Vulnerabilidades en dependencias sin un impacto demostrable en Kibo (repórtalas al proyecto original).
- Problemas que requieren un dispositivo ya comprometido o acceso físico.
- Instancias autoalojadas mal configuradas (secretos débiles, `.env` expuestos, etc.).

## Si autoalojas Kibo

- Genera `JWT_SECRET` e `INTEGRATIONS_KEY` con `openssl rand -hex 32` y no los reutilices.
- No publiques `.env`, `.env.production` ni keystores; ya están en `.gitignore`.
- Sirve la API detrás de TLS y limita `WEB_ORIGIN` a tu dominio.
- Mantén MongoDB sin exposición pública y con autenticación.
- Deja `ADMIN_EMAIL` vacío salvo que necesites los endpoints de administración.
