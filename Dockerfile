# Multi-stage build for Master Order application
FROM node:20-alpine AS build
# Never let npm download Puppeteer's bundled Chrome (~600MB per install, fills the
# Docker/Unraid disk); the production stage uses Alpine's system Chromium instead.
ENV PUPPETEER_SKIP_DOWNLOAD=true

# Install dependencies needed for sqlite3 and other native modules
RUN apk add --no-cache python3 make g++

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY server/package*.json ./server/
COPY client/package*.json ./client/

# Install dependencies (install all deps, not just production)
RUN npm ci && npm cache clean --force
WORKDIR /app/server
RUN npm ci && npm cache clean --force
WORKDIR /app/client
RUN npm ci && npm cache clean --force

# Copy source code
WORKDIR /app
COPY . .

# Remove any .env files that might override Docker environment variables
RUN find . -name ".env*" -type f -delete || true

# Setup schema and generate Prisma client for production (PostgreSQL)
# Note: This only sets up the schema files, no database connection during build
WORKDIR /app/server
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder"
RUN npm run build:production

# Build client
WORKDIR /app/client
RUN npm run build

# Production stage
FROM node:20-alpine AS production
# Never let npm download Puppeteer's bundled Chrome (~600MB per install, fills the
# Docker/Unraid disk); the production stage uses Alpine's system Chromium instead.
ENV PUPPETEER_SKIP_DOWNLOAD=true

# Install runtime dependencies including Chrome for Puppeteer
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    sqlite \
    curl \
    su-exec \
    postgresql-client \
    netcat-openbsd \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    ffmpeg \
    && rm -rf /var/cache/apk/*

# Create app directory
WORKDIR /app

# Copy package files first for better caching
COPY --from=build /app/package*.json ./
COPY --from=build /app/server/package*.json ./server/

# Install production dependencies
RUN npm ci --omit=dev && npm cache clean --force
WORKDIR /app/server
RUN npm ci --omit=dev && npm cache clean --force

# Create non-root user
WORKDIR /app
RUN addgroup -g 1001 -S nodejs && \
    adduser -S app -u 1001

# Copy built application
COPY --from=build --chown=app:nodejs /app/server ./server
COPY --from=build --chown=app:nodejs /app/client/dist ./client/dist
COPY --from=build --chown=app:nodejs /app/package*.json ./
COPY --from=build --chown=app:nodejs /app/start.js ./start.js
COPY --chown=app:nodejs ./docker-entrypoint.sh ./docker-entrypoint.sh

# Copy migration recovery script
COPY --from=build --chown=app:nodejs /app/server/fix-failed-migration.js ./server/fix-failed-migration.js

# Ensure Prisma files are copied (schema and migrations)
COPY --from=build --chown=app:nodejs /app/server/prisma ./server/prisma

# Make entrypoint executable
RUN chmod +x ./docker-entrypoint.sh

# Create data directories with proper permissions
RUN mkdir -p /app/data /app/server/artwork-cache /app/server/temp-uploads /app/server/guidebooks /app/logs && \
    chown -R app:nodejs /app/data /app/server/artwork-cache /app/server/temp-uploads /app/server/guidebooks /app/logs && \
    chmod -R 755 /app/data /app/server/artwork-cache /app/server/temp-uploads /app/server/guidebooks /app/logs

# Set up environment
ENV NODE_ENV=production
ENV PORT=3001
# Set Puppeteer to use system-installed Chromium
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3001/api/health || exit 1

# Don't switch to non-root user yet - let entrypoint handle permissions
# USER app

# Start the application (entrypoint will handle user switching)
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["npm", "start"]
