---
title: Authentication
layout: default
nav_order: 3
parent: Guides
permalink: /docs/guides/authentication/
---

## Authentication

{: .no_toc }

This guide covers Web-Terminal's comprehensive authentication system, including local users and OIDC integration for accessing the web-based terminal.

## Table of contents

{: .no_toc .text-delta }

1. TOC
{:toc}

---

## Authentication Overview

Web-Terminal provides two authentication methods:

1. **Local User Authentication** - Username/password accounts
2. **OIDC Authentication** - Google, Microsoft, and other enterprise identity providers

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

- **Terminal access**: Full shell access with admin privileges
- **Session management**: View and manage all terminal sessions
- **Configuration access**: Can modify terminal settings
- **System access**: Unrestricted command execution

#### User Role (role: user)

- **Terminal access**: Standard shell access with user privileges
- **Own sessions**: Manage only their own terminal sessions
- **Limited access**: Standard OS user command execution

### Web Login

1. Navigate to your Web-Terminal server
2. Click "Login" button
3. Enter username and password
4. Access granted based on user role

### Web Terminal Access

After logging in, click "Open Terminal" to access the shell.

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

   ```url
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

OIDC users get terminal access and roles based on:

- **Domain mapping**: Configure admin/user roles by email domain
- **Manual assignment**: Assign roles via configuration
- **Default permissions**: Typically assigned user role

```yaml
authentication:
  permission_strategy: "domain_based"
  domain_mappings:
    terminal_access: ["*"]              # All domains get terminal access
    terminal_admin: ["company.com"]     # Only company.com gets admin role
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

## JWT Token Management

### Token Structure

```json
{
  "aud": "web-terminal-users",
  "iss": "web-terminal", 
  "username": "admin",
  "role": "admin",
  "authType": "basic",
  "exp": 1640995200,
  "iat": 1640908800
}
```

### Token Validation

Web-Terminal validates:

- **Signature**: Uses configured JWT secret
- **Expiration**: Tokens expire after configured time
- **Issuer/Audience**: Validates token source
- **Role**: Checks user role for terminal access

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

3. **HTTPS Only**:

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

---

For troubleshooting authentication issues, see the **[Troubleshooting Guide](troubleshooting/)**.

---

## Related Documentation

- **[Configuration Reference](../../configuration/)** - Complete authentication config options
- **[API Reference](../../api/)** - Authentication endpoints and examples
- **[Installation Guide](installation/)** - Production deployment setup

---

Need help? Check our [Support Documentation](../../support/) or [open an issue](https://github.com/STARTcloud/web-terminal/issues).
