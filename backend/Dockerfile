# syntax=docker/dockerfile:1

# -------------------------------------------------------------
# Stage 1: Build & Dependencies
# -------------------------------------------------------------
FROM node:22-alpine AS builder

WORKDIR /app

# Copy dependency manifests
COPY package.json package-lock.json ./

# Install production dependencies only with clean npm ci
RUN npm ci --omit=dev

# -------------------------------------------------------------
# Stage 2: Minimal Production Runtime
# -------------------------------------------------------------
FROM node:22-alpine AS runner

WORKDIR /app

# Build arguments for image provenance and version tracking
ARG APP_VERSION=1.0.0
ARG GIT_SHA=dev

# Runtime environment configuration
ENV NODE_ENV=production \
    PORT=3000 \
    APP_VERSION=${APP_VERSION} \
    GIT_SHA=${GIT_SHA}

# Install curl for reliable container healthchecks
RUN apk add --no-cache curl

# Copy production node_modules from builder stage
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json ./

# Copy application source code, migrations, seeds, and entrypoint
COPY --chown=node:node src/ ./src/
COPY --chown=node:node migrations/ ./migrations/
COPY --chown=node:node seeds/ ./seeds/
COPY --chown=node:node docker-entrypoint.sh ./

RUN chmod +x docker-entrypoint.sh

# INTERVIEW NOTE ON SECURITY:
# Never run containers as root (UID 0). Running as 'node' (UID 1000) prevents
# privilege escalation and host filesystem compromise if the container is breached.
USER node

EXPOSE 3000

# Container healthcheck testing the liveness probe endpoint
HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "src/server.js"]
