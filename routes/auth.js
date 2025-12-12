import express from 'express';
import jwt from 'jsonwebtoken';
import * as jose from 'jose';
import * as client from 'openid-client';
import configLoader from '../config/configLoader.js';
import { isValidUser, getUserPermissions } from '../utils/auth.js';
import { logAccess, authLogger as logger } from '../config/logger.js';
import {
  buildAuthorizationUrl,
  handleOidcCallback,
  buildEndSessionUrl,
  getOidcConfiguration,
} from '../config/passport.js';
import { revokeUserTokens, trackIssuedToken } from '../middleware/tokenRevocation.js';

/**
 * @swagger
 * tags:
 *   - name: Authentication
 *     description: User authentication and session management endpoints
 */

const router = express.Router();

/**
 * @swagger
 * /login:
 *   get:
 *     summary: Serve login page
 *     description: Serves the main login page (React application) for user authentication
 *     tags: [Authentication]
 *     responses:
 *       200:
 *         description: Login page served successfully
 *         content:
 *           text/html:
 *             schema:
 *               type: string
 *               description: HTML content of the login page
 */
router.get('/login', (req, res) => {
  logAccess(req, 'LOGIN_PAGE', 'serving React app');
  res.sendFile('index.html', { root: './web/dist' });
});

/**
 * @swagger
 * /auth/methods:
 *   get:
 *     summary: Get available authentication methods
 *     description: Retrieve list of enabled authentication methods including basic auth and OIDC providers
 *     tags: [Authentication]
 *     responses:
 *       200:
 *         description: Successfully retrieved authentication methods
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 methods:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         description: Unique identifier for the auth method
 *                         example: basic
 *                       name:
 *                         type: string
 *                         description: Display name for the auth method
 *                         example: Username/Password
 *                       enabled:
 *                         type: boolean
 *                         description: Whether this method is available
 *                         example: true
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/auth/methods', (req, res) => {
  try {
    const authConfig = configLoader.getAuthenticationConfig();
    const oidcProviderParam = req.query.oidc_provider;
    const authMethodParam = req.query.auth_method;

    const methods = [];

    const isBasicHidden = authConfig.basic_auth_hidden || false;
    const shouldShowBasic = authMethodParam === 'basic' || !isBasicHidden;

    if (shouldShowBasic) {
      methods.push({
        id: 'basic',
        name: 'Username/Password',
        enabled: true,
      });
    }

    const oidcProviders = authConfig.oidc_providers || {};
    const isGloballyHidden = authConfig.oidc_global_hidden || false;

    const oidcMethods = Object.entries(oidcProviders)
      .filter(([, providerConfig]) => providerConfig.enabled)
      .filter(([providerName, providerConfig]) => {
        if (oidcProviderParam) {
          return providerName === oidcProviderParam;
        }

        if (isGloballyHidden) {
          return false;
        }

        if (providerConfig.hidden) {
          return false;
        }

        return true;
      })
      .map(([providerName, providerConfig]) => ({
        id: `oidc-${providerName}`,
        name: providerConfig.display_name || `Sign in with ${providerName}`,
        enabled: true,
        color: providerConfig.color || '#198754',
      }));

    methods.push(...oidcMethods);

    const uiConfig = configLoader.getConfig();

    let userInfo = null;
    if (req.user || req.oidcUser) {
      const user = req.user || req.oidcUser;
      userInfo = {
        permissions: getUserPermissions(user),
      };
    }

    return res.json({
      success: true,
      methods,
      ui: {
        login_primary_color: uiConfig.server?.login_primary_color || '#198754',
        landing_title: uiConfig.server?.landing_title,
        landing_subtitle: uiConfig.server?.landing_subtitle,
        landing_description: uiConfig.server?.landing_description,
        landing_icon_class: uiConfig.server?.landing_icon_class,
        landing_icon_url: uiConfig.server?.landing_icon_url,
        landing_primary_color: uiConfig.server?.landing_primary_color,
        support_email: uiConfig.server?.support_email,
      },
      user: userInfo,
    });
  } catch (error) {
    logger.error('Auth methods error', { error: error.message });
    logAccess(req, 'AUTH_METHODS_ERROR', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to load authentication methods',
    });
  }
});

/**
 * @swagger
 * /auth/oidc/callback:
 *   get:
 *     summary: OIDC authentication callback
 *     description: Handles the OAuth2/OIDC callback from authentication providers after user authorization
 *     tags: [Authentication]
 *     parameters:
 *       - in: query
 *         name: code
 *         schema:
 *           type: string
 *         description: Authorization code from OIDC provider
 *         example: abc123...
 *       - in: query
 *         name: state
 *         schema:
 *           type: string
 *         description: State parameter for CSRF protection
 *         example: xyz789...
 *       - in: query
 *         name: error
 *         schema:
 *           type: string
 *         description: Error code if authentication failed
 *         example: access_denied
 *     responses:
 *       302:
 *         description: Redirect after successful or failed authentication
 *         headers:
 *           Location:
 *             schema:
 *               type: string
 *               example: /?success=true
 *           Set-Cookie:
 *             schema:
 *               type: string
 *               description: JWT authentication cookie (on success)
 *               example: auth_token=jwt.token.here; HttpOnly; Secure
 */
router.get('/auth/oidc/callback', async (req, res) => {
  logger.info('OIDC callback received', {
    sessionId: req.sessionID,
    hasSession: !!req.session,
    sessionKeys: req.session ? Object.keys(req.session) : [],
  });

  const provider = req.session?.oidcProvider;
  const state = req.session?.oidcState;
  const codeVerifier = req.session?.oidcCodeVerifier;
  const returnUrl = req.session?.oidcReturnUrl || '/';

  logger.info('OIDC callback provider resolution', {
    provider,
    hasState: !!state,
    hasCodeVerifier: !!codeVerifier,
    returnUrl,
  });

  if (!provider || !state || !codeVerifier) {
    logger.error('Missing OIDC session data during callback');
    return res.redirect('/login?error=oidc_failed');
  }

  // Clean up session data
  if (req.session) {
    delete req.session.oidcProvider;
    delete req.session.oidcState;
    delete req.session.oidcCodeVerifier;
    delete req.session.oidcReturnUrl;
  }

  try {
    logger.info(`Processing OIDC callback for provider: ${provider}`);

    // Create current URL from request
    const serverConfig = configLoader.getServerConfig();
    // Don't include port 443 for HTTPS as it's the default
    const baseUrl =
      serverConfig.port === 443
        ? `https://${serverConfig.domain}`
        : `https://${serverConfig.domain}:${serverConfig.port}`;
    const currentUrl = new URL(baseUrl + req.url);

    // Handle the callback using v6 API
    const { user, tokens } = await handleOidcCallback(provider, currentUrl, state, codeVerifier);

    // Generate JWT token with jti, sub, and sid for revocation support
    const authConfig = configLoader.getAuthenticationConfig();
    const jti = `${user.id}-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    // Extract sub and sid from ID token for backchannel logout matching
    const idTokenClaims = tokens?.claims();
    const oidcSub = idTokenClaims?.sub;
    const oidcSid = idTokenClaims?.sid;

    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        name: user.name,
        provider: user.provider,
        permissions: user.permissions,
        role: user.role,
        id_token: tokens?.id_token,
        sub: oidcSub, // Store OIDC sub for backchannel logout
        sid: oidcSid, // Store OIDC sid for session-specific revocation
        jti,
      },
      authConfig.jwt_secret,
      {
        expiresIn: authConfig.jwt_expiration,
        issuer: 'web-terminal',
        audience: 'web-terminal-users',
      }
    );

    // Track this token for potential revocation
    const decoded = jwt.decode(token);
    await trackIssuedToken(jti, oidcSub, oidcSid, decoded.exp);

    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: true,
      maxAge: 24 * 60 * 60 * 1000,
    });

    logger.info('OIDC authentication completed successfully', {
      email: user.email,
      provider,
      jti,
      sid: oidcSid,
    });
    logAccess(req, 'OIDC_SUCCESS', `user: ${user.email}`);
    return res.redirect(returnUrl);
  } catch (error) {
    logger.error('OIDC callback authentication error', {
      error: error.message,
      provider,
    });
    logAccess(req, 'OIDC_CALLBACK_ERROR', error.message);
    return res.redirect('/login?error=oidc_failed');
  }
});

/**
 * @swagger
 * /auth/oidc/{provider}:
 *   get:
 *     summary: Initiate OIDC authentication
 *     description: Start OAuth2/OIDC authentication flow with the specified provider
 *     tags: [Authentication]
 *     parameters:
 *       - in: path
 *         name: provider
 *         required: true
 *         schema:
 *           type: string
 *         description: OIDC provider identifier (configured in authentication settings)
 *         example: google
 *       - in: query
 *         name: return
 *         schema:
 *           type: string
 *         description: URL to redirect to after successful authentication
 *         example: /files/uploads
 *     responses:
 *       302:
 *         description: Redirect to OIDC provider authorization endpoint
 *         headers:
 *           Location:
 *             schema:
 *               type: string
 *               description: Authorization URL for the OIDC provider
 *               example: https://accounts.google.com/oauth/authorize?client_id=...
 */
router.get('/auth/oidc/:provider', async (req, res) => {
  const { provider } = req.params;

  try {
    logger.info(`Starting OIDC auth with provider: ${provider}`);
    logAccess(req, 'OIDC_START', `provider: ${provider}`);

    // Extract return URL from request query parameters
    const returnUrl = req.query.return ? decodeURIComponent(req.query.return) : '/';

    logger.info('OIDC return URL extraction', { queryReturn: req.query.return, returnUrl });

    // Generate security parameters
    const state = client.randomState();
    const codeVerifier = client.randomPKCECodeVerifier();

    // Store in session
    if (req.session) {
      req.session.oidcProvider = provider;
      req.session.oidcState = state;
      req.session.oidcCodeVerifier = codeVerifier;
      req.session.oidcReturnUrl = returnUrl;
      logger.info(`Stored OIDC session data for provider: ${provider}, returnUrl: ${returnUrl}`);
    } else {
      logger.error('No session available to store OIDC data');
      return res.redirect('/login?error=oidc_failed');
    }

    // Generate authorization URL
    const serverConfig = configLoader.getServerConfig();
    // Don't include port 443 for HTTPS as it's the default
    const redirectUri =
      serverConfig.port === 443
        ? `https://${serverConfig.domain}/auth/oidc/callback`
        : `https://${serverConfig.domain}:${serverConfig.port}/auth/oidc/callback`;

    const authUrl = await buildAuthorizationUrl(provider, redirectUri, state, codeVerifier);

    logger.info(`Redirecting to authorization URL for provider: ${provider}`);
    return res.redirect(authUrl.toString());
  } catch (error) {
    logger.error(`Failed to start OIDC auth for provider ${provider}:`, error.message);
    logAccess(req, 'OIDC_START_ERROR', error.message);
    return res.redirect('/login?error=oidc_failed');
  }
});

/**
 * @swagger
 * /auth/status:
 *   get:
 *     summary: Check authentication status
 *     description: Check if user is currently authenticated and return user info
 *     tags: [Authentication]
 *     responses:
 *       200:
 *         description: Authentication status retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 authenticated:
 *                   type: boolean
 *                   example: true
 *                 user:
 *                   type: object
 *                   properties:
 *                     username:
 *                       type: string
 *                       example: admin
 *                     role:
 *                       type: string
 *                       example: admin
 *                     email:
 *                       type: string
 *                       example: admin@example.com
 */
router.get('/auth/status', (req, res) => {
  try {
    const token = req.cookies.auth_token;

    if (!token) {
      return res.json({
        authenticated: false,
        user: null,
      });
    }

    const authConfig = configLoader.getAuthenticationConfig();
    const decoded = jwt.verify(token, authConfig.jwt_secret);

    return res.json({
      authenticated: true,
      user: {
        username: decoded.username || decoded.email,
        role: decoded.role,
        email: decoded.email,
        name: decoded.name,
        provider: decoded.provider || 'basic',
        permissions: decoded.permissions || [],
      },
    });
  } catch (error) {
    logger.error('Auth status check error', { error: error.message });
    return res.json({
      authenticated: false,
      user: null,
    });
  }
});

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Logout user
 *     description: Clear authentication token and logout the user
 *     tags: [Authentication]
 *     responses:
 *       200:
 *         description: Logout successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Logged out successfully
 */
router.post('/auth/logout', (req, res) => {
  try {
    // Extract JWT token to determine authentication method
    const token = req.cookies.auth_token;
    let userProvider = null;
    let idToken = null;

    if (token) {
      try {
        const authConfig = configLoader.getAuthenticationConfig();
        const decoded = jwt.verify(token, authConfig.jwt_secret);
        userProvider = decoded.provider;
        idToken = decoded.id_token;
      } catch (jwtError) {
        logger.warn('Failed to decode JWT token during logout', { error: jwtError.message });
      }
    }

    res.clearCookie('auth_token');
    logAccess(req, 'LOGOUT', 'JWT cookie cleared');

    if (userProvider && userProvider.startsWith('oidc-')) {
      const providerName = userProvider.replace('oidc-', '');

      try {
        const serverConfig = configLoader.getServerConfig();
        const postLogoutRedirectUri =
          serverConfig.port === 443
            ? `https://${serverConfig.domain}/login?logout=success`
            : `https://${serverConfig.domain}:${serverConfig.port}/login?logout=success`;

        const state = client.randomState();

        const endSessionUrl = buildEndSessionUrl(
          providerName,
          postLogoutRedirectUri,
          state,
          idToken
        );

        if (endSessionUrl) {
          logger.info(`Redirecting to OIDC provider logout: ${providerName}`);
          return res.json({
            success: true,
            message: 'Logged out successfully',
            redirect_url: endSessionUrl.toString(),
          });
        }
      } catch (error) {
        logger.error(`Failed to build end session URL for provider ${providerName}:`, {
          message: error.message,
          stack: error.stack,
          name: error.name,
          code: error.code,
          cause: error.cause,
        });
      }
    }

    return res.json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    logger.error('Logout error', { error: error.message });
    return res.status(500).json({
      success: false,
      message: 'Logout failed',
    });
  }
});

/**
 * @swagger
 * /auth/login/basic:
 *   post:
 *     summary: Basic authentication login
 *     description: Authenticate using username and password to receive JWT token
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [username, password]
 *             properties:
 *               username:
 *                 type: string
 *                 description: Username for authentication
 *                 example: admin
 *               password:
 *                 type: string
 *                 description: Password for authentication
 *                 example: admin123
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Login successful
 *       400:
 *         description: Missing username or password
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/auth/login/basic', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({
      success: false,
      message: 'Username and password required',
    });
  }

  const credentials = { name: username, pass: password };
  const user = isValidUser(credentials);

  if (!user) {
    logAccess(req, 'BASIC_AUTH_FAILED', `username: ${username}`);
    return res.status(401).json({
      success: false,
      message: 'Invalid credentials',
    });
  }

  const permissions = getUserPermissions(user);

  const authConfig = configLoader.getAuthenticationConfig();
  const jti = `basic-${username}-${Date.now()}-${Math.random().toString(36).substring(7)}`;

  const token = jwt.sign(
    {
      username: user.username,
      role: user.role,
      permissions,
      authType: 'basic',
      jti,
    },
    authConfig.jwt_secret,
    {
      expiresIn: authConfig.jwt_expiration,
      issuer: 'web-terminal',
      audience: 'web-terminal-users',
    }
  );

  res.cookie('auth_token', token, {
    httpOnly: true,
    secure: true,
    maxAge: 24 * 60 * 60 * 1000,
  });

  logAccess(
    req,
    'BASIC_AUTH_SUCCESS',
    `username: ${username}, role: ${user.role}, permissions: ${permissions.join(',')}`
  );

  return res.json({
    success: true,
    message: 'Login successful',
  });
});

/**
 * @swagger
 * /logout:
 *   get:
 *     summary: Logout user via GET request
 *     description: Clear authentication token and logout the user, with OIDC provider logout support
 *     tags: [Authentication]
 *     responses:
 *       302:
 *         description: Redirect after logout
 *         headers:
 *           Location:
 *             schema:
 *               type: string
 *               description: Redirect location after logout
 *               example: /login?logout=success
 */
router.get('/logout', (req, res) => {
  try {
    // Extract JWT token to determine authentication method
    const token = req.cookies.auth_token;
    let userProvider = null;
    let idToken = null;

    if (token) {
      try {
        const authConfig = configLoader.getAuthenticationConfig();
        const decoded = jwt.verify(token, authConfig.jwt_secret);
        userProvider = decoded.provider;
        idToken = decoded.id_token;
      } catch (jwtError) {
        logger.warn('Failed to decode JWT token during logout', { error: jwtError.message });
      }
    }

    res.clearCookie('auth_token');
    logAccess(req, 'LOGOUT', 'JWT cookie cleared via GET');

    if (userProvider && userProvider.startsWith('oidc-')) {
      const providerName = userProvider.replace('oidc-', '');

      try {
        const serverConfig = configLoader.getServerConfig();
        const postLogoutRedirectUri =
          serverConfig.port === 443
            ? `https://${serverConfig.domain}/login?logout=success`
            : `https://${serverConfig.domain}:${serverConfig.port}/login?logout=success`;

        const state = client.randomState();

        const endSessionUrl = buildEndSessionUrl(
          providerName,
          postLogoutRedirectUri,
          state,
          idToken
        );

        if (endSessionUrl) {
          logger.info(`Redirecting to OIDC provider logout: ${providerName}`);
          return res.redirect(endSessionUrl.toString());
        }
      } catch (error) {
        logger.error(`Failed to build end session URL for provider ${providerName}:`, {
          message: error.message,
          stack: error.stack,
          name: error.name,
          code: error.code,
          cause: error.cause,
        });
      }
    }

    return res.redirect('/login');
  } catch (error) {
    logger.error('Logout error', { error: error.message });
    return res.redirect('/login?error=logout_failed');
  }
});

/**
 * @swagger
 * /logout/local:
 *   get:
 *     summary: Local logout only (skips OIDC provider logout)
 *     description: Clears local JWT token without redirecting to OIDC provider logout endpoint
 *     tags: [Authentication]
 *     responses:
 *       302:
 *         description: Redirected to login page
 *         headers:
 *           Location:
 *             schema:
 *               type: string
 *               example: /login?logout=success
 */
router.get('/logout/local', (req, res) => {
  try {
    res.clearCookie('auth_token');
    logAccess(req, 'LOCAL_LOGOUT', 'JWT cookie cleared via local logout');
    return res.redirect('/login?logout=success');
  } catch (error) {
    logger.error('Local logout error', { error: error.message });
    return res.redirect('/login?error=logout_failed');
  }
});

/**
 * @swagger
 * /auth/logout/local:
 *   post:
 *     summary: Local logout only (skips OIDC provider logout)
 *     description: Clears local JWT token without redirecting to OIDC provider logout endpoint
 *     tags: [Authentication]
 *     responses:
 *       200:
 *         description: Local logout successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Logged out locally
 *       500:
 *         description: Logout failed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/auth/logout/local', (req, res) => {
  try {
    res.clearCookie('auth_token');
    logAccess(req, 'LOCAL_LOGOUT', 'JWT cookie cleared via local logout POST');
    return res.json({
      success: true,
      message: 'Logged out locally',
    });
  } catch (error) {
    logger.error('Local logout error', { error: error.message });
    return res.status(500).json({
      success: false,
      message: 'Local logout failed',
    });
  }
});

/**
 * @swagger
 * /auth/logout/backchannel:
 *   post:
 *     summary: OIDC backchannel logout
 *     description: Receives logout notifications from OIDC providers when users log out. Validates the logout_token JWT and revokes user sessions based on configuration.
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/x-www-form-urlencoded:
 *           schema:
 *             type: object
 *             required: [logout_token]
 *             properties:
 *               logout_token:
 *                 type: string
 *                 description: Signed JWT containing logout information
 *                 example: eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...
 *     responses:
 *       200:
 *         description: Logout processed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *       400:
 *         description: Invalid logout token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: invalid_request
 *                 error_description:
 *                   type: string
 *                   example: Invalid logout_token
 *       501:
 *         description: Backchannel logout not enabled
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: unsupported_logout_method
 *                 error_description:
 *                   type: string
 *                   example: Backchannel logout is not enabled
 */
router.post('/auth/logout/backchannel', async (req, res) => {
  try {
    const authConfig = configLoader.getAuthenticationConfig();

    // Check if backchannel logout is enabled
    if (!authConfig.backchannel_logout?.enabled) {
      logger.warn('Backchannel logout request received but feature is disabled');
      return res.status(501).json({
        error: 'unsupported_logout_method',
        error_description: 'Backchannel logout is not enabled',
      });
    }

    const { logout_token } = req.body;

    if (!logout_token) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'logout_token parameter is required',
      });
    }

    // Decode the logout_token to get the issuer (before verification)
    const decodedToken = jwt.decode(logout_token, { complete: true });

    if (!decodedToken) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'Invalid logout_token format',
      });
    }

    const { iss, sub, sid, events } = decodedToken.payload;

    // Validate required claims
    if (!iss || !events || (!sub && !sid)) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'logout_token missing required claims',
      });
    }

    // Validate events claim
    if (!events['http://schemas.openid.net/event/backchannel-logout']) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'logout_token missing backchannel-logout event',
      });
    }

    // Find the provider configuration by matching issuer
    const oidcProviders = authConfig.oidc_providers || {};
    const providerEntry = Object.entries(oidcProviders).find(
      ([, config]) => config.issuer === iss && config.enabled
    );

    if (!providerEntry) {
      logger.warn('Backchannel logout from unknown provider', { iss });
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'Unknown issuer',
      });
    }

    const [providerName] = providerEntry;

    // Get OIDC configuration to verify token signature
    const oidcConfig = getOidcConfiguration(providerName);

    if (!oidcConfig) {
      logger.error('OIDC configuration not found for provider', { providerName });
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'Provider configuration not available',
      });
    }

    // Verify the logout_token signature using jose library
    try {
      const jwksUri = oidcConfig.serverMetadata().jwks_uri;
      const JWKS = jose.createRemoteJWKSet(new URL(jwksUri));

      const { payload } = await jose.jwtVerify(logout_token, JWKS, {
        issuer: iss,
        audience: providerEntry[1].client_id,
      });

      logger.info('Logout token validated successfully', {
        provider: providerName,
        sub: payload.sub,
        sid: payload.sid,
      });
    } catch (error) {
      logger.error('Logout token validation failed', {
        provider: providerName,
        error: error.message,
      });
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'Invalid logout_token signature or claims',
      });
    }

    // Revoke tokens based on configuration (sid, sub, or both)
    await revokeUserTokens(sub, sid, 'backchannel_logout');

    logger.info('Backchannel logout processed successfully', {
      provider: providerName,
      sub,
      sid,
    });

    logAccess(
      req,
      'BACKCHANNEL_LOGOUT',
      `provider: ${providerName}, sub: ${sub || 'N/A'}, sid: ${sid || 'N/A'}`
    );

    return res.status(200).json({
      success: true,
    });
  } catch (error) {
    logger.error('Backchannel logout error', { error: error.message, stack: error.stack });
    return res.status(400).json({
      error: 'invalid_request',
      error_description: 'Failed to process logout_token',
    });
  }
});

/**
 * @swagger
 * /web/public/images/favicon.ico:
 *   get:
 *     summary: Serve favicon
 *     description: Serves the application favicon with caching headers
 *     tags: [Static Resources]
 *     responses:
 *       200:
 *         description: Favicon served successfully
 *         content:
 *           image/x-icon:
 *             schema:
 *               type: string
 *               format: binary
 *               description: Favicon image file
 *         headers:
 *           Cache-Control:
 *             schema:
 *               type: string
 *               example: public, max-age=86400
 */
router.get('/web/public/images/favicon.ico', (req, res) => {
  logger.debug('Serving favicon', { ip: req.ip, userAgent: req.get('User-Agent') });
  res.set('Cache-Control', 'public, max-age=86400');
  return res.sendFile('/web/public/images/favicon.ico', { root: '.' });
});

/**
 * @swagger
 * /robots.txt:
 *   get:
 *     summary: Serve robots.txt
 *     description: Serves the robots.txt file for search engine crawlers with caching headers
 *     tags: [Static Resources]
 *     responses:
 *       200:
 *         description: Robots.txt served successfully
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *               description: Robots.txt directives for web crawlers
 *               example: |
 *                 User-agent: *
 *                 Disallow: /api/
 *                 Disallow: /auth/
 *         headers:
 *           Cache-Control:
 *             schema:
 *               type: string
 *               example: public, max-age=86400
 *           Content-Type:
 *             schema:
 *               type: string
 *               example: text/plain
 */
router.get('/robots.txt', (req, res) => {
  logger.debug('Serving robots.txt', { ip: req.ip, userAgent: req.get('User-Agent') });
  res.set('Cache-Control', 'public, max-age=86400');
  res.set('Content-Type', 'text/plain');
  return res.sendFile('/web/public/robots.txt', { root: '.' });
});

export default router;
