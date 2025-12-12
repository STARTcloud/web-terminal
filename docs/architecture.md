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

## Web-Terminal Architecture

{: .fs-8 }

Comprehensive system architecture showing all components, services, and data flows.
{: .fs-6 .fw-300 }

---

## System Overview

Web-Terminal is a secure web-based terminal application providing shell access through the browser. Built with Node.js and React, it uses WebSocket for real-time terminal I/O and supports multiple authentication methods including OIDC.

## Detailed Architecture Diagram

```mermaid
graph TB
    subgraph "Client Layer"
        BROWSER[Web Browser<br/>xterm.js Terminal]
        API[API Clients<br/>REST]
    end
    
    subgraph "Authentication Layer"
        AUTH{Auth<br/>Middleware}
        JWT[JWT Sessions]
        BASIC[Basic Auth]
        OIDC[OIDC Providers<br/>Google/MS/etc]
    end
    
    subgraph "Application Server"
        EXPRESS[Express.js<br/>HTTPS Server]
        ROUTES[REST API<br/>Routes]
        SECURITY[Security<br/>Middleware]
        SESSIONS[Terminal Session<br/>Management]
    end
    
    subgraph "Terminal Layer"
        WS[WebSocket<br/>Handler]
        PTY[PTY Processes<br/>node-pty]
        SHELL[Shell<br/>Bash/PowerShell]
    end
    
    subgraph "Data Layer"
        DB[(Database<br/>Session Storage)]
        CONFIG[YAML<br/>Configuration]
    end
    
    subgraph "Frontend"
        REACT[React SPA]
        XTERM[xterm.js<br/>Terminal]
        SWAGGER[Swagger UI<br/>API Docs]
    end
    
    %% Client connections
    BROWSER -->|HTTPS| EXPRESS
    API -->|HTTPS| EXPRESS
    
    %% Authentication flow
    EXPRESS --> AUTH
    AUTH --> JWT
    AUTH --> BASIC
    AUTH --> OIDC
    
    %% Core processing
    EXPRESS --> SECURITY
    SECURITY --> ROUTES
    ROUTES --> SESSIONS
    
    %% WebSocket for terminal I/O
    BROWSER -->|WebSocket| WS
    WS --> PTY
    PTY --> SHELL
    
    %% Session management
    SESSIONS --> DB
    SESSIONS --> PTY
    
    %% Configuration
    CONFIG --> EXPRESS
    CONFIG --> AUTH
    
    %% Frontend components
    BROWSER --> REACT
    REACT --> XTERM
    REACT --> SWAGGER
```

## Component Details

### Client Layer

- **Web Browser**: React SPA with xterm.js for terminal rendering
- **API Clients**: RESTful API access for terminal session management
- **Mobile Devices**: Responsive interface with mobile terminal support

### Authentication & Authorization

- **Multi-method Authentication**: JWT sessions, Basic Auth
- **OIDC Integration**: Enterprise SSO with Google, Microsoft, and custom providers
- **Role-based Access**: Admin vs User terminal access
- **Session Security**: JWT-based authentication with token revocation support

### Server Core

- **Express.js**: High-performance HTTPS server
- **Security Middleware**: Helmet, CORS, CSRF protection, and rate limiting
- **Route Handlers**: RESTful API for session management and authentication
- **WebSocket Upgrade**: Dedicated WebSocket handling for terminal I/O

### Terminal Layer

- **node-pty**: PTY (pseudo-terminal) process spawning
- **WebSocket Protocol**: Bidirectional real-time communication
- **Shell Support**: PowerShell on Windows, Bash on Linux/Unix
- **Session Tracking**: Active session management with health monitoring

### Session Management

- **Session Persistence**: Terminal sessions stored in database
- **Auto-cleanup**: Inactive session removal after timeout
- **Reconnection**: Sessions resume after network interruptions
- **Multi-tab Support**: Same session accessible from multiple browser tabs

### Data Layer

- **Multi-database Support**: SQLite (default), PostgreSQL, MySQL
- **Session Storage**: Terminal session metadata and state
- **User Management**: Local users and OIDC user profiles
- **Token Revocation**: JWT token tracking for backchannel logout

### Configuration & Logging

- **YAML Configuration**: Flexible, environment-aware configuration system
- **Multi-language Support**: Auto-detected locales with English and Spanish translations
- **Centralized Logging**: Winston-based logging with rotation and multiple log files
- **Separate Log Files**: Dedicated logs for app, access, auth, and database operations

### Frontend Architecture

- **React SPA**: Modern single-page application with client-side routing
- **xterm.js Integration**: Full-featured terminal emulator in the browser
- **Component Library**: UI components for terminal, authentication, and navigation
- **Progressive Web App**: Service worker support for offline functionality
- **Integrated Swagger UI**: API documentation and testing interface

---

**[Back to Home](../)**
