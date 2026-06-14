# syntax=docker/dockerfile:1

# ---- Base ---------------------------------------------------------------
# Pin to the Node major the project targets (@types/node ^20).
FROM node:20-alpine AS base
# Prisma needs libc compatibility on Alpine.
RUN apk add --no-cache libc6-compat
WORKDIR /app
# Enable pnpm via corepack (project uses pnpm — never npm).
RUN corepack enable

# ---- Dependencies -------------------------------------------------------
FROM base AS deps
COPY package.json pnpm-lock.yaml* ./
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# ---- Builder ------------------------------------------------------------
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# `pnpm build` runs `prisma generate && next build`.
# A DATABASE_URL is only needed at runtime, not for the build, but Prisma's
# datasource block requires the env to exist — a dummy value is fine here.
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

# ---- Runner -------------------------------------------------------------
FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

# Standalone output bundles the server + traced node_modules.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Prisma artifacts needed at runtime: the generated client (traced into
# standalone automatically) plus the schema for `prisma db push` on startup.
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.bin/prisma ./node_modules/.bin/prisma

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["node", "server.js"]
