# Multi-stage build for @kibo/api
FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

# ---------- deps stage ----------
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY packages/config/package.json packages/config/
COPY packages/shared/package.json packages/shared/
COPY packages/ui/package.json packages/ui/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY apps/desktop/package.json apps/desktop/
RUN pnpm install --frozen-lockfile

# ---------- build stage ----------
FROM deps AS build
COPY packages/config ./packages/config
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api
RUN pnpm --filter @kibo/shared build
RUN pnpm --filter @kibo/api build

# ---------- runtime ----------
FROM node:22-alpine AS runtime
RUN corepack enable
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=build /app/packages/config/package.json packages/config/
COPY --from=build /app/packages/shared/package.json packages/shared/
COPY --from=build /app/packages/shared/dist packages/shared/dist
COPY --from=build /app/apps/api/package.json apps/api/
COPY --from=build /app/apps/api/dist apps/api/dist

RUN pnpm install --prod --frozen-lockfile --filter @kibo/api...

EXPOSE 3000
WORKDIR /app/apps/api
CMD ["node", "dist/server.js"]
