---
title: Troubleshooting
layout: default
nav_order: 4
parent: Guides
permalink: /docs/guides/troubleshooting/
---

## Troubleshooting

{: .no_toc }

Common issues and solutions for Web-Terminal.

## Table of contents

{: .no_toc .text-delta }

1. TOC
{:toc}

---

## Service Issues

### Service Won't Start

```bash
# Check detailed status
sudo systemctl status web-terminal -l

# Check logs
sudo journalctl -u web-terminal -f

# Verify configuration
sudo web-terminal --check-config

# Check file permissions
sudo ls -la /opt/web-terminal/
sudo chown -R web-terminal:web-terminal /var/lib/web-terminal
```

### Port Access Issues

- Check if port 443 is available: `sudo ss -tulpn | grep :443`
- Verify user has permission for privileged port
- Check firewall: `sudo ufw status`

## Authentication Issues

### Login Failed

```bash
# Test basic auth
curl -k -u admin:admin123 https://your-server/

# Check user config
sudo cat /etc/web-terminal/config.yaml | grep -A 10 users:

# Check logs
sudo journalctl -u web-terminal -f
```

### JWT Token Issues

- Verify JWT secret is configured
- Check token hasn't expired
- Ensure proper Authorization header format

### OIDC Login Failed

- Verify client ID and secret
- Check redirect URI matches exactly: `https://your-domain.com/auth/oidc/callback`
- Ensure Google+ API is enabled (for Google)
- Test OIDC discovery: `curl https://accounts.google.com/.well-known/openid_configuration`

### OIDC Logout Issues

#### Logout Redirects Without Provider Interaction

- Provider may not support `end_session_endpoint`
- Check provider's OpenID Connect discovery document
- Verify provider configuration supports logout

#### Invalid Redirect URI Error

- Ensure exact URI match in provider configuration
- Check domain and port match your server configuration
- Verify HTTPS is used (required for OIDC)

#### Logout Fails Silently

- Check application logs for error messages
- Verify `id_token` is present in JWT payload
- Ensure provider accepts logout parameters

### Permission Denied After OIDC Login

- Check domain_mappings configuration
- Verify user's email domain
- Check permission_strategy setting

## Terminal Issues

### Terminal Won't Connect

- Check WebSocket connection in browser console
- Verify firewall allows WebSocket traffic
- Ensure PTY process can spawn (check user permissions)

### Terminal Sessions Not Working

- Check database connection for session storage
- Verify node-pty module is installed correctly
- Review logs for PTY process errors

## SSL Certificate Issues

### Certificate Errors

```bash
# Verify certificates exist and are readable
ls -la /etc/web-terminal/ssl/

# Check certificate validity
openssl x509 -in /etc/web-terminal/ssl/cert.pem -text -noout

# Regenerate certificates
sudo rm -rf /etc/web-terminal/ssl/*
sudo systemctl restart web-terminal
```

## Database Issues

### SQLite Issues

```bash
# Check SQLite file permissions
sudo chown web-terminal:web-terminal /var/lib/web-terminal/database/
sudo chmod 750 /var/lib/web-terminal/database/

# Verify disk space available
df -h /var/lib/web-terminal/

# Test database
sudo -u web-terminal sqlite3 /var/lib/web-terminal/database/web-terminal.db ".tables"
```

### PostgreSQL Issues

```bash
# Check connection
psql -h localhost -U web-terminal_user -d web-terminal_db

# Verify schema ownership
psql -d web-terminal_db -c "\dn+"

# Fix ENUM creation errors
sudo -u postgres psql -d web-terminal_db -c "ALTER SCHEMA public OWNER TO web-terminal_user;"

# Check PostgreSQL service
sudo systemctl status postgresql
```

### MySQL Issues

```bash
# Check connection
mysql -h localhost -u web-terminal_user -p web-terminal_db

# Verify user privileges
mysql -u root -p -e "SHOW GRANTS FOR 'web-terminal_user'@'localhost';"

# Check MySQL service
sudo systemctl status mysql
```

### General Database Issues

- Verify database dependencies are installed (`pg` for PostgreSQL, `mysql2` for MySQL)
- Check database service is running
- Verify network connectivity and firewall settings
- Review Web-Terminal logs: `sudo journalctl -u web-terminal -f`

## Installation Issues

### Package Installation Failed

- Check Node.js version: `node --version` (must be 22+)
- Verify architecture: `dpkg --print-architecture` (should be amd64)
- Check dependencies: `apt list --installed | grep nodejs`

## Common Fixes

### Reset User Password

```yaml
# Edit /etc/web-terminal/config.yaml
authentication:
  local:
    users:
      - username: admin
        password: newpassword123  # Update password
        role: admin
        id: 1
```

Then restart: `sudo systemctl restart web-terminal`

### Generate New JWT Secret

```bash
# Generate secure secret
openssl rand -hex 32

# Update /etc/web-terminal/config.yaml with new secret
sudo nano /etc/web-terminal/config.yaml

# Restart service
sudo systemctl restart web-terminal
```

### Regenerate SSL Certificates

```bash
# Remove existing certificates
sudo rm -rf /etc/web-terminal/ssl/*

# Restart service to regenerate
sudo systemctl restart web-terminal
```

## Performance Optimization

### For Optimal Terminal Performance

- **Adjust session timeouts**: Configure cleanup intervals in config.yaml
- **Database optimization**: Run `PRAGMA optimize` for SQLite regularly
- **Rate limiting**: Adjust based on concurrent terminal users
- **Log rotation**: Ensure logs are rotating properly to save disk space

---

## Getting More Help

If you're still experiencing issues:

- Check the [Support Documentation](../support/)
- Review application logs: `sudo tail -f /var/log/web-terminal/app.log`
- [Open an issue](https://github.com/STARTcloud/web-terminal/issues) on GitHub

---

## Related Documentation

- **[Configuration Reference](../../configuration/)** - Complete configuration options
- **[Authentication Guide](authentication/)** - Authentication setup
- **[Installation Guide](installation/)** - Installation methods
