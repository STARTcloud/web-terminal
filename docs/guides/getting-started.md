---
title: Getting Started
layout: default
nav_order: 1
parent: Guides
permalink: /docs/guides/getting-started/
---

# Getting Started
{: .no_toc }

This guide will walk you through setting up Web-Terminal for the first time, from installation to using the comprehensive file management features.

## Table of contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

## Prerequisites

Before starting, ensure you have:

- **Node.js 22+** - Required for running Web-Terminal server
- **Database** - SQLite3 (default), PostgreSQL, or MySQL for file metadata storage
- **Database Dependencies** - `pg` package for PostgreSQL, `mysql2` for MySQL (install via npm)
- **OpenSSL** - For SSL certificate generation
- **Network Access** - For HTTPS file serving

## Quick Start

### 1. Installation

#### Option A: DEBIAN Package (Recommended)
```bash
# Download and install package
wget https://github.com/STARTcloud/web-terminal/releases/latest/download/web-terminal_*_amd64.deb
sudo gdebi -n web-terminal_*.deb

# Start service
sudo systemctl enable --now web-terminal

# Check status
sudo systemctl status web-terminal
```

#### Option B: From Source
```bash
# Clone repository
git clone https://github.com/STARTcloud/web-terminal.git
cd web-terminal

# Install dependencies
npm ci

# Configure
cp dev.config.yaml config.yaml
# Edit config.yaml with your settings

# Start server
npm start
```

### 2. Initial Configuration

Edit the configuration file at `/etc/web-terminal/config.yaml` (or `config.yaml` for source install):

```yaml
# Server configuration
server:
  domain: localhost
  port: 443
  enable_api_docs: true
  show_root_index: false

# Authentication
authentication:
  jwt_secret: "your-jwt-secret-key-change-this"
  jwt_expiration: "24h"
  local:
    users:
      - username: admin
        password: admin123
        role: admin
        id: 1
      - username: user
        password: user123
        role: user
        id: 2

# SSL Configuration
ssl:
  key_file: "/etc/web-terminal/ssl/key.pem"
  cert_file: "/etc/web-terminal/ssl/cert.pem"
  generate_ssl: true

# File serving
served_directory: "/var/lib/web-terminal/files"
```

### 3. First Access

1. **Open your browser** and navigate to `https://your-server` (or `https://localhost` for local)
2. **Login**: Use admin/admin123 (or your configured credentials)
3. **Browse Files**: Navigate through your file directories
4. **Upload Files**: Drag and drop files or use the upload button
5. **Try API**: Visit the [API documentation](../api/swagger-ui.html) for interactive Swagger UI

## Core Features Overview

### **Authentication Methods**

#### Web Interface Login
- Navigate to your Web-Terminal server
- Click "Login" button
- Enter username/password from config

#### HTTP Basic Auth (CLI Tools)
```bash
# wget style (works with file downloads)
wget --no-check-certificate "https://admin:admin123@your-server/file.txt"

# curl style
curl -k -u admin:admin123 https://your-server/file.txt
```

#### API Key Authentication
```bash
# Generate API key via web interface (/api-keys)
curl -k -H "Authorization: Bearer YOUR_API_KEY" \
  https://your-server/api/api-keys
```

### **File Operations**

#### Upload Files
- **Web**: Drag-and-drop to upload area
- **API**: `POST /{path}` with multipart/form-data

#### Search Files
- **Web**: Use search box (searches names and checksums)
- **API**: `POST /{path}/search` with `{"query":"searchterm"}`

#### Create Folders
- **Web**: Click folder+ button
- **API**: `POST /{path}/folders` with `{"folderName":"name"}`

#### Rename Items
- **Web**: Click pencil icon next to file/folder
- **API**: `PUT /{path}?action=rename` with `{"newName":"name"}`

### **Swagger UI Features**

Access comprehensive API documentation at `/api-docs`:

- **Dark theme**: Professional appearance
- **API key integration**: Fill auth from existing keys
- **Temporary keys**: Generate testing keys on-demand
- **Dynamic server**: Auto-detects your server URL
- **Interactive testing**: Try all endpoints directly

## User Roles & Permissions

### Regular Users (role: user)
- **Download files**: Full read access to all files
- **Create API keys**: Download-only keys for automation
- **Browse directories**: Navigate file structure

### Administrators (role: admin)  
- **Full file access**: Upload, download, delete, rename
- **Folder management**: Create and manage directories
- **API key management**: Create keys with any permissions
- **System access**: All file operations

## Advanced Configuration

### Rate Limiting
```yaml
rate_limiting:
  window_minutes: 10
  max_requests: 100
  message: "Too many requests, please try again later."
```

### OIDC Authentication (Google, etc.)
```yaml
authentication:
  oidc_providers:
    google:
      enabled: true
      client_id: "your-google-client-id"
      client_secret: "your-google-client-secret"
      display_name: "Sign in with Google"
```

### Swagger UI Customization
```yaml
swagger:
  allow_full_key_retrieval: true
  allow_temp_key_generation: true
  temp_key_expiration_hours: 1
```

## Real-Time Features

### Server-Sent Events (SSE)
Web-Terminal provides real-time updates:
- **File uploads**: See new files appear instantly
- **Checksum updates**: Watch checksums calculate in real-time
- **File operations**: Renames, deletes sync across all users
- **Multi-user collaboration**: All connected users see changes

### Enhanced File Interface
- **Click file icons**: Copy links to clipboard
- **Long-press file icons**: Force download (bypasses browser preview)
- **Rename functionality**: In-place editing with real-time updates
- **Animated feedback**: Visual confirmations for all actions

## Troubleshooting

### Common Issues

**Service Won't Start**
```bash
# Check logs
sudo journalctl -u web-terminal -f

# Verify config
sudo web-terminal --check-config

# Check permissions
sudo chown -R web-terminal:web-terminal /var/lib/web-terminal
```

**Cannot Upload Files**
- Verify you're logged in as admin user
- Check directory permissions: `sudo chown web-terminal:web-terminal /var/lib/web-terminal/files`
- Ensure disk space available

**SSL Certificate Issues**
```bash
# Regenerate certificates
sudo rm -rf /etc/web-terminal/ssl/*
sudo systemctl restart web-terminal
```

**API Key Problems**
- Only admin users can create upload/delete API keys
- Regular users can only create download-only keys
- Check permissions in Swagger UI

### Performance Optimization

For large file collections:
- **Enable file watching**: Real-time checksum calculation
- **Database optimization**: Regular SQLite maintenance
- **Rate limiting**: Adjust based on usage patterns

## Next Steps

Once Web-Terminal is running:

1. **[Explore the API](../api/)** - Interactive Swagger documentation
2. **[Configure Authentication](authentication/)** - Set up OIDC or additional users
3. **[Installation Guide](installation/)** - Production deployment best practices

---

Need help? Check our [Support Documentation](../support/) or [open an issue](https://github.com/STARTcloud/web-terminal/issues).
