# Deployment Architecture - NextJS Stripe Payment Template

## 1. Leaseweb Cloud Infrastructure

### 1.1 Infrastructure Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        LEASEWEB CLOUD                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐    ┌─────────────────┐    ┌──────────────┐ │
│  │  Load Balancer  │    │   Web Servers   │    │  Database    │ │
│  │                 │    │                 │    │   Cluster    │ │
│  │ • Nginx/HAProxy │    │ • Docker        │    │ • PostgreSQL │ │
│  │ • SSL Termination│   │ • Node.js App   │    │ • Read Replica│ │
│  │ • Rate Limiting │    │ • Health Checks │    │ • Backups    │ │
│  │ • DDoS Protection│   │ • Auto-scaling  │    │ • Monitoring │ │
│  └─────────────────┘    └─────────────────┘    └──────────────┘ │
│           │                       │                      │      │
│           └───────────────────────┼──────────────────────┘      │
│                                   │                             │
│  ┌─────────────────┐    ┌─────────────────┐    ┌──────────────┐ │
│  │     Redis       │    │  File Storage   │    │  Monitoring  │ │
│  │                 │    │                 │    │              │ │
│  │ • Session Store │    │ • Digital Assets│    │ • Logs       │ │
│  │ • Cache Layer   │    │ • CDN Origins   │    │ • Metrics    │ │
│  │ • Rate Limits   │    │ • Backups       │    │ • Alerts     │ │
│  │ • Pub/Sub       │    │ • Encryption    │    │ • Uptime     │ │
│  └─────────────────┘    └─────────────────┘    └──────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Server Specifications

```yaml
# Production Environment Specifications
Production:
  Load Balancer:
    Instance: Leaseweb VPS M
    CPU: 2 vCPU
    RAM: 4 GB
    Storage: 80 GB NVMe
    Bandwidth: 1 Gbps
    
  Application Servers (2x instances):
    Instance: Leaseweb VPS L  
    CPU: 4 vCPU
    RAM: 8 GB
    Storage: 160 GB NVMe
    Bandwidth: 1 Gbps
    Docker: Latest LTS
    
  Database Server:
    Instance: Leaseweb VPS XL
    CPU: 6 vCPU  
    RAM: 16 GB
    Storage: 320 GB NVMe
    Bandwidth: 1 Gbps
    PostgreSQL: 15+
    
  Redis Cache:
    Instance: Leaseweb VPS M
    CPU: 2 vCPU
    RAM: 4 GB
    Storage: 80 GB NVMe
    Redis: 7+

# Staging Environment
Staging:
  All-in-One:
    Instance: Leaseweb VPS M
    CPU: 2 vCPU
    RAM: 4 GB  
    Storage: 80 GB NVMe
    Services: App + DB + Redis
```

## 2. Docker Container Architecture

### 2.1 Multi-Stage Dockerfile

```dockerfile
# syntax=docker/dockerfile:1
FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json package-lock.json* ./
RUN \
  if [ -f package-lock.json ]; then npm ci --only=production; \
  else echo "Lockfile not found." && exit 1; \
  fi

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Environment variables for build
ARG DATABASE_URL
ARG STRIPE_PUBLISHABLE_KEY
ARG STRIPE_SECRET_KEY
ARG NEXTAUTH_SECRET
ARG NEXTAUTH_URL

ENV DATABASE_URL=$DATABASE_URL
ENV STRIPE_PUBLISHABLE_KEY=$STRIPE_PUBLISHABLE_KEY
ENV STRIPE_SECRET_KEY=$STRIPE_SECRET_KEY
ENV NEXTAUTH_SECRET=$NEXTAUTH_SECRET
ENV NEXTAUTH_URL=$NEXTAUTH_URL

# Generate Prisma client
RUN npx prisma generate

# Build the application
RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Automatically leverage output traces to reduce image size
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

CMD ["node", "server.js"]
```

### 2.2 Docker Compose Configuration

```yaml
# docker-compose.yml
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
      args:
        - DATABASE_URL=${DATABASE_URL}
        - STRIPE_PUBLISHABLE_KEY=${STRIPE_PUBLISHABLE_KEY}
        - STRIPE_SECRET_KEY=${STRIPE_SECRET_KEY}
        - NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
        - NEXTAUTH_URL=${NEXTAUTH_URL}
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
      - STRIPE_WEBHOOK_SECRET=${STRIPE_WEBHOOK_SECRET}
    depends_on:
      - postgres
      - redis
    restart: unless-stopped
    networks:
      - app-network
    volumes:
      - ./uploads:/app/uploads
      - ./logs:/app/logs

  postgres:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=${POSTGRES_DB}
      - POSTGRES_USER=${POSTGRES_USER}
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backups:/backups
    restart: unless-stopped
    networks:
      - app-network
    command: >
      postgres
      -c shared_preload_libraries=pg_stat_statements
      -c pg_stat_statements.track=all
      -c max_connections=100
      -c shared_buffers=256MB
      -c effective_cache_size=1GB
      -c work_mem=4MB
      -c maintenance_work_mem=64MB

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
      - ./redis.conf:/usr/local/etc/redis/redis.conf
    restart: unless-stopped
    networks:
      - app-network
    command: redis-server /usr/local/etc/redis/redis.conf

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
      - ./static:/var/www/static
    depends_on:
      - app
    restart: unless-stopped
    networks:
      - app-network

volumes:
  postgres_data:
  redis_data:

networks:
  app-network:
    driver: bridge
```

## 3. CI/CD Pipeline Architecture

### 3.1 GitHub Actions Workflow

```yaml
# .github/workflows/deploy.yml
name: Deploy to Leaseweb

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: test
          POSTGRES_USER: test
          POSTGRES_DB: test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432
          
      redis:
        image: redis:7
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 6379:6379

    steps:
    - uses: actions/checkout@v4
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run linting
      run: npm run lint
    
    - name: Run type checking
      run: npm run type-check
    
    - name: Generate Prisma client
      run: npx prisma generate
      env:
        DATABASE_URL: postgresql://test:test@localhost:5432/test
    
    - name: Run database migrations
      run: npx prisma migrate deploy
      env:
        DATABASE_URL: postgresql://test:test@localhost:5432/test
    
    - name: Run unit tests
      run: npm run test
      env:
        DATABASE_URL: postgresql://test:test@localhost:5432/test
        REDIS_URL: redis://localhost:6379
    
    - name: Run E2E tests
      run: npm run test:e2e
      env:
        DATABASE_URL: postgresql://test:test@localhost:5432/test
        REDIS_URL: redis://localhost:6379

  security-scan:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4
    
    - name: Run security audit
      run: npm audit --audit-level high
    
    - name: Run CodeQL Analysis
      uses: github/codeql-action/init@v2
      with:
        languages: javascript
    
    - name: Perform CodeQL Analysis
      uses: github/codeql-action/analyze@v2

  build:
    needs: [test, security-scan]
    runs-on: ubuntu-latest
    
    permissions:
      contents: read
      packages: write
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Log in to Container Registry
      uses: docker/login-action@v3
      with:
        registry: ${{ env.REGISTRY }}
        username: ${{ github.actor }}
        password: ${{ secrets.GITHUB_TOKEN }}
    
    - name: Extract metadata
      id: meta
      uses: docker/metadata-action@v5
      with:
        images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
        tags: |
          type=ref,event=branch
          type=ref,event=pr
          type=sha,prefix={{branch}}-
    
    - name: Build and push Docker image
      uses: docker/build-push-action@v5
      with:
        context: .
        push: true
        tags: ${{ steps.meta.outputs.tags }}
        labels: ${{ steps.meta.outputs.labels }}
        build-args: |
          DATABASE_URL=${{ secrets.DATABASE_URL }}
          STRIPE_PUBLISHABLE_KEY=${{ secrets.STRIPE_PUBLISHABLE_KEY }}
          STRIPE_SECRET_KEY=${{ secrets.STRIPE_SECRET_KEY }}
          NEXTAUTH_SECRET=${{ secrets.NEXTAUTH_SECRET }}
          NEXTAUTH_URL=${{ secrets.NEXTAUTH_URL }}

  deploy-staging:
    needs: build
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    environment: staging
    
    steps:
    - name: Deploy to Staging
      uses: appleboy/ssh-action@v1.0.0
      with:
        host: ${{ secrets.STAGING_HOST }}
        username: ${{ secrets.STAGING_USER }}
        key: ${{ secrets.STAGING_SSH_KEY }}
        script: |
          cd /opt/stripe-template
          docker-compose pull
          docker-compose up -d
          docker system prune -f
    
    - name: Run smoke tests
      run: |
        sleep 30
        curl -f https://staging.yourapp.com/api/health || exit 1
        curl -f https://staging.yourapp.com/ || exit 1

  deploy-production:
    needs: [build, deploy-staging]
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    environment: production
    
    steps:
    - name: Deploy to Production
      uses: appleboy/ssh-action@v1.0.0
      with:
        host: ${{ secrets.PRODUCTION_HOST }}
        username: ${{ secrets.PRODUCTION_USER }}
        key: ${{ secrets.PRODUCTION_SSH_KEY }}
        script: |
          cd /opt/stripe-template
          
          # Blue-green deployment
          docker-compose -f docker-compose.prod.yml pull
          docker-compose -f docker-compose.prod.yml up -d --no-deps app-green
          
          # Health check
          sleep 30
          if curl -f http://localhost:3001/api/health; then
            # Switch traffic to green
            docker-compose -f docker-compose.prod.yml up -d nginx
            sleep 10
            # Stop blue instance
            docker-compose -f docker-compose.prod.yml stop app-blue
            docker-compose -f docker-compose.prod.yml rm -f app-blue
            # Rename green to blue for next deployment
            docker-compose -f docker-compose.prod.yml up -d app-blue
            docker-compose -f docker-compose.prod.yml stop app-green
          else
            echo "Health check failed, rolling back"
            docker-compose -f docker-compose.prod.yml stop app-green
            exit 1
          fi
    
    - name: Verify deployment
      run: |
        sleep 30
        curl -f https://yourapp.com/api/health || exit 1
        curl -f https://yourapp.com/ || exit 1
    
    - name: Notify deployment
      uses: 8398a7/action-slack@v3
      with:
        status: ${{ job.status }}
        channel: '#deployments'
        webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

### 3.2 Deployment Scripts

```bash
#!/bin/bash
# deploy.sh - Production deployment script

set -e

echo "🚀 Starting deployment to Leaseweb..."

# Configuration
COMPOSE_FILE="docker-compose.prod.yml"
APP_DIR="/opt/stripe-template"
BACKUP_DIR="/opt/backups"
LOG_FILE="/var/log/deployment.log"

# Function to log with timestamp
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a $LOG_FILE
}

# Function to perform database backup
backup_database() {
    log "Creating database backup..."
    BACKUP_FILE="$BACKUP_DIR/backup_$(date +%Y%m%d_%H%M%S).sql"
    docker exec postgres pg_dump -U $POSTGRES_USER $POSTGRES_DB > $BACKUP_FILE
    log "Database backup created: $BACKUP_FILE"
}

# Function to run database migrations
run_migrations() {
    log "Running database migrations..."
    docker-compose -f $COMPOSE_FILE exec app npx prisma migrate deploy
    log "Database migrations completed"
}

# Function to perform health check
health_check() {
    local url=$1
    local retries=30
    local count=0
    
    log "Performing health check on $url..."
    
    while [ $count -lt $retries ]; do
        if curl -f -s $url > /dev/null; then
            log "Health check passed"
            return 0
        fi
        
        count=$((count + 1))
        sleep 2
    done
    
    log "Health check failed after $retries attempts"
    return 1
}

# Main deployment process
main() {
    cd $APP_DIR
    
    # Create backup
    backup_database
    
    # Pull latest images
    log "Pulling latest Docker images..."
    docker-compose -f $COMPOSE_FILE pull
    
    # Start green instance (blue-green deployment)
    log "Starting new application instance..."
    docker-compose -f $COMPOSE_FILE up -d --no-deps app-green
    
    # Wait for application to start
    sleep 30
    
    # Run migrations on new instance
    run_migrations
    
    # Health check
    if health_check "http://localhost:3001/api/health"; then
        log "Switching traffic to new instance..."
        
        # Update nginx configuration to point to green
        docker-compose -f $COMPOSE_FILE up -d nginx
        sleep 10
        
        # Stop old instance
        log "Stopping old application instance..."
        docker-compose -f $COMPOSE_FILE stop app-blue
        docker-compose -f $COMPOSE_FILE rm -f app-blue
        
        # Rename green to blue for next deployment
        docker rename $(docker-compose -f $COMPOSE_FILE ps -q app-green) app-blue
        
        # Final health check
        if health_check "https://yourapp.com/api/health"; then
            log "✅ Deployment completed successfully"
        else
            log "❌ Final health check failed"
            exit 1
        fi
    else
        log "❌ Health check failed, rolling back..."
        docker-compose -f $COMPOSE_FILE stop app-green
        docker-compose -f $COMPOSE_FILE rm -f app-green
        exit 1
    fi
    
    # Cleanup old images
    log "Cleaning up old Docker images..."
    docker system prune -f
    
    log "🎉 Deployment completed successfully!"
}

# Run main function
main "$@"
```

## 4. Load Balancer Configuration

### 4.1 Nginx Configuration

```nginx
# nginx.conf
user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log notice;
pid /var/run/nginx.pid;

events {
    worker_connections 1024;
    use epoll;
    multi_accept on;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;
    
    # Logging
    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';
    
    access_log /var/log/nginx/access.log main;
    
    # Basic Settings
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    client_max_body_size 10M;
    
    # Gzip Settings
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/json
        application/javascript
        application/xml+rss
        application/atom+xml
        image/svg+xml;
    
    # Rate Limiting
    limit_req_zone $binary_remote_addr zone=general:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=auth:10m rate=5r/m;
    limit_req_zone $binary_remote_addr zone=api:10m rate=30r/m;
    
    # SSL Configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES128-SHA256:ECDHE-RSA-AES256-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;
    ssl_session_tickets off;
    
    # Security Headers
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' https:; connect-src 'self' https://api.stripe.com; frame-src https://js.stripe.com https://hooks.stripe.com;" always;
    
    # Upstream servers
    upstream app {
        least_conn;
        server app-1:3000 max_fails=3 fail_timeout=30s;
        server app-2:3000 max_fails=3 fail_timeout=30s;
        keepalive 32;
    }
    
    # HTTP to HTTPS redirect
    server {
        listen 80;
        server_name _;
        return 301 https://$host$request_uri;
    }
    
    # HTTPS server
    server {
        listen 443 ssl http2;
        server_name yourapp.com www.yourapp.com;
        
        ssl_certificate /etc/nginx/ssl/cert.pem;
        ssl_certificate_key /etc/nginx/ssl/key.pem;
        
        # Static files
        location /_next/static/ {
            alias /var/www/static/_next/static/;
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
        
        location /static/ {
            alias /var/www/static/;
            expires 1M;
            add_header Cache-Control "public";
        }
        
        # API routes with rate limiting
        location /api/auth/ {
            limit_req zone=auth burst=10 nodelay;
            proxy_pass http://app;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
        }
        
        location /api/ {
            limit_req zone=api burst=50 nodelay;
            proxy_pass http://app;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
        }
        
        # Main application
        location / {
            limit_req zone=general burst=20 nodelay;
            proxy_pass http://app;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
        }
        
        # Health check endpoint
        location /health {
            proxy_pass http://app/api/health;
            access_log off;
        }
    }
}
```

## 5. Monitoring & Observability

### 5.1 Health Check Implementation

```typescript
// app/api/health/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { redis } from '@/lib/redis'

export async function GET() {
  const checks = {
    timestamp: new Date().toISOString(),
    status: 'ok',
    version: process.env.npm_package_version || 'unknown',
    environment: process.env.NODE_ENV,
    uptime: process.uptime(),
    checks: {
      database: 'unknown',
      redis: 'unknown',
      stripe: 'unknown'
    }
  }
  
  // Database health check
  try {
    await prisma.$queryRaw`SELECT 1`
    checks.checks.database = 'healthy'
  } catch (error) {
    checks.checks.database = 'unhealthy'
    checks.status = 'degraded'
  }
  
  // Redis health check
  try {
    await redis.ping()
    checks.checks.redis = 'healthy'
  } catch (error) {
    checks.checks.redis = 'unhealthy'
    checks.status = 'degraded'
  }
  
  // Stripe health check (basic)
  try {
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
    await stripe.accounts.retrieve()
    checks.checks.stripe = 'healthy'
  } catch (error) {
    checks.checks.stripe = 'unhealthy'
    checks.status = 'degraded'
  }
  
  const statusCode = checks.status === 'ok' ? 200 : 503
  
  return NextResponse.json(checks, { status: statusCode })
}
```

### 5.2 Monitoring Stack

```yaml
# monitoring/docker-compose.yml
version: '3.8'

services:
  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.console.libraries=/etc/prometheus/console_libraries'
      - '--web.console.templates=/etc/prometheus/consoles'
      - '--storage.tsdb.retention.time=200h'
      - '--web.enable-lifecycle'
    restart: unless-stopped

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3001:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    volumes:
      - grafana_data:/var/lib/grafana
      - ./grafana/provisioning:/etc/grafana/provisioning
    restart: unless-stopped

  node-exporter:
    image: prom/node-exporter:latest
    ports:
      - "9100:9100"
    volumes:
      - /proc:/host/proc:ro
      - /sys:/host/sys:ro
      - /:/rootfs:ro
    command:
      - '--path.procfs=/host/proc'
      - '--path.rootfs=/rootfs'
      - '--path.sysfs=/host/sys'
      - '--collector.filesystem.mount-points-exclude=^/(sys|proc|dev|host|etc)($$|/)'
    restart: unless-stopped

  alertmanager:
    image: prom/alertmanager:latest
    ports:
      - "9093:9093"
    volumes:
      - ./alertmanager.yml:/etc/alertmanager/alertmanager.yml
    restart: unless-stopped

volumes:
  prometheus_data:
  grafana_data:
```

## 6. Backup & Disaster Recovery

### 6.1 Automated Backup Strategy

```bash
#!/bin/bash
# backup.sh - Automated backup script

set -e

# Configuration
BACKUP_DIR="/opt/backups"
RETENTION_DAYS=30
DATABASE_URL="${DATABASE_URL}"
S3_BUCKET="${BACKUP_S3_BUCKET}"

# Create timestamped backup
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/db_backup_$TIMESTAMP.sql"
UPLOAD_DIR="$BACKUP_DIR/uploads_$TIMESTAMP.tar.gz"

# Database backup
echo "Creating database backup..."
docker exec postgres pg_dump $DATABASE_URL > $BACKUP_FILE

# File uploads backup
echo "Creating uploads backup..."
tar -czf $UPLOAD_DIR /opt/stripe-template/uploads

# Compress database backup
gzip $BACKUP_FILE

# Upload to S3 (if configured)
if [ ! -z "$S3_BUCKET" ]; then
    echo "Uploading to S3..."
    aws s3 cp $BACKUP_FILE.gz s3://$S3_BUCKET/database/
    aws s3 cp $UPLOAD_DIR s3://$S3_BUCKET/uploads/
fi

# Cleanup old backups
echo "Cleaning up old backups..."
find $BACKUP_DIR -name "*.gz" -mtime +$RETENTION_DAYS -delete

echo "Backup completed successfully"
```

### 6.2 Disaster Recovery Plan

```yaml
# Disaster Recovery Procedures

RTO (Recovery Time Objective): 4 hours
RPO (Recovery Point Objective): 1 hour

Recovery Steps:
  1. Infrastructure Recovery:
     - Provision new Leaseweb instances
     - Configure networking and security groups
     - Install Docker and required services
     
  2. Data Recovery:
     - Restore database from latest backup
     - Restore file uploads from backup
     - Verify data integrity
     
  3. Application Recovery:
     - Deploy latest application version
     - Run database migrations if needed
     - Update DNS records
     - Configure SSL certificates
     
  4. Verification:
     - Run health checks
     - Test critical user flows
     - Monitor application metrics
     - Notify stakeholders

Backup Schedule:
  - Database: Every hour
  - Files: Every 4 hours  
  - Full system: Daily
  - Off-site replication: Real-time
```

This comprehensive deployment architecture ensures reliable, scalable, and maintainable deployment of the NextJS Stripe Payment Template on Leaseweb infrastructure with proper CI/CD pipelines, monitoring, and disaster recovery capabilities.