---
title: Architecture
layout: default
nav_order: 3
permalink: /docs/architecture/
---

<style>
/* Override specific Just the Docs constraints for full width layout */

/* Disable sidebar width calculation for full width */
@media (min-width: 66.5rem) {
    .side-bar {
        /* width: calc((100% - 76.5rem) / 2 + 16.5rem); ## Disabled for full width */
        min-width: 16.5rem;
    }
    
    .side-bar + .main {
        /* margin-left: max(16.5rem, (100% - 76.5rem) / 2 + 16.5rem); ## Disabled for full width */
        margin-left: 15.5rem;
    }
}

@media (min-width: 50rem) {
    .side-bar {
        flex-flow: column nowrap;
        position: fixed;
        width: 15.5rem;
        height: 100%;
        border-right: 1px solid #44434d;
        /* align-items: flex-end; ## Disabled for full width */
        align-items: flex-start;
    }
    
    .side-bar + .main {
        margin-left: 15.5rem;
    }
    
    .main {
        position: relative;
        /* max-width: 60rem; ## Disabled for full width */
        max-width: none;
    }
}

/* Full width main content */
.main-content-wrap {
    max-width: none !important;
}

.main-content {
    max-width: none !important;
    padding: 2rem !important;
}

/* Dark theme for mermaid diagrams to match app */
.mermaid {
    background-color: #32313a !important;
    color: #f0f6fc !important;
    border-radius: 6px !important;
    padding: 1rem !important;
    margin: 1rem 0 !important;
    width: 100% !important;
    overflow-x: auto !important;
}

/* Mermaid subgraph styling for better visibility */
.mermaid .cluster rect {
    fill: #3e3d4a !important;
    stroke: #58576b !important;
    stroke-width: 1px !important;
}

.mermaid .cluster text {
    fill: #f0f6fc !important;
}

/* Node connection lines visibility */
.mermaid .edge-pattern-solid {
    stroke: #8b949e !important;
    stroke-width: 2px !important;
}

.mermaid .edge-pattern-dotted {
    stroke: #6e7681 !important;
    stroke-width: 2px !important;
}

/* Arrow heads */
.mermaid .arrowheadPath {
    fill: #8b949e !important;
    stroke: #8b949e !important;
}
</style>

# Web-Terminal Architecture
{: .fs-8 }

Comprehensive system architecture showing all components, services, and data flows.
{: .fs-6 .fw-300 }

---

## System Overview

Web-Terminal is an enterprise-grade file management system built with a modern microservices-style architecture. The system provides secure file operations, real-time collaboration, and comprehensive API access through multiple authentication methods.

## Detailed Architecture Diagram

```mermaid
graph LR
    subgraph "Clients"
        WB[Web Browser<br/>React SPA]
        CLI[CLI Tools<br/>wget/curl]
        API[API Clients]
    end
    
    subgraph "Authentication"
        AUTH{Auth<br/>Middleware}
        JWT[JWT Sessions]
        KEYS[API Keys]
        BASIC[Basic Auth]
        OIDC[OIDC/SSO]
    end
    
    subgraph "Server Core"
        EXPRESS[Express.js<br/>HTTPS Server]
        ROUTES[REST API<br/>Routes]
        SECURITY[Security<br/>Middleware]
    end
    
    subgraph "Real-time"
        SSE[Server-Sent<br/>Events]
        EVENTS[Event<br/>Broadcasting]
    end
    
    subgraph "Background Services"
        WATCHER[File Watcher<br/>Chokidar]
        CHECKSUM[Checksum<br/>Service]
        CACHE[Cache<br/>Service]
    end
    
    subgraph "Data Layer"
        DB[(Database<br/>Multi-engine)]
        FS[File System<br/>Secure Serving]
        CONFIG[YAML<br/>Configuration]
    end
    
    subgraph "Frontend"
        REACT[React SPA]
        SWAGGER[Swagger UI]
        PWA[Progressive<br/>Web App]
    end
    
    %% Client flows
    WB -->|HTTPS| EXPRESS
    CLI -->|Basic Auth| EXPRESS
    API -->|Bearer Token| EXPRESS
    
    %% Authentication
    EXPRESS --> AUTH
    AUTH --> JWT
    AUTH --> KEYS
    AUTH --> BASIC
    AUTH --> OIDC
    
    %% Core processing
    EXPRESS --> SECURITY
    SECURITY --> ROUTES
    ROUTES --> WATCHER
    ROUTES --> SSE
    
    %% Real-time communication
    SSE --> EVENTS
    EVENTS -.->|Live Updates| WB
    
    %% Background processing
    WATCHER --> CHECKSUM
    CHECKSUM --> CACHE
    WATCHER --> EVENTS
    CHECKSUM --> EVENTS
    
    %% Data persistence
    ROUTES --> DB
    ROUTES --> FS
    WATCHER --> DB
    CHECKSUM --> DB
    
    %% Configuration
    CONFIG --> EXPRESS
    CONFIG --> AUTH
    CONFIG --> WATCHER
    
    %% Frontend integration
    WB --> REACT
    REACT --> SWAGGER
    REACT --> PWA
```

## Component Details

### Client Layer
- **Web Browser**: React SPA with real-time SSE integration
- **CLI Tools**: Full compatibility with wget, curl, and similar tools
- **API Clients**: RESTful API access with Bearer token authentication
- **Mobile Devices**: Responsive interface optimized for mobile access

### Authentication & Authorization
- **Multi-method Authentication**: Supports JWT sessions, API keys, and HTTP Basic Auth
- **OIDC Integration**: Enterprise SSO with Google, GitHub, and custom providers
- **Role-based Access Control**: Granular permissions (downloads, uploads, delete)
- **API Key Management**: Scoped permissions with expiration and usage tracking

### Server Core
- **Express.js**: High-performance web server with comprehensive middleware
- **Security Middleware**: Helmet, CORS, CSRF protection, and rate limiting
- **Input Validation**: Path security and upload sanitization
- **Route Handlers**: RESTful API endpoints with comprehensive error handling

### Real-time System
- **Server-Sent Events**: Live updates for file operations and progress
- **Event Broadcasting**: Multi-client synchronization system
- **WebSocket Management**: Connection handling and client state tracking

### Background Services
- **File Watcher**: Real-time file system monitoring with Chokidar
- **Checksum Service**: SHA256 calculation with worker pool management
- **Maintenance Service**: Database optimization and cleanup operations
- **Cache Service**: Performance optimization for directory listings
- **Batch Operations**: Optimized database operations for high throughput

### Data Layer
- **Multi-database Support**: SQLite (default), PostgreSQL, MySQL
- **File Metadata**: Comprehensive tracking of checksums, timestamps, and structure
- **API Key Storage**: Encrypted key storage with permission management
- **User Management**: Local and OIDC user integration

### File System
- **Secure Serving**: Path validation and access control
- **Upload Processing**: Multer integration with validation and processing
- **Static Content**: Support for custom index.html and theme assets

### Configuration & Internationalization
- **YAML Configuration**: Flexible, environment-aware configuration system
- **Multi-language Support**: Auto-detected locales with fallback support
- **Centralized Logging**: Winston-based logging with rotation and multiple transports

### Frontend Architecture
- **React SPA**: Modern single-page application with client-side routing
- **Component Library**: Comprehensive UI components for file management
- **Custom Hooks**: SSE integration and file operation abstractions
- **Progressive Web App**: Service worker support with offline capabilities
- **Integrated Swagger UI**: API documentation and testing interface

---

**[Back to Home](../)**
