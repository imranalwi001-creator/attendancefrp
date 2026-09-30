# ==============================================================================
# STAGE 1: Build Frontend Assets
# ==============================================================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency definition files
COPY package*.json bun.lock* ./

# Install dependencies cleanly
RUN npm ci --legacy-peer-deps || npm install --legacy-peer-deps

# Copy application source code
COPY . .

# Set environment variables for production build
ENV NODE_ENV=production
ENV VITE_ENABLE_PWA=true

# Build production bundle
RUN npm run build

# ==============================================================================
# STAGE 2: Lightweight Production Nginx Runner
# ==============================================================================
FROM nginx:1.25-alpine AS runner

# Remove default nginx static assets
RUN rm -rf /usr/share/nginx/html/*

# Copy built production assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy optimized nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose HTTP port
EXPOSE 80

# Run nginx in foreground
CMD ["nginx", "-g", "daemon off;"]
