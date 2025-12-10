---
title: API Reference
layout: default
nav_order: 2
has_children: true
permalink: /docs/api/
---

# API Reference
{: .no_toc }

The Web-Terminal REST API provides comprehensive endpoints for file management, authentication, and system operations. This API supports multiple authentication methods and offers complete file operations with real-time collaboration features.

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

Web-Terminal supports three authentication methods for maximum compatibility:

### 1. API Keys (Recommended for Automation)
```bash
# Bearer token authentication
curl -k -H "Authorization: Bearer YOUR_API_KEY" \
  https://your-server/api/api-keys
```

### 2. JWT Sessions (Web Interface)
```bash
# Login to get JWT token
curl -k -X POST -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' \
  https://your-server/auth/login/basic
```

### 3. HTTP Basic Auth (CLI Tools)
```bash
# wget style (wget compatible)
wget --no-check-certificate "https://admin:admin123@your-server/file.txt"

# curl style
curl -k -u admin:admin123 https://your-server/file.txt
```

## API Categories

### API Key Management
- `GET /api/api-keys` - List your API keys
- `POST /api/api-keys` - Create new API key
- `PUT /api/api-keys/{id}` - Update API key
- `DELETE /api/api-keys/{id}` - Delete API key

### File Operations
- `GET /{path}` - Download file or list directory
- `POST /{path}` - Upload file (multipart/form-data)
- `POST /{path}/folders` - Create folder
- `PUT /{path}?action=rename` - Rename file or folder
- `DELETE /{path}` - Delete file or directory

### Search Operations
- `POST /{path}/search` - Search files by name or checksum

### Authentication
- `GET /auth/methods` - Get available authentication methods
- `POST /auth/login/basic` - Basic username/password login
- `POST /auth/logout` - Logout and clear token

## API Examples

### File Operations

#### List Directory Contents
```bash
# Get JSON directory listing
curl -k -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Accept: application/json" \
  https://your-server/uploads/
```

#### Upload File
```bash
# Upload file to specific directory
curl -k -X POST -H "Authorization: Bearer YOUR_API_KEY" \
  -F "file=@./local-file.txt" \
  https://your-server/uploads/documents/
```

#### Search Files
```bash
# Search for files by name or checksum
curl -k -X POST -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query":"document"}' \
  https://your-server/uploads/search
```

#### Create Folder
```bash
# Create new folder
curl -k -X POST -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"folderName":"new-folder"}' \
  https://your-server/uploads/folders
```

#### Rename File
```bash
# Rename file or folder
curl -k -X PUT -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"newName":"new-filename.txt"}' \
  https://your-server/uploads/oldname.txt?action=rename
```

### API Key Management

#### Create API Key
```bash
# Create API key with specific permissions
curl -k -X POST -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "CI Pipeline",
    "permissions": ["downloads", "uploads"],
    "expires_at": "2025-12-31T23:59:59.000Z"
  }' \
  https://your-server/api/api-keys
```

#### List API Keys
```bash
# Get all your API keys
curl -k -H "Authorization: Bearer YOUR_API_KEY" \
  https://your-server/api/api-keys
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

## API Key Permissions

API keys can have the following permissions:

- **downloads** - Access to download files and list directories
- **uploads** - Access to upload files and create folders  
- **delete** - Access to delete files and directories

**Note**: Users can only create API keys with permissions they have. Regular users can only create download-only keys.

## Real-Time Features

### Server-Sent Events (SSE)
Web-Terminal provides real-time updates via Server-Sent Events:

```javascript
// Connect to real-time updates
const eventSource = new EventSource('/events');

eventSource.addEventListener('checksum-update', function(event) {
  const data = JSON.parse(event.data);
  console.log('File checksum updated:', data.filePath, data.checksum);
});

eventSource.addEventListener('file-deleted', function(event) {
  const data = JSON.parse(event.data);
  console.log('File deleted:', data.filePath);
});
```

Events include:
- `checksum-update` - File checksum calculation completed
- `file-deleted` - File or directory deleted
- `folder-created` - New folder created
- `file-renamed` - File or folder renamed

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

### Directory Listing Response
```json
{
  "success": true,
  "path": "/uploads/",
  "files": [
    {
      "name": "document.pdf",
      "path": "/uploads/document.pdf", 
      "size": 1024000,
      "mtime": "2025-09-22T23:42:51.207Z",
      "checksum": "1c8bdacfd9077738...",
      "isDirectory": false
    }
  ],
  "total": 5
}
```

## Error Handling

Web-Terminal uses standard HTTP status codes:

- `200` - Success
- `201` - Created
- `301` - Redirect (directory trailing slash)
- `400` - Bad Request (invalid parameters)
- `401` - Unauthorized (authentication required)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found (file/directory doesn't exist)
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
- Store API keys securely (environment variables, not hardcoded)
- Use least-privilege permissions (only grant necessary API key permissions)
- Rotate API keys regularly

### Performance
- Use `Accept: application/json` header for directory listings
- Implement proper error handling for network timeouts
- Monitor rate limit headers to avoid throttling
- Use appropriate request timeouts

### File Operations
- Verify file uploads with checksum validation
- Handle large file uploads with progress tracking
- Use appropriate Content-Type headers
- Implement retry logic for network failures

---

## Related Documentation

- **[Getting Started Guide](../guides/getting-started/)** - Setup and basic usage
- **[Authentication Guide](../guides/authentication/)** - Detailed auth configuration
- **[Configuration Reference](../configuration/)** - Complete config options

---

Need help? Check our [Support Documentation](../support/) or [open an issue](https://github.com/STARTcloud/web-terminal/issues).
