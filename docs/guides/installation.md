---
title: Installation
layout: default
nav_order: 2
parent: Guides
permalink: /docs/guides/installation/
---

# Installation
{: .no_toc }

This guide covers different methods for installing and deploying Web-Terminal in various environments.

## Table of contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

## System Requirements

### Minimum Requirements

- **Operating System**: Linux (DEBIAN/Ubuntu) or OmniOS
- **Node.js**: Version 22 or higher
- **Memory**: 512MB RAM minimum, 1GB recommended
- **Storage**: 2GB available disk space (for files, database, logs)
- **Network**: HTTPS port 443 access

### Recommended Production Environment

- **CPU**: 2+ cores
- **Memory**: 4GB+ RAM
- **Storage**: 100GB+ available space (depending on file storage needs)
- **Network**: Dedicated network interface, proper SSL certificates
- **Security**: Firewall configuration, regular backups

## Installation Methods

### Option 1: DEBIAN Package (Recommended)

For Ubuntu, Debian, and compatible systems:

```bash
# Download latest package
wget https://github.com/STARTcloud/web-terminal/releases/latest/download/web-terminal_*_amd64.deb

# Install package
sudo gdebi -n web-terminal_*.deb

# Start service
sudo systemctl enable --now web-terminal

# Check status
sudo systemctl status web-terminal
```

Package installation includes:
- Web-Terminal application files at `/opt/web-terminal/`
- Configuration at `/etc/web-terminal/config.yaml`
- Systemd service with security restrictions
- Automatic user creation (`web-terminal` system user)
- SSL certificate auto-generation

### Option 2: OmniOS Package

For OmniOS systems:

```bash
# Add STARTcloud repository (if not already added)
pkg set-publisher -g https://packages.startcloud.com/r151054 STARTcloud

# Install Web-Terminal package
pkg install web-terminal

# Enable service
svcadm enable web-terminal

# Check status
svcs web-terminal
```

Package includes:
- Application at `/opt/web-terminal/`
- SMF service manifest
- Configuration at `/etc/web-terminal/config.yaml`
- Automatic dependency handling

### Option 3: From Source

For development or custom deployments:

```bash
# Clone repository
git clone https://github.com/STARTcloud/web-terminal.git
cd web-terminal

# Install dependencies
npm ci

# Configure application
cp packaging/config/production-config.yaml config.yaml
# Edit config.yaml with your settings

# Start application
npm start
```

## Initial Configuration

### Configuration File

Edit `/etc/web-terminal/config.yaml` (package) or `config.yaml` (source):

```yaml
# Server configuration
server:
  domain: localhost
  port: 443
  enable_api_docs: true

# Authentication
authentication:
  jwt_secret: "your-jwt-secret-key-change-this"
  local:
    users:
      - username: admin
        password: admin123
        role: admin
        id: 1

# SSL Configuration  
ssl:
  key_file: "/etc/web-terminal/ssl/key.pem"
  cert_file: "/etc/web-terminal/ssl/cert.pem"
  generate_ssl: true

# Database
database:
  storage: "/var/lib/web-terminal/database/web-terminal.db"

# File serving
served_directory: "/var/lib/web-terminal/files"
```

### Directory Setup

For source installations, create required directories:

```bash
# Create application user
sudo useradd -r -s /bin/false web-terminal

# Create directories
sudo mkdir -p /var/lib/web-terminal/files
sudo mkdir -p /var/lib/web-terminal/database
sudo mkdir -p /var/log/web-terminal
sudo mkdir -p /etc/web-terminal/ssl

# Set permissions
sudo chown -R web-terminal:web-terminal /var/lib/web-terminal
sudo chown -R web-terminal:web-terminal /var/log/web-terminal
sudo chown -R web-terminal:web-terminal /etc/web-terminal
```

## SSL Certificate Setup

### Auto-Generated (Development)

For testing:
```yaml
ssl:
  generate_ssl: true  # Web-Terminal creates self-signed certificate
```

### Let's Encrypt (Production)

For production with proper certificates:

```bash
# Install certbot
sudo apt install certbot

# Get certificate
sudo certbot certonly --standalone -d web-terminal.yourdomain.com

# Configure Web-Terminal
sudo nano /etc/web-terminal/config.yaml
```

```yaml
ssl:
  generate_ssl: false
  key_file: "/etc/letsencrypt/live/web-terminal.yourdomain.com/privkey.pem"
  cert_file: "/etc/letsencrypt/live/web-terminal.yourdomain.com/fullchain.pem"
```

## Database Setup

Web-Terminal supports SQLite (default), PostgreSQL, and MySQL databases.

### SQLite (Default)

No additional setup required. SQLite database is created automatically.

```yaml
database:
  dialect: "sqlite"
  storage: "/var/lib/web-terminal/database/web-terminal.db"
  logging: false
```

### PostgreSQL Setup

#### Install Dependencies

```bash
# Add PostgreSQL support
npm install pg
```

#### Create Database and User

```bash
# Create database and user
sudo -u postgres createdb web-terminal_db
sudo -u postgres createuser web-terminal_user
sudo -u postgres psql -c "ALTER USER web-terminal_user WITH PASSWORD 'web-terminal_password';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE web-terminal_db TO web-terminal_user;"

# Critical: Set schema ownership for ENUM creation
sudo -u postgres psql -d web-terminal_db -c "ALTER SCHEMA public OWNER TO web-terminal_user;"
```

#### Configure Web-Terminal

```yaml
database:
  dialect: "postgres"
  host: "localhost"
  port: 5432
  database: "web-terminal_db"
  username: "web-terminal_user"
  password: "web-terminal_password"
  logging: false
```

### MySQL Setup

#### Install Dependencies

```bash
# Add MySQL support
npm install mysql2
```

#### Create Database and User

```bash
# Connect to MySQL as root
mysql -u root -p

# Create database and user
CREATE DATABASE web-terminal_db;
CREATE USER 'web-terminal_user'@'localhost' IDENTIFIED BY 'web-terminal_password';
GRANT ALL PRIVILEGES ON web-terminal_db.* TO 'web-terminal_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

#### Configure Web-Terminal

```yaml
database:
  dialect: "mysql"
  host: "localhost"
  port: 3306
  database: "web-terminal_db"
  username: "web-terminal_user"
  password: "web-terminal_password"
  logging: false
```

## Service Configuration

### DEBIAN/Ubuntu (systemd)

The package includes a secure systemd service:

```ini
[Unit]
Description=Web-Terminal
After=network.target

[Service]
Type=simple
User=web-terminal
Group=web-terminal
WorkingDirectory=/opt/web-terminal
ExecStart=/usr/bin/node app.js
Restart=always
RestartSec=10

# Security restrictions
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/lib/web-terminal /var/log/web-terminal /etc/web-terminal

[Install]
WantedBy=multi-user.target
```

### OmniOS (SMF)

SMF manifest provides robust service management:

```xml
<?xml version="1.0"?>
<!DOCTYPE service_bundle SYSTEM "/usr/share/lib/xml/dtd/service_bundle.dtd.1">
<service_bundle type='manifest' name='web-terminal'>
  <service name='application/web-terminal' type='service' version='1'>
    <method_context working_directory='/opt/web-terminal'>
      <method_credential user='web-terminal' group='web-terminal'/>
    </method_context>
    <exec_method type='method' name='start' exec='/opt/web-terminal/startup.sh' timeout_seconds='60'/>
    <exec_method type='method' name='stop' exec='/opt/web-terminal/shutdown.sh' timeout_seconds='30'/>
  </service>
</service_bundle>
```

## Post-Installation

### First Access

1. **Open browser**: Navigate to `https://your-server` (or `https://localhost` for local)
2. **Login**: Use configured admin credentials
3. **Upload test file**: Verify file operations work
4. **Check API**: Visit `/api-docs` for Swagger UI
5. **Create API keys**: Generate keys for automation

### Production Hardening

1. **Change Default Passwords**:
   ```yaml
   authentication:
     local:
       users:
         - username: admin
           password: "strong-random-password"  # Change default!
   ```

2. **Configure Rate Limiting**:
   ```yaml
   rate_limiting:
     window_minutes: 15
     max_requests: 60
     message: "Rate limit exceeded"
   ```

3. **Secure File Directory**:
   ```bash
   sudo chmod 750 /var/lib/web-terminal/files
   sudo chown web-terminal:web-terminal /var/lib/web-terminal/files
   ```

## Backup and Recovery

### Configuration Backup
```bash
# Backup configuration
sudo cp /etc/web-terminal/config.yaml /etc/web-terminal/config.yaml.backup

# Backup database
sudo cp /var/lib/web-terminal/database/web-terminal.db /var/lib/web-terminal/database/web-terminal.db.backup
```

### Restore Process
```bash
# Stop service
sudo systemctl stop web-terminal

# Restore configuration
sudo cp /etc/web-terminal/config.yaml.backup /etc/web-terminal/config.yaml

# Restore database  
sudo cp /var/lib/web-terminal/database/web-terminal.db.backup /var/lib/web-terminal/database/web-terminal.db

# Start service
sudo systemctl start web-terminal
```

## Monitoring

### Health Checks

```bash
# Service status
sudo systemctl status web-terminal

# File operations
curl -k https://localhost/

# API health
curl -k https://localhost/auth/methods

# Database check
sudo -u web-terminal sqlite3 /var/lib/web-terminal/database/web-terminal.db ".tables"
```

### Log Monitoring

```bash
# Service logs
sudo journalctl -u web-terminal -f

# File access logs (built into Web-Terminal)
sudo tail -f /var/log/web-terminal/access.log

# Error logs
sudo tail -f /var/log/web-terminal/error.log
```

---

## Troubleshooting

### Common Installation Issues

**Package Installation Failed**
- Check Node.js version: `node --version` (must be 22+)
- Verify architecture: `dpkg --print-architecture` (should be amd64)
- Check dependencies: `apt list --installed | grep nodejs`

**Service Won't Start**
```bash
# Check detailed status
sudo systemctl status web-terminal -l

# Check configuration
sudo web-terminal --check-config

# Verify file permissions
sudo ls -la /opt/web-terminal/
```

**Port Access Issues**
- Check if port 443 is available: `sudo ss -tulpn | grep :443`
- Verify user has permission for privileged port
- Check firewall: `sudo ufw status`

---

Next: [Authentication](authentication/) - Configure user management and API keys
