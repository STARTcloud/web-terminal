---
title: API Reference
layout: default
nav_order: 2
has_children: true
permalink: /docs/api/
---

## API Reference

{: .no_toc }

The Web-Terminal REST API provides endpoints for terminal session management, authentication, and system operations. This API supports JWT authentication for terminal access control.

## Table of contents

{: .no_toc .text-delta }

1. TOC
{:toc}

---

## Interactive Documentation

**Access the complete interactive Swagger UI at `/api-docs` on your Web-Terminal server**

The Swagger UI provides:

- **Dark theme integration**: Professional appearance matching Web-Terminal's interface
- **API key management**: Fill authentication directly from your existing keys
- **Temporary key generation**: Create testing keys on-demand
- **Dynamic server detection**: Auto-detects your server with custom override option
- **Live testing**: Try all endpoints directly from the documentation

### Direct Links

- **[Live Swagger UI](swagger-ui.html)** - Interactive API documentation with testing
- **[OpenAPI Specification](openapi.json)** - Raw OpenAPI 3.0 spec for tools and integrations

## Authentication Methods

Web-Terminal supports JWT-based authentication:

### JWT Sessions (Web Interface)

```bash
# Login to get JWT token
curl -k -X POST -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' \
  https://your-server/auth/login/basic
```

## API Categories

### Terminal Session Management

- `POST /api/terminal/start` - Start a new terminal session
- `GET /api/terminal/sessions` - List all terminal sessions
- `DELETE /api/terminal/sessions/{id}/stop` - Stop a terminal session

### Authentication

- `GET /auth/methods` - Get available authentication methods
- `POST /auth/login/basic` - Basic username/password login
- `POST /auth/logout` - Logout and clear token
- `GET /auth/status` - Check current authentication status

### WebSocket Endpoints

- `WS /ws/terminal/{sessionId}` - WebSocket connection for terminal I/O

## API Examples

### Terminal Session Management

#### Start Terminal Session

```bash
# Start a new terminal session
curl -k -X POST -H "Content-Type: application/json" \
  --cookie "auth_token=YOUR_JWT_TOKEN" \
  -d '{"terminal_cookie":"unique-session-id"}' \
  https://your-server/api/terminal/start
```

#### List Terminal Sessions

```bash
# Get all terminal sessions
curl -k --cookie "auth_token=YOUR_JWT_TOKEN" \
  https://your-server/api/terminal/sessions
```

#### Stop Terminal Session

```bash
# Stop a specific terminal session
curl -k -X DELETE --cookie "auth_token=YOUR_JWT_TOKEN" \
  https://your-server/api/terminal/sessions/SESSION_ID/stop
```

### Authentication

#### Basic Login

```bash
# Authenticate with username/password
curl -k -X POST -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' \
  https://your-server/auth/login/basic
```

#### Get Auth Methods

```bash
# Check available authentication methods
curl -k https://your-server/auth/methods
```

## Real-Time Features

### WebSocket Communication

Web-Terminal uses WebSocket for real-time terminal I/O:

- Bidirectional data streaming
- Terminal resize events
- Connection state tracking
- Automatic reconnection

## Response Formats

### Success Response

```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": {
    // Response data varies by endpoint
  }
}
```

### Error Response

```json
{
  "success": false,
  "message": "Error description",
  "details": "Additional error information"
}
```

## Error Handling

Web-Terminal uses standard HTTP status codes:

- `200` - Success
- `400` - Bad Request (invalid parameters)
- `401` - Unauthorized (authentication required)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found (session doesn't exist)
- `500` - Internal Server Error

## Rate Limiting

API requests are subject to configurable rate limiting:

- Default: 100 requests per 10-minute window
- Headers include rate limit information:
  - `RateLimit-Limit` - Request limit
  - `RateLimit-Remaining` - Remaining requests
  - `RateLimit-Reset` - Reset time

## Best Practices

### Security

- Use HTTPS for all API calls (`-k` flag with curl for self-signed certs)
- Store JWT tokens securely
- Implement proper session management
- Monitor authentication attempts

### Performance

- Implement proper error handling for network timeouts
- Monitor rate limit headers to avoid throttling
- Use appropriate request timeouts
- Handle WebSocket reconnection gracefully

---

## Related Documentation

- **[Getting Started Guide](../guides/getting-started/)** - Setup and basic usage
- **[Authentication Guide](../guides/authentication/)** - Detailed auth configuration
- **[Configuration Reference](../configuration/)** - Complete config options

---

Need help? Check our [Support Documentation](../support/) or [open an issue](https://github.com/STARTcloud/web-terminal/issues).
