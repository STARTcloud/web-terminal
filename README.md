# Secure Web Terminal

A secure web-based terminal interface that provides shell access through a browser, featuring HTTPS/SSL encryption and multi-layer authentication.

## Security Features

- **HTTPS/SSL Encryption**: All traffic is encrypted using SSL certificates
- **Multi-layer Authentication**:
  - OIDC support (Google, Azure AD, Keycloak, Okta, etc.)
  - Basic authentication fallback
  - JWT token-based sessions
  - WebSocket authentication with token validation
- **Advanced Security**:
  - Database-backed user management
  - Token revocation support
  - Backchannel logout (OIDC)
- **Secure by Default**: Requires HTTPS and authentication to function

## Features

- **Modern Authentication**
  - OIDC/OAuth2 integration with any provider
  - Basic auth fallback for local users
  - JWT session management
- **Web-Based Terminal**
  - Full terminal access via browser
  - xterm.js interface
  - WebSocket real-time communication
- **React-Based UI**
  - Modern login interface
  - Responsive design
  - Dark theme
- **Enterprise Ready**
  - SQLite user database
  - Winston logging with rotation
  - Configurable security headers

## Installation

### For Development

1. Clone the repository:

    ```bash
    git clone https://github.com/STARTcloud/web-terminal.git
    cd web-terminal
    ```

2. Install dependencies (backend + frontend):

    ```bash
    npm install
    cd web && npm install && cd ..
    ```

3. Configure for development:

    ```bash
    # Edit dev.config.yaml to configure:
    # - Local users (basic auth)
    # - OIDC providers (optional)
    # - Terminal settings
    # - SSL paths (auto-generates if missing)
    ```

4. Build frontend and start:

    ```bash
    npm run build
    npm start
    ```

5. Access at `https://localhost:443` (or configured port)

### For Production

Install using pre-built packages:

- **OmniOS**: See [packaging/omnios/README.md](packaging/omnios/README.md)
- **Debian**: See [packaging/DEBIAN/README.md](packaging/DEBIAN/README.md)

For detailed production setup including OIDC configuration, see the [Installation Guide](docs/guides/installation.md).

## Development Setup

Edit `dev.config.yaml` for development:

```yaml
server:
  domain: "localhost"
  port: 443

ssl:
  cert: ./ssl/cert.pem
  key: ./ssl/key.pem
  # Auto-generates if missing

authentication:
  jwt_secret: "your-secret-key-change-this"
  jwt_expiration: "24h"
  local:
    users:
      - username: admin
        password: admin123
        role: admin
        id: 1

terminal:
  shell: bash  # or powershell.exe for Windows
  cols: 80
  rows: 30
```

For OIDC provider configuration, see [Authentication Guide](docs/guides/authentication.md).

For complete configuration reference, see [Configuration Guide](docs/configuration.md).

## Usage

1. Access the terminal through your browser:

    [CLICK ME](https://localhost:443)

2. Enter your credentials (configured in config.yaml or in dev mode as dev.config.yaml)

3. You will now have access to a secure terminal session

## Security Notes

- Always use strong passwords in config.yaml or dev.config.yaml
- Keep config.yaml secure with appropriate file permissions:

  ```bash
  sudo chown root:root config.yaml
  sudo chmod 600 config.yaml
  ```

- Regularly update SSL certificates
- Monitor logs for unauthorized access attempts:

  ```bash
  sudo journalctl -u web-terminal
  ```

## Troubleshooting


For complete Troubleshooting reference, see [Configuration Guide](docs/troubleshooting.md).

## Logs

The application maintains detailed logs of all connections, authentication attempts, and commands:

1. System Service Logs:

   ```bash
   sudo journalctl -u web-terminal -f
   ```

2. Application Logs:

- Location: `/opt/web-terminal/logs/web-terminal-YYYY-MM-DD.log`
- Rotated daily with 14-day retention
- JSON formatted logs include:
  - IP addresses of connections
  - Authentication attempts (success/failure)
  - WebSocket connections/disconnections
  - Commands executed
  
  View latest application logs:

  ```bash
  tail -f /opt/web-terminal/logs/web-terminal-$(date +%Y-%m-%d).log
  ```

  Log Format:
  
  ```json
  {
    "event": "authentication|connection|command",
    "ip": "client_ip_address",
    "username": "user_who_connected",
    "timestamp": "ISO-8601 timestamp",
    "success": true|false,  // for authentication events
    "command": "executed_command",  // for command events
    "type": "http|websocket",  // for connection events
    "status": "connected|disconnected"  // for connection events
  }
  ```

## Updates

To update the application:

1. Stop the service:

   ```bash
   sudo systemctl stop web-terminal
   ```

2. Update files
3. Restart the service:

   ```bash
   sudo systemctl restart web-terminal
   ```
