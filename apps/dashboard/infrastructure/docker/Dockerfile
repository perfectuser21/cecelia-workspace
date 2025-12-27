FROM node:20-alpine

# Install Playwright dependencies
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# Set Playwright to use system chromium
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 \
    PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY collector/package*.json ./collector/

# Install dependencies
RUN npm ci --only=production

# Copy TypeScript config and source
COPY collector/tsconfig.json ./collector/
COPY collector/src ./collector/src

# Build TypeScript
RUN npm run collector:build

# Remove dev dependencies and source after build
RUN rm -rf collector/src collector/tsconfig.json

# Set environment
ENV NODE_ENV=production \
    PORT=3000

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Run the application
CMD ["node", "collector/dist/server.js"]
