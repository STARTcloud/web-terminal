import auth from 'basic-auth';
import jwt from 'jsonwebtoken';
import configLoader from '../config/configLoader.js';
import { isValidUser, getUserPermissions } from '../utils/auth.js';
import { logAccess, authLogger as logger } from '../config/logger.js';

const checkJwtAuth = req => {
  const token = req.cookies?.auth_token;

  logger.info('JWT auth check', {
    hasToken: !!token,
    cookies: Object.keys(req.cookies || {}),
  });

  if (!token) {
    return false;
  }

  try {
    const authConfig = configLoader.getAuthenticationConfig();
    const decoded = jwt.verify(token, authConfig.jwt_secret);

    logger.info('JWT decoded successfully', {
      userId: decoded.userId,
      email: decoded.email,
      authType: decoded.authType,
    });

    // Simplified: Any valid JWT = authenticated
    req.user = decoded;
    return true;
  } catch (error) {
    logger.error('JWT verification failed', { error: error.message });
    return false;
  }
};

/**
 * Middleware to require authentication (any valid JWT)
 * Simplified: Authenticated = can access terminal
 */
export const requireAuthentication = (req, res, next) => {
  if (checkJwtAuth(req)) {
    logAccess(req, 'AUTH_SUCCESS', `user: ${req.user.email || req.user.username}`);
    return next();
  }

  logAccess(req, 'AUTH_FAILED', 'No valid JWT token');
  return res.status(401).json({
    success: false,
    message: 'Authentication required',
  });
};
