import express from 'express';
import path from 'path';
import { existsSync } from 'fs';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import lusca from 'lusca';
import passport from 'passport';
import configLoader from './config/configLoader.js';
import { configAwareI18nMiddleware } from './config/i18n.js';
import { initializeDatabase } from './config/database.js';
import { setupPassportStrategies } from './config/passport.js';
import { morganMiddleware, logger } from './config/logger.js';
import { rateLimiterMiddleware } from './middleware/rateLimiter.js';
import { errorHandler } from './middleware/errorHandler.js';
import authRoutes from './routes/auth.js';
import swaggerRoutes from './routes/swagger.js';
import terminalRoutes, { getPtyProcess } from './routes/terminal.js';
import { setupHTTPSServer } from './utils/sslManager.js';
import { checkTokenRevocation } from './middleware/tokenRevocation.js';

const app = express();

const startServer = async () => {
  configLoader.load();

  const serverPortConfig = configLoader.getServerConfig();
  const port = process.env.PORT || serverPortConfig.port || 443;

  await initializeDatabase();

  await setupPassportStrategies();

  // CORS configuration from production config
  const corsConfig = configLoader.getCorsConfig();

  let origin = false; // Secure default

  if (corsConfig.allow_origin === true && corsConfig.whitelist && corsConfig.whitelist.length > 0) {
    // Use whitelist from config for production
    origin = corsConfig.whitelist;
    logger.info('CORS enabled with whitelist', { whitelist: corsConfig.whitelist });
  }

  const corsOptions = {
    origin,
    preflightContinue: corsConfig.preflight_continue || false,
    credentials: corsConfig.credentials || false,
  };

  app.use(cors(corsOptions));
  app.options('*splat', cors(corsOptions));

  // Serve static assets from Vite build FIRST - before any other routes
  const frontendDistPath = 'web/dist';
  if (existsSync(frontendDistPath)) {
    app.use(
      '/assets',
      express.static(path.join(frontendDistPath, 'assets'), {
        setHeaders: (response, filePath) => {
          // Ensure proper MIME types for Vite assets
          if (filePath.endsWith('.js')) {
            response.setHeader('Content-Type', 'application/javascript');
          } else if (filePath.endsWith('.css')) {
            response.setHeader('Content-Type', 'text/css');
          } else if (filePath.endsWith('.woff2')) {
            response.setHeader('Content-Type', 'font/woff2');
          }
        },
      })
    );
    app.use(express.static(frontendDistPath));
  } else {
    logger.warn('Frontend dist directory not found. Run "npm run build" to build the frontend.');
  }

  // Enhanced security headers with configurable CSP
  const securityConfig = configLoader.getSecurityConfig();
  const serverConfig = configLoader.getServerConfig();

  const helmetConfig = {};

  // Configure CSP if enabled
  if (securityConfig.content_security_policy.enabled) {
    // Start with base CSP configuration
    const cspDirectives = {
      defaultSrc: [...securityConfig.content_security_policy.default_src],
      scriptSrc: [...securityConfig.content_security_policy.script_src],
      styleSrc: [...securityConfig.content_security_policy.style_src],
      fontSrc: [...securityConfig.content_security_policy.font_src],
      imgSrc: [...securityConfig.content_security_policy.img_src],
      connectSrc: [...securityConfig.content_security_policy.connect_src],
      objectSrc: [...securityConfig.content_security_policy.object_src],
      mediaSrc: [...securityConfig.content_security_policy.media_src],
      frameSrc: [...securityConfig.content_security_policy.frame_src],
      childSrc: [...securityConfig.content_security_policy.child_src],
      workerSrc: [...securityConfig.content_security_policy.worker_src],
      manifestSrc: [...securityConfig.content_security_policy.manifest_src],
    };

    // Auto-add configured icon URLs to img-src
    const iconUrls = [serverConfig.login_icon_url, serverConfig.landing_icon_url].filter(Boolean);

    for (const iconUrl of iconUrls) {
      if (iconUrl.startsWith('https://') || iconUrl.startsWith('http://')) {
        try {
          const url = new URL(iconUrl);
          const domain = `${url.protocol}//${url.hostname}`;
          if (!cspDirectives.imgSrc.includes(domain)) {
            cspDirectives.imgSrc.push(domain);
            logger.info(`Auto-added ${domain} to CSP img-src for configured icon`);
          }
        } catch {
          logger.warn(`Invalid icon URL in config: ${iconUrl}`);
        }
      }
    }

    helmetConfig.contentSecurityPolicy = { directives: cspDirectives };
  }

  // Configure HSTS if enabled
  if (securityConfig.hsts.enabled) {
    helmetConfig.hsts = {
      maxAge: securityConfig.hsts.max_age,
      includeSubDomains: securityConfig.hsts.include_subdomains,
      preload: securityConfig.hsts.preload,
    };
  }

  // Configure additional security headers
  helmetConfig.noSniff = securityConfig.headers.x_content_type_nosniff;
  helmetConfig.frameguard = { action: securityConfig.headers.x_frame_options.toLowerCase() };
  helmetConfig.xssFilter = securityConfig.headers.x_xss_protection;
  helmetConfig.referrerPolicy = { policy: securityConfig.headers.referrer_policy };
  helmetConfig.crossOriginEmbedderPolicy = securityConfig.headers.cross_origin_embedder_policy;

  app.use(helmet(helmetConfig));
  app.use(compression());
  app.use(cookieParser());

  const authConfig = configLoader.getAuthenticationConfig();
  app.use(
    session({
      secret: authConfig.jwt_secret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: true,
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000,
      },
    })
  );

  // Initialize Passport for OIDC authentication
  app.use(passport.initialize());
  app.use(passport.session());

  // Create selective CSRF middleware - only apply to web form routes
  const selectiveCSRF = (req, res, next) => {
    // Skip CSRF for API routes, SSE, and authentication endpoints
    if (
      req.path.startsWith('/api/') ||
      req.path.startsWith('/auth/') ||
      req.path.startsWith('/static/') ||
      req.method === 'GET' ||
      req.headers.authorization || // Skip for API key/Basic auth requests
      req.headers.accept === 'text/event-stream' // Skip for SSE
    ) {
      return next();
    }

    // Apply CSRF protection for web form operations
    return lusca.csrf()(req, res, next);
  };

  app.use(morganMiddleware);
  app.use(rateLimiterMiddleware());
  app.use(configAwareI18nMiddleware);
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Apply selective CSRF protection
  app.use(selectiveCSRF);

  // Check for revoked tokens (applies to all authenticated requests)
  app.use(checkTokenRevocation);

  app.use('/', authRoutes);

  // Terminal session routes
  app.use('/api/terminal', terminalRoutes);

  // Swagger and API documentation routes
  app.use('/api', swaggerRoutes);

  // Serve static CSS files for Swagger theming
  app.use(
    '/static',
    express.static('web/public', {
      setHeaders: (response, filePath) => {
        logger.debug('Setting headers for static file', { filePath });
        if (filePath.endsWith('.css')) {
          response.setHeader('Content-Type', 'text/css');
        }
      },
    })
  );

  if (configLoader.getServerConfig().enable_api_docs) {
    logger.info('Endpoint documentation enabled at /api-docs (React implementation)');
  }

  // React app catch-all for client-side routing
  // Only serves React app for non-API, non-file paths that don't have custom index.html
  app.get('/*splat', (req, res, next) => {
    if (
      req.path.startsWith('/api/') ||
      req.path.startsWith('/auth/') ||
      req.path.startsWith('/static/') ||
      req.path.startsWith('/swagger/') ||
      req.path.startsWith('/assets/')
    ) {
      return next();
    }

    const distPath = 'web/dist';
    if (existsSync(distPath)) {
      return res.sendFile(path.resolve(distPath, 'index.html'));
    }
    return next();
  });

  app.use(errorHandler);

  const sslConfig = configLoader.getSSLConfig();
  const httpsServer = await setupHTTPSServer(app, sslConfig, port);

  if (httpsServer) {
    // Setup WebSocket upgrade handler for terminal
    httpsServer.on('upgrade', async (request, socket, head) => {
      try {
        const url = new URL(request.url, `https://${request.headers.host}`);
        const termMatch = url.pathname.match(/^\/ws\/terminal\/(?<sessionId>[^/]+)$/);

        if (!termMatch) {
          logger.debug('WebSocket upgrade rejected: URL does not match terminal pattern', {
            pathname: url.pathname,
          });
          socket.destroy();
          return;
        }

        const { sessionId } = termMatch.groups;
        const ptyProcess = getPtyProcess(sessionId);

        if (!ptyProcess) {
          logger.warn('WebSocket upgrade failed: PTY process not found', { sessionId });
          socket.destroy();
          return;
        }

        logger.info('WebSocket terminal connected', { sessionId });

        const { WebSocketServer } = await import('ws');
        const wss = new WebSocketServer({ noServer: true });

        wss.handleUpgrade(request, socket, head, clientWs => {
          logger.info('Client WebSocket established for terminal', { sessionId });

          clientWs.on('message', data => {
            try {
              // Try to parse as JSON for control messages (e.g., resize)
              const message = JSON.parse(data);
              if (message.type === 'resize' && message.cols && message.rows) {
                ptyProcess.resize(message.cols, message.rows);
                logger.debug('PTY resized', {
                  sessionId,
                  cols: message.cols,
                  rows: message.rows,
                });
                return;
              }
            } catch {
              // Not JSON or invalid message, treat as regular terminal input
            }
            ptyProcess.write(data);
          });

          ptyProcess.on('data', data => {
            if (clientWs.readyState === 1) {
              clientWs.send(data);
            }
          });

          clientWs.on('close', () => {
            logger.info('WebSocket terminal disconnected', { sessionId });
          });

          clientWs.on('error', error => {
            logger.error('WebSocket error', { sessionId, error: error.message });
          });
        });
      } catch (error) {
        logger.error('WebSocket upgrade error', { error: error.message });
        socket.destroy();
      }
    });
  } else {
    logger.info('Starting HTTP server instead...');
    app.listen(port, () => {
      logger.info(`HTTP Server running at http://localhost:${port}`);
    });
  }
};

startServer();

//######################## ORIGINAL Code in server.js ########################//
//import express from 'express';
//import { WebSocketServer } from 'ws';
//import { spawn } from 'node-pty';
//import { fileURLToPath } from 'url';
//import { dirname, join } from 'path';
//import os from 'os';
//import https from 'https';
//import fs from 'fs/promises';
//import basicAuth from 'express-basic-auth';
//import yaml from 'js-yaml';
//import { logger, formatAuthLog, formatConnectionLog, formatCommandLog } from './logger.js';
//
//// Ensure logs directory exists
//try {
//    await fs.mkdir(join(__dirname, 'logs')).catch(() => {});
//} catch (error) {
//    console.error('Error creating logs directory:', error);
//}
//
//const __filename = fileURLToPath(import.meta.url);
//const __dirname = dirname(__filename);
//
//// Load configuration
//let config;
//try {
//    config = yaml.load(await fs.readFile(join(__dirname, 'config.yaml'), 'utf8'));
//} catch (error) {
//    console.error('Error loading config.yaml:', error);
//    process.exit(1);
//}
//
//const app = express();
//const port = config.server.port;
//
//// Basic authentication middleware
//app.use((req, res, next) => {
//    const ip = req.ip || req.connection.remoteAddress;
//    const auth = basicAuth({
//        users: config.users,
//        challenge: true,
//        realm: 'Web Terminal',
//        authorizer: (username, password) => {
//            const authorized = config.users[username] === password;
//            logger.info(formatAuthLog(ip, username, authorized));
//            return authorized;
//        }
//    });
//    auth(req, res, next);
//});
//
//// Log all requests
//app.use((req, res, next) => {
//    const ip = req.ip || req.connection.remoteAddress;
//    logger.info(formatConnectionLog(ip, 'http', 'connected'));
//    next();
//});
//
//// Add security headers
//app.use((req, res, next) => {
//    res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet');
//    res.setHeader('X-Content-Type-Options', 'nosniff');
//    res.setHeader('X-Frame-Options', 'DENY');
//    next();
//});
//
//// Serve static files
//app.use(express.static(__dirname));
//
//// Serve robots.txt
//app.get('/robots.txt', (req, res) => {
//    res.type('text/plain');
//    res.send('User-agent: *\nDisallow: /\nX-Robots-Tag: noindex, nofollow, noarchive, nosnippet');
//});
//
//// WebSocket connection handler
//function setupWebSocketServer(server) {
//    const wss = new WebSocketServer({ 
//        server,
//        verifyClient: (info, cb) => {
//            const auth = info.req.headers.authorization;
//            if (!auth) {
//                cb(false, 401, 'Unauthorized');
//                return;
//            }
//            
//            const [username, password] = Buffer.from(auth.split(' ')[1], 'base64')
//                .toString()
//                .split(':');
//                
//            if (config.users[username] === password) {
//                cb(true);
//            } else {
//                cb(false, 401, 'Unauthorized');
//            }
//        }
//    });
//
//    wss.on('connection', (ws, req) => {
//        const ip = req.socket.remoteAddress;
//        const auth = req.headers.authorization || '';
//        const [username] = Buffer.from(auth.split(' ')[1] || '', 'base64')
//            .toString()
//            .split(':');
//            
//        logger.info(formatConnectionLog(ip, 'websocket', 'connected'));
//
//        // Spawn terminal
//        const shell = os.platform() === 'win32' ? 'powershell.exe' : config.terminal.shell;
//        const pty = spawn(shell, [], {
//            name: 'xterm-color',
//            cols: config.terminal.cols,
//            rows: config.terminal.rows,
//            cwd: process.env.HOME,
//            env: process.env
//        });
//
//        // Handle incoming data from client
//        ws.on('message', (data) => {
//            const command = data.toString();
//            logger.info(formatCommandLog(ip, username, command));
//            pty.write(data);
//        });
//
//        // Send terminal output to client
//        pty.on('data', (data) => {
//            try {
//                ws.send(data);
//            } catch (ex) {
//                // Client probably disconnected
//            }
//        });
//
//        // Clean up on close
//        ws.on('close', () => {
//            pty.kill();
//            logger.info(formatConnectionLog(ip, 'websocket', 'disconnected'));
//        });
//    });
//}
//
//// Start server
//async function startServer() {
//    try {
//        // SSL configuration
//        const sslOptions = {
//            cert: await fs.readFile(config.server.ssl.cert),
//            key: await fs.readFile(config.server.ssl.key)
//        };
//
//        // Create HTTPS server
//        const server = https.createServer(sslOptions, app);
//        server.listen(port, () => {
//            console.log(`HTTPS Server running at https://localhost:${port}`);
//        });
//
//        // Setup WebSocket server
//        setupWebSocketServer(server);
//    } catch (error) {
//        console.error('Failed to start HTTPS server:', error);
//        process.exit(1);
//    }
//}
//
//startServer();
