---
title: Authentication
layout: default
nav_order: 3
parent: Guides
permalink: /docs/guides/authentication/
---

# Authentication
{: .no_toc }

This guide covers Web-Terminal's comprehensive authentication system, including local users, OIDC integration, and API key management.

## Table of contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

## Authentication Overview

Web-Terminal provides three authentication methods for maximum compatibility:

1. **Local User Authentication** - Username/password accounts
2. **OIDC Authentication** - Google, Microsoft, etc.
3. **API Key Authentication** - Bearer tokens for automation

## Local User Authentication

### User Configuration

Edit your `config.yaml` to define local users:

```yaml
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
```

### User Roles

#### Admin Role (role: admin)
- **File operations**: Upload, download, delete, rename
- **Folder management**: Create and manage directories
- **API key creation**: Generate keys with any permissions
- **System access**: All file operations and management features

#### User Role (role: user)
- **File access**: Download files only
- **Browse directories**: Navigate file structure
- **API key creation**: Generate download-only keys
- **Limited access**: Cannot upload, delete, or modify files

### Web Login

1. Navigate to your Web-Terminal server
2. Click "Login" button
3. Enter username and password
4. Access granted based on user role

### HTTP Basic Authentication

For CLI tools and automation:

```bash
# wget style (recommended for file downloads)
wget --no-check-certificate "https://admin:admin123@your-server/file.txt"

# curl style
curl -k -u admin:admin123 https://your-server/file.txt

# API operations
curl -k -u admin:admin123 \
  -H "Accept: application/json" \
  https://your-server/uploads/
```

## OIDC Authentication

### Google Integration

Configure Google OAuth for web authentication:

```yaml
authentication:
  oidc_providers:
    google:
      enabled: true
      client_id: "your-google-client-id.googleusercontent.com"
      client_secret: "your-google-client-secret"
      display_name: "Sign in with Google"
      issuer: "https://accounts.google.com"
      scope: "openid email profile"
```

### Setting Up Google OAuth

1. **Google Cloud Console**:
   - Create new project or select existing
   - Enable Google+ API
   - Create OAuth 2.0 credentials

2. **Configure Redirect URI**:
   ```
   https://your-domain.com/auth/oidc/callback
   ```

3. **Add Credentials to Config**:
   ```yaml
   authentication:
     oidc_providers:
       google:
         enabled: true
         client_id: "your-app-id.googleusercontent.com"
         client_secret: "your-client-secret"
   ```

### OIDC User Permissions

OIDC users get permissions based on:
- **Domain mapping**: Configure permissions by email domain
- **Manual assignment**: Assign permissions via configuration
- **Default permissions**: Usually full admin access

```yaml
authentication:
  permission_strategy: "domain_based"
  domain_mappings:
    downloads: ["*"]                    # All domains get downloads
    uploads: ["company.com"]            # Only company.com gets uploads
    delete: ["company.com"]             # Only company.com gets delete
```

### OIDC Logout (RP-Initiated Logout)

Web-Terminal supports RP-initiated logout for OIDC providers that implement the OpenID Connect Session Management specification.

#### How It Works

When an OIDC-authenticated user logs out:
1. **Local Session Cleared**: JWT token is removed from browser
2. **Provider Logout**: User is redirected to OIDC provider's logout endpoint
3. **Provider Session Cleared**: OIDC provider terminates the user's session
4. **Return to Application**: User is redirected back to login page with success message

#### Configuration Requirements

**OIDC Provider Setup** (Required):
- Configure post-logout redirect URI in your OIDC provider
- URI format: `https://your-domain.com/login?logout=success`
- For port 443: `https://your-domain.com/login?logout=success`
- For other ports: `https://your-domain.com:8443/login?logout=success`

**Application Configuration** (Automatic):
- No additional configuration needed in `config.yaml`
- Redirect URI is built dynamically from server domain and port
- Logout flow activates automatically for OIDC users

#### Provider-Specific Notes

**Google OAuth**:
- Supports RP-initiated logout
- Configure redirect URI in Google Cloud Console OAuth settings

**Microsoft Azure AD**:
- Supports RP-initiated logout
- Configure redirect URI in Azure App Registration

**Domino OIDC Provider**:
- Logout endpoint: `/auth/protocol/oidc/logout`
- Configure in "Post logout redirect URI(s)" field
- Cannot be used with Multi-Server SSO (LTPA) configurations

#### Testing Logout Flow

1. **Login via OIDC**: Use "Sign in with [Provider]" button
2. **Access Protected Resource**: Verify authentication works
3. **Logout**: Click logout button or navigate to `/logout`
4. **Verify Provider Logout**: Should redirect to provider logout page
5. **Return to Application**: Should show "You have been successfully logged out"
6. **Test Session Cleared**: Accessing protected resources should require re-authentication

#### Troubleshooting

**Logout Redirects to Login Without Provider Interaction**:
- Provider may not support `end_session_endpoint`
- Check provider's OpenID Connect discovery document
- Verify provider configuration supports logout

**"Invalid Redirect URI" Error**:
- Ensure exact URI match in provider configuration
- Check domain and port match your server configuration
- Verify HTTPS is used (required for OIDC)

**Logout Fails Silently**:
- Check application logs for error messages
- Verify `id_token` is present in JWT payload
- Ensure provider accepts logout parameters

## API Key Authentication

### Creating API Keys

#### Via Web Interface
1. Navigate to `/api-keys` 
2. Click "Generate New API Key"
3. Configure:
   - **Name**: Descriptive name for the key
   - **Permissions**: downloads, uploads, delete (based on your role)
   - **Expiration**: 7 days to 1 year

#### Via API
```bash
# Create API key
curl -k -X POST -H "Authorization: Bearer YOUR_EXISTING_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "CI Pipeline",
    "permissions": ["downloads", "uploads"],
    "expires_at": "2025-12-31T23:59:59.000Z"
  }' \
  https://your-server/api/api-keys
```

### API Key Permissions

Choose appropriate permissions for your use case:

#### Downloads Only (Safe for CI/CD)
```json
{
  "permissions": ["downloads"]
}
```

#### Upload Access (Admin Only)
```json
{
  "permissions": ["downloads", "uploads"]
}
```

#### Full Access (Admin Only)
```json
{
  "permissions": ["downloads", "uploads", "delete"]
}
```

### Using API Keys

```bash
# File operations
curl -k -H "Authorization: Bearer YOUR_API_KEY" \
  https://your-server/uploads/file.txt

# Directory listing
curl -k -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Accept: application/json" \
  https://your-server/uploads/

# Upload file
curl -k -X POST -H "Authorization: Bearer YOUR_API_KEY" \
  -F "file=@./local-file.txt" \
  https://your-server/uploads/
```

## Swagger UI Authentication

### Existing API Keys
If you have API keys, the Swagger UI will show them in the authorization modal:
1. Click "Authorize" in Swagger UI
2. See your existing API keys listed
3. Click "Fill Auth Field" to use an existing key

### Temporary Keys
For testing in Swagger UI:
1. Click "Authorize" in Swagger UI
2. Click "Generate Temp Key" 
3. Temporary key automatically fills the auth field
4. Key expires after configured time (default 1 hour)

## JWT Token Management

### Token Structure
```json
{
  "aud": "file-server-users",
  "iss": "file-server", 
  "userId": 1,
  "email": "user@example.com",
  "permissions": ["downloads", "uploads", "delete"],
  "role": "admin",
  "exp": 1640995200,
  "iat": 1640908800
}
```

### Token Validation
Web-Terminal validates:
- **Signature**: Uses configured JWT secret
- **Expiration**: Tokens expire after configured time
- **Issuer/Audience**: Validates token source
- **Permissions**: Checks required permissions for operations

## Security Best Practices

### Production Deployment

1. **Strong JWT Secret**: 
   ```bash
   # Generate secure secret
   openssl rand -hex 32
   ```

2. **Secure Passwords**:
   ```yaml
   authentication:
     local:
       users:
         - username: admin
           password: "$(openssl rand -base64 32)"  # Strong random password
   ```

3. **Limited API Key Permissions**:
   - Only grant necessary permissions
   - Set reasonable expiration dates
   - Rotate keys regularly

4. **HTTPS Only**:
   ```yaml
   ssl:
     generate_ssl: false
     key_file: "/etc/letsencrypt/live/domain.com/privkey.pem"
     cert_file: "/etc/letsencrypt/live/domain.com/fullchain.pem"
   ```

### Network Security

- **Firewall**: Restrict access to port 443
- **VPN**: Consider VPN access for admin operations
- **Monitoring**: Log and monitor authentication attempts
- **Rate Limiting**: Configure appropriate limits

## Troubleshooting

### Authentication Issues

**Login Failed**
```bash
# Test basic auth
curl -k -u admin:admin123 https://your-server/

# Check user config
sudo cat /etc/web-terminal/config.yaml | grep -A 10 users:

# Check logs
sudo journalctl -u web-terminal -f
```

**JWT Token Issues**
- Verify JWT secret is configured
- Check token hasn't expired
- Ensure proper Authorization header format

**API Key Problems**
- Verify key hasn't expired
- Check permissions match required operation
- Test key: `curl -k -H "Authorization: Bearer KEY" https://server/api/api-keys`

### OIDC Issues

**Google Login Failed**
- Verify client ID and secret
- Check redirect URI matches exactly
- Ensure Google+ API is enabled
- Test OIDC discovery: `curl https://accounts.google.com/.well-known/openid_configuration`

**Permission Denied After OIDC Login**
- Check domain_mappings configuration
- Verify user's email domain
- Check permission_strategy setting

### Common Fixes

**Reset User Password**
```yaml
# Edit config.yaml
authentication:
  local:
    users:
      - username: admin
        password: newpassword123  # Update password
        role: admin
        id: 1
```

**Generate New JWT Secret**
```bash
# Generate secure secret
openssl rand -hex 32

# Update config
sudo nano /etc/web-terminal/config.yaml
sudo systemctl restart web-terminal
```

**Regenerate SSL Certificates**
```bash
# Remove existing certificates
sudo rm -rf /etc/web-terminal/ssl/*

# Restart service to regenerate
sudo systemctl restart web-terminal
```

---

## Related Documentation

- **[Configuration Reference](../../configuration/)** - Complete authentication config options
- **[API Reference](../../api/)** - Authentication endpoints and examples
- **[Installation Guide](installation/)** - Production deployment setup

---

Need help? Check our [Support Documentation](../../support/) or [open an issue](https://github.com/STARTcloud/web-terminal/issues).
