# syntax=docker/dockerfile:1

# -------------------------------------------------------------
# Stage 1: Build React static bundle
# -------------------------------------------------------------
FROM node:22-alpine AS builder

WORKDIR /app

# Copy dependency manifests
COPY package.json package-lock.json ./

# Install dependencies cleanly
RUN npm ci

# Copy frontend source and build static artifacts
COPY . .
RUN npm run build

# -------------------------------------------------------------
# Stage 2: Caddy Production Web Server & Reverse Proxy
# -------------------------------------------------------------
FROM caddy:2.8-alpine AS runner

# Create non-root user and group
RUN addgroup -g 1000 caddy && \
    adduser -D -u 1000 -G caddy caddy && \
    mkdir -p /srv /data /config /etc/caddy && \
    chown -R caddy:caddy /srv /data /config /etc/caddy

# Copy static assets from builder stage
COPY --from=builder --chown=caddy:caddy /app/dist /srv

# Copy Caddy configuration
COPY --chown=caddy:caddy Caddyfile /etc/caddy/Caddyfile

# INTERVIEW NOTE ON SECURITY:
# Running the web server as non-root user (caddy, UID 1000) prevents
# privilege escalation attacks against the web tier.
USER caddy

EXPOSE 80 443

HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:80/ || exit 1

CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
