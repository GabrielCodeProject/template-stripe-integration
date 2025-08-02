# Complete Deployment Guide - NextJS Stripe Payment Template on Leaseweb

This comprehensive guide provides step-by-step instructions for deploying your NextJS Stripe Payment Template on Leaseweb infrastructure with production-ready security, monitoring, and automation.

## 🚀 Quick Start

### Prerequisites
- Leaseweb VPS account
- Domain name with DNS access
- Stripe account (test and live keys)
- GitHub repository access
- SSH key pair generated

### Minimum Server Requirements
- **Production**: Leaseweb VPS L (4 vCPU, 8GB RAM, 160GB NVMe)
- **Staging**: Leaseweb VPS M (2 vCPU, 4GB RAM, 80GB NVMe)
- **Monitoring**: Leaseweb VPS M (2 vCPU, 4GB RAM, 80GB NVMe)

## 📋 Step-by-Step Deployment

### Step 1: Server Setup

1. **Provision Leaseweb Server**
   ```bash
   # Connect to your new server
   ssh root@YOUR_SERVER_IP
   
   # Download and run the setup script
   wget https://raw.githubusercontent.com/yourusername/template-stripe-integration/main/scripts/setup-leaseweb.sh
   chmod +x setup-leaseweb.sh
   sudo ./setup-leaseweb.sh production your-domain.com
   ```

2. **Configure SSH Access**
   ```bash
   # Add your SSH public key to the deploy user
   sudo -u deploy mkdir -p /home/deploy/.ssh
   sudo -u deploy vim /home/deploy/.ssh/authorized_keys
   # Paste your public SSH key
   
   # Test SSH connection on new port (default: 2222)
   ssh -p 2222 deploy@YOUR_SERVER_IP
   ```

### Step 2: Environment Configuration

1. **Set up environment variables**
   ```bash
   # Clone your repository
   cd /opt/stripe-template
   git clone https://github.com/yourusername/template-stripe-integration.git .
   
   # Generate environment configuration
   ./scripts/env-setup.sh production
   
   # Edit production environment file
   vim .env.production
   ```

2. **Update key configuration values**
   ```env
   # Domain and URLs
   NEXTAUTH_URL=https://your-domain.com
   NEXT_PUBLIC_APP_URL=https://your-domain.com
   
   # Database (use production credentials)
   DATABASE_URL=postgresql://username:password@postgres:5432/stripe_template_prod
   
   # Stripe (use LIVE keys for production)
   STRIPE_PUBLISHABLE_KEY=pk_live_...
   STRIPE_SECRET_KEY=sk_live_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   
   # Email configuration
   SMTP_HOST=your-smtp-server.com
   SMTP_USER=your-email@domain.com
   SMTP_PASS=your-app-password
   ```

### Step 3: SSL Certificate Setup

1. **Configure Let's Encrypt SSL**
   ```bash
   # Set up SSL certificates
   sudo ./scripts/ssl-setup.sh your-domain.com admin@your-domain.com
   
   # Verify SSL configuration
   curl -I https://your-domain.com
   ```

### Step 4: Database Setup

1. **Initialize database**
   ```bash
   # Start database container
   docker-compose -f docker-compose.prod.yml up -d postgres redis
   
   # Wait for database to be ready
   sleep 30
   
   # Run database migrations
   docker run --rm --network stripe_template_prod_network \
     -e DATABASE_URL="$DATABASE_URL" \
     -v "${PWD}:/app" -w /app \
     node:18-alpine sh -c "npm ci --only=production && npx prisma migrate deploy"
   
   # Seed database (optional)
   docker run --rm --network stripe_template_prod_network \
     -e DATABASE_URL="$DATABASE_URL" \
     -v "${PWD}:/app" -w /app \
     node:18-alpine sh -c "npx prisma db seed"
   ```

### Step 5: Application Deployment

1. **Deploy application**
   ```bash
   # Deploy using the production deployment script
   ./scripts/deploy-production.sh
   ```

2. **Verify deployment**
   ```bash
   # Run deployment verification
   ./scripts/verify-deployment.sh --url https://your-domain.com --verbose
   ```

### Step 6: Monitoring Setup

1. **Deploy monitoring stack**
   ```bash
   # Set up monitoring (optional but recommended)
   cd monitoring
   docker-compose up -d
   
   # Access Grafana at https://your-domain.com:3001
   # Default credentials: admin / admin123 (change immediately)
   ```

2. **Configure alerts**
   ```bash
   # Edit alerting configuration
   vim monitoring/alertmanager.yml
   
   # Add your notification channels (Slack, email, etc.)
   ```

## 🔧 Configuration Details

### Environment Variables Reference

| Variable | Description | Example |
|----------|-------------|---------|
| `NODE_ENV` | Application environment | `production` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/db` |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` |
| `STRIPE_PUBLISHABLE_KEY` | Stripe publishable key | `pk_live_...` |
| `STRIPE_SECRET_KEY` | Stripe secret key | `sk_live_...` |
| `STRIPE_WEBHOOK_SECRET` | Webhook verification secret | `whsec_...` |
| `NEXTAUTH_SECRET` | NextAuth.js secret | Generated 32-char string |
| `NEXTAUTH_URL` | Application base URL | `https://your-domain.com` |

### Docker Compose Services

```yaml
# Production services architecture
services:
  nginx:      # Load balancer and SSL termination
  app-blue:   # Primary application instance
  app-green:  # Secondary instance for blue-green deployment
  postgres:   # PostgreSQL database
  redis:      # Redis cache and sessions
```

### Security Configuration

1. **Firewall Rules**
   ```bash
   # Default UFW configuration
   sudo ufw status verbose
   
   # Should show:
   # 22/tcp (SSH) - DENY
   # 2222/tcp (SSH) - ALLOW
   # 80/tcp (HTTP) - ALLOW
   # 443/tcp (HTTPS) - ALLOW
   ```

2. **SSL/TLS Settings**
   - TLS 1.2+ only
   - Strong cipher suites
   - HSTS headers enabled
   - Certificate auto-renewal

3. **Container Security**
   - Non-root containers
   - Resource limits
   - Security profiles
   - Network isolation

## 🔄 Ongoing Operations

### Daily Operations

1. **Monitor application health**
   ```bash
   # Check application status
   ./scripts/verify-deployment.sh --url https://your-domain.com
   
   # View logs
   docker-compose -f docker-compose.prod.yml logs -f --tail=50
   ```

2. **Database maintenance**
   ```bash
   # Create backup
   ./scripts/backup.sh database
   
   # Check database health
   docker exec postgres pg_isready -U postgres
   ```

### Weekly Operations

1. **Security updates**
   ```bash
   # Update system packages
   sudo apt update && sudo apt upgrade -y
   
   # Update Docker images
   docker-compose -f docker-compose.prod.yml pull
   
   # Deploy updates
   ./scripts/deploy-production.sh
   ```

2. **Security audit**
   ```bash
   # Run security audit
   sudo ./scripts/security-audit.sh --environment production
   ```

### Monthly Operations

1. **Comprehensive backup**
   ```bash
   # Full system backup
   ./scripts/backup.sh full
   ```

2. **Performance review**
   ```bash
   # Check system resources
   htop
   df -h
   free -h
   
   # Review monitoring dashboards
   # Access Grafana at https://your-domain.com:3001
   ```

## 🚨 Troubleshooting

### Common Issues

1. **Application won't start**
   ```bash
   # Check logs
   docker-compose -f docker-compose.prod.yml logs app-blue
   
   # Check environment variables
   docker exec app-blue printenv | grep -E "(DATABASE|STRIPE|NEXTAUTH)"
   
   # Test database connection
   docker exec postgres pg_isready -U postgres
   ```

2. **SSL certificate issues**
   ```bash
   # Check certificate status
   ./scripts/ssl-setup.sh --info
   
   # Renew certificate manually
   sudo ./scripts/ssl-setup.sh your-domain.com admin@your-domain.com --force
   
   # Check nginx configuration
   docker exec nginx nginx -t
   ```

3. **High resource usage**
   ```bash
   # Check container resources
   docker stats
   
   # Check system resources
   htop
   iotop
   
   # Review logs for errors
   docker-compose -f docker-compose.prod.yml logs --tail=100
   ```

### Emergency Procedures

1. **Rollback deployment**
   ```bash
   # Automatic rollback is built into deployment script
   # Manual rollback:
   docker-compose -f docker-compose.prod.yml up -d app-blue
   docker-compose -f docker-compose.prod.yml stop app-green
   ```

2. **Restore from backup**
   ```bash
   # List available backups
   ./scripts/restore.sh list
   
   # Restore database
   ./scripts/restore.sh database /path/to/backup.sql.gz
   
   # Restore files
   ./scripts/restore.sh files /path/to/files.tar.gz
   ```

3. **Database recovery**
   ```bash
   # Stop application
   docker-compose -f docker-compose.prod.yml stop app-blue app-green
   
   # Restore database
   ./scripts/restore.sh database /opt/backups/latest-db-backup.sql.gz
   
   # Restart application
   docker-compose -f docker-compose.prod.yml up -d
   ```

## 📊 Monitoring and Alerts

### Key Metrics to Monitor

1. **Application Metrics**
   - Response time < 2 seconds
   - Error rate < 1%
   - Uptime > 99.9%
   - Memory usage < 80%

2. **Infrastructure Metrics**
   - CPU usage < 80%
   - Disk usage < 80%
   - Network latency < 100ms
   - SSL certificate expiry > 30 days

3. **Business Metrics**
   - Payment success rate > 98%
   - Active user sessions
   - Revenue tracking
   - Failed login attempts

### Alert Configuration

```yaml
# Example alert rules (monitoring/alerts.yml)
groups:
  - name: critical
    rules:
      - alert: ApplicationDown
        expr: up{job="stripe-template-app"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Application is down"
          
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.01
        for: 2m
        labels:
          severity: high
        annotations:
          summary: "High error rate detected"
```

## 🔐 Security Best Practices

### Access Control
- Use SSH keys only (no passwords)
- Implement least privilege principle
- Regular access reviews
- Multi-factor authentication where possible

### Data Protection
- All sensitive data encrypted at rest
- TLS 1.2+ for data in transit
- Regular security updates
- PCI DSS compliance for payment data

### Monitoring and Logging
- Centralized log collection
- Real-time security monitoring
- Automated threat detection
- Incident response procedures

## 📞 Support and Maintenance

### Contact Information
- **Technical Support**: devops@yourcompany.com
- **Security Issues**: security@yourcompany.com
- **Emergency**: +1-XXX-XXX-XXXX

### Maintenance Schedule
- **System Updates**: First Sunday of each month, 2:00 AM UTC
- **Security Patches**: As needed (within 48 hours)
- **Backup Verification**: Weekly
- **Security Audits**: Quarterly

### Documentation Updates
This guide should be updated whenever:
- Infrastructure changes are made
- New security requirements are implemented
- Deployment procedures are modified
- Monitoring configurations change

---

## 📚 Additional Resources

- [Leaseweb Documentation](https://www.leaseweb.com/help)
- [Stripe Integration Guide](https://stripe.com/docs)
- [NextJS Deployment Documentation](https://nextjs.org/docs/deployment)
- [Docker Security Best Practices](https://docs.docker.com/engine/security/)
- [Let's Encrypt Documentation](https://letsencrypt.org/docs/)

---

*This deployment guide is maintained by the DevOps team. Last updated: $(date)*