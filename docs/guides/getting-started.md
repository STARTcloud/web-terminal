---
title: Getting Started
layout: default
nav_order: 1
parent: Guides
permalink: /docs/guides/getting-started/
---

## Getting Started

{: .no_toc }

This guide will walk you through setting up Web-Terminal for the first time, from installation to accessing the web-based terminal.

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
3. **Access Terminal**: Click "Open Terminal" to start a shell session
4. **Use Shell**: Execute commands in the browser-based terminal
5. **Try API**: Visit the [API documentation](../api/swagger-ui.html) for REST API testing

## Core Features Overview

### **Authentication Methods**

#### Web Interface Login

- Navigate to your Web-Terminal server
- Click "Login" button
- Enter username/password from config

#### REST API Authentication

```bash
# Using JWT token for API calls
curl -k --cookie "auth_token=YOUR_JWT_TOKEN" \
  https://your-server/api/terminal/sessions
```

### **Terminal Operations**

#### Start Terminal Session

- **Web**: Click "Open Terminal" button on landing page
- **API**: `POST /api/terminal/start` with `{"terminal_cookie":"unique-id"}`

#### Terminal Features

- **Full shell access**: Execute any command available to the user
- **Session persistence**: Terminal state preserved across page refreshes
- **Auto-reconnect**: Sessions automatically reconnect after disconnections
- **Resize support**: Terminal dynamically resizes to fit browser window

#### Manage Sessions

- **Web**: Use reconnect button to restart terminal session
- **API**: `GET /api/terminal/sessions` to list all sessions
- **API**: `DELETE /api/terminal/sessions/{id}/stop` to stop a session

### **Swagger UI Features**

Access comprehensive API documentation at `/api-docs`:

- **Dark theme**: Professional appearance
- **API key integration**: Fill auth from existing keys
- **Temporary keys**: Generate testing keys on-demand
- **Dynamic server**: Auto-detects your server URL
- **Interactive testing**: Try all endpoints directly

## User Roles & Permissions

### Regular Users (role: user)

- **Terminal access**: Standard shell access
- **Own sessions**: Manage own terminal sessions only
- **Limited permissions**: Standard OS user permissions

### Administrators (role: admin)

- **Full terminal access**: Unrestricted shell access
- **Session management**: View and manage all terminal sessions
- **System access**: Full shell privileges

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

### WebSocket Communication

Web-Terminal uses WebSocket for real-time terminal I/O:

- **Bidirectional data flow**: Commands and output stream in real-time
- **Terminal resize events**: Window size changes synced to PTY
- **Connection state tracking**: Automatic reconnection on network interruptions
- **Session persistence**: Terminal state maintained across refreshes

## Next Steps

Once Web-Terminal is running:

1. **[Explore the API](../api/)** - Interactive Swagger documentation
2. **[Configure Authentication](authentication/)** - Set up OIDC or additional users
3. **[Troubleshooting](troubleshooting/)** - Solutions for common issues

---

Need help? Check our [Support Documentation](../support/) or [open an issue](https://github.com/STARTcloud/web-terminal/issues).
