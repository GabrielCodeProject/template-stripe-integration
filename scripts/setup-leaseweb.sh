#!/bin/bash

# Leaseweb Server Setup Script for Stripe Payment Template
# Configures a fresh Leaseweb VPS for production deployment

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_TYPE=${1:-production}  # production, staging, or monitoring
DOMAIN_NAME=${2:-""}
SETUP_TYPE=${SETUP_TYPE:-complete}  # complete, docker-only, monitoring-only

# Configuration
SSH_PORT=${SSH_PORT:-22}
NEW_SSH_PORT=${NEW_SSH_PORT:-2222}
DOCKER_VERSION="24.0"
DOCKER_COMPOSE_VERSION="2.21.0"
NODE_VERSION="18"
FAIL2BAN_ENABLED=${FAIL2BAN_ENABLED:-true}
UFW_ENABLED=${UFW_ENABLED:-true}
AUTO_UPDATES_ENABLED=${AUTO_UPDATES_ENABLED:-true}
SWAP_SIZE=${SWAP_SIZE:-2G}

# User configuration
DEPLOY_USER=${DEPLOY_USER:-deploy}
MONITORING_USER=${MONITORING_USER:-monitoring}

# Function to print colored output
print_status() {
    local color=$1
    local message=$2
    echo -e "${color}[$(date '+%Y-%m-%d %H:%M:%S')] ${message}${NC}"
}

# Function to log messages
log_message() {
    local level=$1
    local message=$2
    
    case $level in
        ERROR)
            print_status $RED "$message"
            ;;
        WARN)
            print_status $YELLOW "$message"
            ;;
        INFO)
            print_status $BLUE "$message"
            ;;
        SUCCESS)
            print_status $GREEN "$message"
            ;;
    esac
}

# Function to check if running as root
check_root() {
    if [ "$EUID" -ne 0 ]; then
        log_message "ERROR" "This script must be run as root"
        log_message "INFO" "Please run: sudo $0 $@"
        exit 1
    fi
}

# Function to detect OS
detect_os() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS=$NAME
        VER=$VERSION_ID
    else
        log_message "ERROR" "Cannot detect OS version"
        exit 1
    fi
    
    log_message "INFO" "Detected OS: $OS $VER"
    
    # Ensure we're on a supported OS
    case $OS in
        "Ubuntu"|"Debian GNU/Linux")
            log_message "SUCCESS" "Supported OS detected"
            ;;
        *)
            log_message "ERROR" "Unsupported OS: $OS"
            log_message "INFO" "This script supports Ubuntu and Debian only"
            exit 1
            ;;
    esac
}

# Function to update system packages
update_system() {
    log_message "INFO" "Updating system packages..."
    
    export DEBIAN_FRONTEND=noninteractive
    
    apt-get update
    apt-get upgrade -y
    apt-get install -y \
        curl \
        wget \
        git \
        unzip \
        software-properties-common \
        apt-transport-https \
        ca-certificates \
        gnupg \
        lsb-release \
        htop \
        nano \
        vim \
        tree \
        jq \
        bc \
        net-tools \
        dnsutils \
        telnet \
        tcpdump \
        iotop \
        iftop \
        ncdu \
        rsync \
        cron \
        logrotate \
        fail2ban \
        ufw
    
    log_message "SUCCESS" "System packages updated"
}

# Function to configure automatic security updates
configure_auto_updates() {
    if [ "$AUTO_UPDATES_ENABLED" != "true" ]; then
        log_message "INFO" "Automatic updates disabled"
        return 0
    fi
    
    log_message "INFO" "Configuring automatic security updates..."
    
    apt-get install -y unattended-upgrades
    
    cat > /etc/apt/apt.conf.d/20auto-upgrades << 'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
EOF
    
    cat > /etc/apt/apt.conf.d/50unattended-upgrades << 'EOF'
Unattended-Upgrade::Allowed-Origins {
    "${distro_id}:${distro_codename}-security";
    "${distro_id}ESMApps:${distro_codename}-apps-security";
    "${distro_id}ESM:${distro_codename}-infra-security";
};
Unattended-Upgrade::Remove-Unused-Kernel-Packages "true";
Unattended-Upgrade::Remove-Unused-Dependencies "true";
Unattended-Upgrade::Automatic-Reboot "false";
EOF
    
    systemctl enable unattended-upgrades
    systemctl start unattended-upgrades
    
    log_message "SUCCESS" "Automatic security updates configured"
}

# Function to create swap space
create_swap() {
    log_message "INFO" "Configuring swap space..."
    
    # Check if swap already exists
    if swapon --show | grep -q swap; then
        log_message "INFO" "Swap already configured"
        return 0
    fi
    
    # Create swap file
    fallocate -l $SWAP_SIZE /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    
    # Make swap permanent
    echo '/swapfile none swap sw 0 0' >> /etc/fstab
    
    # Configure swap settings
    echo 'vm.swappiness=10' >> /etc/sysctl.conf
    echo 'vm.vfs_cache_pressure=50' >> /etc/sysctl.conf
    
    log_message "SUCCESS" "Swap space created: $SWAP_SIZE"
}

# Function to configure firewall
configure_firewall() {
    if [ "$UFW_ENABLED" != "true" ]; then
        log_message "INFO" "UFW firewall disabled"
        return 0
    fi
    
    log_message "INFO" "Configuring UFW firewall..."
    
    # Reset UFW to defaults
    ufw --force reset
    
    # Set default policies
    ufw default deny incoming
    ufw default allow outgoing
    
    # Allow SSH (current port)
    ufw allow $SSH_PORT/tcp comment "SSH current"
    
    # Allow new SSH port if different
    if [ "$NEW_SSH_PORT" != "$SSH_PORT" ]; then
        ufw allow $NEW_SSH_PORT/tcp comment "SSH new"
    fi
    
    # Allow HTTP and HTTPS
    ufw allow 80/tcp comment "HTTP"
    ufw allow 443/tcp comment "HTTPS"
    
    # Configure based on server type
    case $SERVER_TYPE in
        production|staging)
            # Application specific ports
            ufw allow from 10.0.0.0/8 to any port 3000 comment "App internal"
            ufw allow from 172.16.0.0/12 to any port 3000 comment "App internal"
            ufw allow from 192.168.0.0/16 to any port 3000 comment "App internal"
            ;;
        monitoring)
            # Monitoring ports
            ufw allow 9090/tcp comment "Prometheus"
            ufw allow 3001/tcp comment "Grafana"
            ufw allow 9093/tcp comment "AlertManager"
            ;;
    esac
    
    # Enable UFW
    ufw --force enable
    
    log_message "SUCCESS" "UFW firewall configured"
}

# Function to configure fail2ban
configure_fail2ban() {
    if [ "$FAIL2BAN_ENABLED" != "true" ]; then
        log_message "INFO" "Fail2ban disabled"
        return 0
    fi
    
    log_message "INFO" "Configuring fail2ban..."
    
    # Create local jail configuration
    cat > /etc/fail2ban/jail.local << EOF
[DEFAULT]
bantime = 1h
findtime = 10m
maxretry = 5
backend = systemd

[sshd]
enabled = true
port = $NEW_SSH_PORT
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
bantime = 24h

[nginx-http-auth]
enabled = true
filter = nginx-http-auth
logpath = /var/log/nginx/error.log
maxretry = 2

[nginx-noscript]
enabled = true
filter = nginx-noscript
logpath = /var/log/nginx/access.log
maxretry = 6

[nginx-badbots]
enabled = true
filter = nginx-badbots
logpath = /var/log/nginx/access.log
maxretry = 2

[nginx-noproxy]
enabled = true
filter = nginx-noproxy
logpath = /var/log/nginx/access.log
maxretry = 2
EOF
    
    # Start and enable fail2ban
    systemctl enable fail2ban
    systemctl restart fail2ban
    
    log_message "SUCCESS" "Fail2ban configured"
}

# Function to harden SSH configuration
harden_ssh() {
    log_message "INFO" "Hardening SSH configuration..."
    
    # Backup original configuration
    cp /etc/ssh/sshd_config /etc/ssh/sshd_config.backup
    
    # Create new SSH configuration
    cat > /etc/ssh/sshd_config << EOF
# SSH Configuration for Stripe Payment Template Server
Port $NEW_SSH_PORT
Protocol 2

# Authentication
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
AuthorizedKeysFile .ssh/authorized_keys
ChallengeResponseAuthentication no
UsePAM yes

# Security settings
X11Forwarding no
AllowAgentForwarding no
AllowTcpForwarding no
PermitTunnel no
PermitUserEnvironment no
ClientAliveInterval 300
ClientAliveCountMax 2
MaxAuthTries 3
MaxSessions 2
MaxStartups 10:30:60

# Restrict users
AllowUsers $DEPLOY_USER
DenyUsers root

# Logging
SyslogFacility AUTH
LogLevel VERBOSE

# Host key algorithms
HostKeyAlgorithms rsa-sha2-512,rsa-sha2-256,ecdsa-sha2-nistp256,ecdsa-sha2-nistp384,ecdsa-sha2-nistp521,ssh-ed25519

# Ciphers and MAC algorithms
Ciphers chacha20-poly1305@openssh.com,aes256-gcm@openssh.com,aes128-gcm@openssh.com,aes256-ctr,aes192-ctr,aes128-ctr
MACs hmac-sha2-256-etm@openssh.com,hmac-sha2-512-etm@openssh.com,hmac-sha2-256,hmac-sha2-512

# Key exchange algorithms
KexAlgorithms curve25519-sha256@libssh.org,ecdh-sha2-nistp521,ecdh-sha2-nistp384,ecdh-sha2-nistp256,diffie-hellman-group-exchange-sha256

# Banner
Banner /etc/ssh/banner
EOF
    
    # Create SSH banner
    cat > /etc/ssh/banner << 'EOF'
***************************************************************************
                    AUTHORIZED ACCESS ONLY
This system is for the use of authorized users only. Individuals using
this computer system without authority, or in excess of their authority,
are subject to having all of their activities on this system monitored
and recorded by system personnel.
***************************************************************************
EOF
    
    # Test SSH configuration
    sshd -t
    if [ $? -eq 0 ]; then
        log_message "SUCCESS" "SSH configuration validated"
    else
        log_message "ERROR" "SSH configuration invalid, restoring backup"
        cp /etc/ssh/sshd_config.backup /etc/ssh/sshd_config
        exit 1
    fi
}

# Function to create deploy user
create_deploy_user() {
    log_message "INFO" "Creating deploy user..."
    
    # Create user if doesn't exist
    if ! id "$DEPLOY_USER" &>/dev/null; then
        useradd -m -s /bin/bash "$DEPLOY_USER"
        log_message "SUCCESS" "Deploy user created: $DEPLOY_USER"
    else
        log_message "INFO" "Deploy user already exists: $DEPLOY_USER"
    fi
    
    # Add to sudo group
    usermod -aG sudo "$DEPLOY_USER"
    
    # Configure sudo without password for specific commands
    cat > /etc/sudoers.d/"$DEPLOY_USER" << EOF
$DEPLOY_USER ALL=(ALL) NOPASSWD: /usr/bin/docker, /usr/local/bin/docker-compose, /bin/systemctl restart nginx, /bin/systemctl reload nginx, /bin/systemctl status nginx
EOF
    
    # Create SSH directory
    mkdir -p /home/$DEPLOY_USER/.ssh
    chmod 700 /home/$DEPLOY_USER/.ssh
    chown $DEPLOY_USER:$DEPLOY_USER /home/$DEPLOY_USER/.ssh
    
    # Create application directory
    mkdir -p /opt/stripe-template
    chown $DEPLOY_USER:$DEPLOY_USER /opt/stripe-template
    
    # Create backup directory
    mkdir -p /opt/backups
    chown $DEPLOY_USER:$DEPLOY_USER /opt/backups
    chmod 750 /opt/backups
    
    log_message "SUCCESS" "Deploy user configured"
}

# Function to install Docker
install_docker() {
    log_message "INFO" "Installing Docker..."
    
    # Remove old Docker versions
    apt-get remove -y docker docker-engine docker.io containerd runc 2>/dev/null || true
    
    # Add Docker's official GPG key
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
    
    # Add Docker repository
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
    
    # Install Docker
    apt-get update
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    
    # Add deploy user to docker group
    usermod -aG docker "$DEPLOY_USER"
    
    # Configure Docker daemon
    mkdir -p /etc/docker
    cat > /etc/docker/daemon.json << 'EOF'
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  },
  "storage-driver": "overlay2",
  "live-restore": true,
  "userland-proxy": false,
  "no-new-privileges": true,
  "seccomp-profile": "/etc/docker/seccomp.json"
}
EOF
    
    # Start and enable Docker
    systemctl enable docker
    systemctl start docker
    
    # Install Docker Compose standalone
    curl -L "https://github.com/docker/compose/releases/download/v${DOCKER_COMPOSE_VERSION}/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
    
    # Verify installation
    docker --version
    docker-compose --version
    
    log_message "SUCCESS" "Docker installed successfully"
}

# Function to install Node.js
install_nodejs() {
    log_message "INFO" "Installing Node.js..."
    
    # Install NodeSource repository
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
    
    # Install Node.js
    apt-get install -y nodejs
    
    # Verify installation
    node --version
    npm --version
    
    log_message "SUCCESS" "Node.js installed successfully"
}

# Function to install monitoring tools
install_monitoring() {
    log_message "INFO" "Installing monitoring tools..."
    
    # Install system monitoring tools
    apt-get install -y \
        prometheus-node-exporter \
        collectd \
        sysstat \
        atop
    
    # Configure node exporter
    systemctl enable prometheus-node-exporter
    systemctl start prometheus-node-exporter
    
    # Install log rotation for Docker
    cat > /etc/logrotate.d/docker << 'EOF'
/var/lib/docker/containers/*/*.log {
    rotate 7
    daily
    compress
    size=100M
    missingok
    delaycompress
    copytruncate
}
EOF
    
    log_message "SUCCESS" "Monitoring tools installed"
}

# Function to configure log management
configure_logging() {
    log_message "INFO" "Configuring log management..."
    
    # Configure rsyslog for application logs
    cat > /etc/rsyslog.d/50-stripe-template.conf << 'EOF'
# Application logs
:programname, isequal, "stripe-template" /var/log/stripe-template/application.log
& stop

# Nginx logs rotation
/var/log/nginx/*.log {
    daily
    rotate 52
    compress
    delaycompress
    missingok
    create 644 www-data adm
    postrotate
        if [ -f /var/run/nginx.pid ]; then
            kill -USR1 `cat /var/run/nginx.pid`
        fi
    endscript
}
EOF
    
    # Create log directories
    mkdir -p /var/log/stripe-template
    chown $DEPLOY_USER:$DEPLOY_USER /var/log/stripe-template
    
    # Restart rsyslog
    systemctl restart rsyslog
    
    log_message "SUCCESS" "Log management configured"
}

# Function to configure system limits
configure_limits() {
    log_message "INFO" "Configuring system limits..."
    
    # Configure limits for the deploy user
    cat > /etc/security/limits.d/stripe-template.conf << EOF
$DEPLOY_USER soft nofile 65536
$DEPLOY_USER hard nofile 65536
$DEPLOY_USER soft nproc 4096
$DEPLOY_USER hard nproc 4096
EOF
    
    # Configure system-wide limits
    cat >> /etc/sysctl.conf << 'EOF'

# Stripe Template Performance Tuning
net.core.somaxconn = 65536
net.core.netdev_max_backlog = 5000
net.core.rmem_default = 262144
net.core.rmem_max = 16777216
net.core.wmem_default = 262144
net.core.wmem_max = 16777216
net.ipv4.tcp_rmem = 4096 87380 16777216
net.ipv4.tcp_wmem = 4096 65536 16777216
net.ipv4.tcp_fin_timeout = 30
net.ipv4.tcp_keepalive_time = 120
net.ipv4.tcp_max_syn_backlog = 8192
fs.file-max = 65536
EOF
    
    # Apply sysctl settings
    sysctl -p
    
    log_message "SUCCESS" "System limits configured"
}

# Function to install SSL tools
install_ssl_tools() {
    log_message "INFO" "Installing SSL/TLS tools..."
    
    # Install Certbot for Let's Encrypt
    apt-get install -y certbot python3-certbot-nginx
    
    # Create SSL directory
    mkdir -p /opt/stripe-template/ssl
    chown $DEPLOY_USER:$DEPLOY_USER /opt/stripe-template/ssl
    chmod 750 /opt/stripe-template/ssl
    
    log_message "SUCCESS" "SSL tools installed"
}

# Function to setup monitoring server
setup_monitoring_server() {
    log_message "INFO" "Setting up monitoring server..."
    
    # Create monitoring user
    if ! id "$MONITORING_USER" &>/dev/null; then
        useradd -m -s /bin/bash "$MONITORING_USER"
        usermod -aG docker "$MONITORING_USER"
    fi
    
    # Create monitoring directories
    mkdir -p /opt/monitoring/{prometheus,grafana,alertmanager,logs}
    chown -R $MONITORING_USER:$MONITORING_USER /opt/monitoring
    
    # Allow monitoring ports in firewall
    ufw allow 9090/tcp comment "Prometheus"
    ufw allow 3001/tcp comment "Grafana"
    ufw allow 9093/tcp comment "AlertManager"
    
    log_message "SUCCESS" "Monitoring server setup completed"
}

# Function to create maintenance scripts
create_maintenance_scripts() {
    log_message "INFO" "Creating maintenance scripts..."
    
    # Create maintenance directory
    mkdir -p /opt/maintenance
    
    # System health check script
    cat > /opt/maintenance/health-check.sh << 'EOF'
#!/bin/bash
# System health check script

echo "=== System Health Check ==="
echo "Date: $(date)"
echo ""

echo "Disk Usage:"
df -h | grep -E '^(/dev/|Filesystem)'
echo ""

echo "Memory Usage:"
free -h
echo ""

echo "Load Average:"
uptime
echo ""

echo "Docker Status:"
docker system df
echo ""

echo "Application Status:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo ""

echo "Recent Errors (last 10):"
journalctl --since "1 hour ago" --priority=err --no-pager | tail -10
EOF

    # Cleanup script
    cat > /opt/maintenance/cleanup.sh << 'EOF'
#!/bin/bash
# System cleanup script

echo "Running system cleanup..."

# Clean package cache
apt-get autoremove -y
apt-get autoclean

# Clean Docker
docker system prune -f
docker volume prune -f

# Clean logs older than 30 days
find /var/log -name "*.log" -mtime +30 -delete
find /var/log -name "*.log.*.gz" -mtime +30 -delete

# Clean temporary files
find /tmp -type f -mtime +7 -delete

echo "Cleanup completed"
EOF

    # Make scripts executable
    chmod +x /opt/maintenance/*.sh
    
    # Add to crontab for deploy user
    (crontab -u $DEPLOY_USER -l 2>/dev/null; echo "0 2 * * * /opt/maintenance/cleanup.sh >> /var/log/cleanup.log 2>&1") | crontab -u $DEPLOY_USER -
    (crontab -u $DEPLOY_USER -l 2>/dev/null; echo "*/15 * * * * /opt/maintenance/health-check.sh >> /var/log/health-check.log 2>&1") | crontab -u $DEPLOY_USER -
    
    log_message "SUCCESS" "Maintenance scripts created"
}

# Function to show post-setup instructions
show_post_setup() {
    echo ""
    log_message "SUCCESS" "🎉 Leaseweb server setup completed!"
    echo ""
    log_message "INFO" "=== Next Steps ==="
    echo ""
    
    case $SERVER_TYPE in
        production|staging)
            echo "1. Add your SSH public key to /home/$DEPLOY_USER/.ssh/authorized_keys"
            echo "2. Test SSH connection on port $NEW_SSH_PORT"
            echo "3. Upload your application code to /opt/stripe-template"
            echo "4. Configure environment variables"
            echo "5. Run the deployment script"
            ;;
        monitoring)
            echo "1. Configure monitoring targets in Prometheus"
            echo "2. Set up Grafana dashboards"
            echo "3. Configure AlertManager notifications"
            ;;
    esac
    
    echo ""
    log_message "INFO" "=== Important Information ==="
    echo "SSH Port: $NEW_SSH_PORT"
    echo "Deploy User: $DEPLOY_USER"
    echo "Application Directory: /opt/stripe-template"
    echo "Backup Directory: /opt/backups"
    echo "Logs Directory: /var/log/stripe-template"
    echo ""
    
    if [ -n "$DOMAIN_NAME" ]; then
        echo "Domain: $DOMAIN_NAME"
        echo ""
        echo "SSL Certificate setup:"
        echo "sudo certbot --nginx -d $DOMAIN_NAME"
        echo ""
    fi
    
    log_message "WARN" "Remember to:"
    echo "- Add SSH key for the deploy user"
    echo "- Test firewall rules"
    echo "- Configure domain DNS if applicable"
    echo "- Set up SSL certificates"
    echo "- Configure monitoring alerts"
    echo ""
}

# Function to show help
show_help() {
    echo "Usage: $0 [server_type] [domain_name]"
    echo ""
    echo "Server types:"
    echo "  production   - Production application server [default]"
    echo "  staging      - Staging application server"
    echo "  monitoring   - Monitoring server (Prometheus/Grafana)"
    echo ""
    echo "Domain name:"
    echo "  Optional domain name for SSL certificate setup"
    echo ""
    echo "Environment variables:"
    echo "  SSH_PORT=22              Current SSH port"
    echo "  NEW_SSH_PORT=2222        New SSH port for security"
    echo "  DEPLOY_USER=deploy       Username for deployments"
    echo "  FAIL2BAN_ENABLED=true    Enable fail2ban"
    echo "  UFW_ENABLED=true         Enable UFW firewall"
    echo "  AUTO_UPDATES_ENABLED=true Enable automatic security updates"
    echo "  SWAP_SIZE=2G             Swap file size"
    echo ""
    echo "Examples:"
    echo "  $0                                    # Basic production setup"
    echo "  $0 production example.com             # Production with domain"
    echo "  $0 staging staging.example.com        # Staging server"
    echo "  $0 monitoring monitor.example.com     # Monitoring server"
}

# Main setup function
main() {
    case $SERVER_TYPE in
        production|staging)
            log_message "INFO" "Setting up $SERVER_TYPE server..."
            
            check_root
            detect_os
            update_system
            configure_auto_updates
            create_swap
            harden_ssh
            create_deploy_user
            configure_firewall
            configure_fail2ban
            install_docker
            install_nodejs
            install_monitoring
            install_ssl_tools
            configure_logging
            configure_limits
            create_maintenance_scripts
            
            # Restart SSH with new configuration
            log_message "INFO" "Restarting SSH service..."
            systemctl restart sshd
            
            show_post_setup
            ;;
        monitoring)
            log_message "INFO" "Setting up monitoring server..."
            
            check_root
            detect_os
            update_system
            configure_auto_updates
            create_swap
            harden_ssh
            create_deploy_user
            configure_firewall
            configure_fail2ban
            install_docker
            install_monitoring
            setup_monitoring_server
            configure_logging
            configure_limits
            create_maintenance_scripts
            
            # Restart SSH with new configuration
            systemctl restart sshd
            
            show_post_setup
            ;;
        help|-h|--help)
            show_help
            exit 0
            ;;
        *)
            log_message "ERROR" "Unknown server type: $SERVER_TYPE"
            show_help
            exit 1
            ;;
    esac
}

# Handle script execution
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    main "$@"
fi