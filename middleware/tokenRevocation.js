import jwt from 'jsonwebtoken';
import { Op } from 'sequelize';
import configLoader from '../config/configLoader.js';
import { getRevokedTokenModel } from '../models/RevokedToken.js';
import { authLogger as logger } from '../config/logger.js';
import { t } from '../config/i18n.js';

/**
 * Track an issued JWT token
 * Called when we issue a new JWT to store it for potential revocation
 */
export const trackIssuedToken = async (jti, sub, sid, exp) => {
  const RevokedToken = getRevokedTokenModel();

  // Store the issued token (not revoked yet)
  // Using exp directly from JWT - no artificial timers
  await RevokedToken.create({
    jti,
    sub,
    sid,
    exp: new Date(exp * 1000), // Use JWT's natural expiration
    revoked_at: null,
    revocation_reason: null,
  });

  logger.info(t('logs.trackedIssuedToken'), { jti, sub, sid });
};

/**
 * Middleware to check if a JWT token has been revoked
 * This runs after authentication middleware but before route handlers
 */
export const checkTokenRevocation = async (req, res, next) => {
  try {
    const authConfig = configLoader.getAuthenticationConfig();

    // Skip check if backchannel logout is disabled
    if (!authConfig.backchannel_logout?.enabled) {
      return next();
    }

    const token = req.cookies?.auth_token || req.headers?.authorization?.replace('Bearer ', '');

    if (!token) {
      return next();
    }

    // Decode token without verification to get jti
    const decoded = jwt.decode(token);

    if (!decoded || !decoded.jti) {
      return next();
    }

    const RevokedToken = getRevokedTokenModel();

    // Check if this specific jti is revoked
    const revokedToken = await RevokedToken.findOne({
      where: {
        jti: decoded.jti,
        revoked_at: { [Op.ne]: null }, // Only check actually revoked tokens
      },
    });

    if (revokedToken) {
      logger.warn(t('logs.revokedTokenUsed'), {
        jti: decoded.jti,
        sub: decoded.sub,
        sid: decoded.sid,
        reason: revokedToken.revocation_reason,
      });

      res.clearCookie('auth_token');

      return res.status(401).json({
        success: false,
        message: t('auth.tokenRevoked'),
        error: 'token_revoked',
      });
    }

    return next();
  } catch (error) {
    logger.error(t('logs.tokenRevocationCheckError'), { error: error.message });
    return next();
  }
};

/**
 * Revoke tokens based on sub/sid from backchannel logout
 */
export const revokeUserTokens = async (sub, sid, reason = 'backchannel_logout') => {
  const RevokedToken = getRevokedTokenModel();
  const authConfig = configLoader.getAuthenticationConfig();
  const revocationScope = authConfig.backchannel_logout?.revocation_scope || 'both';

  const whereConditions = [];

  if (revocationScope === 'sid' && sid) {
    // Only revoke tokens with matching sid
    whereConditions.push({ sid });
  } else if (revocationScope === 'sub' && sub) {
    // Revoke all tokens for this user
    whereConditions.push({ sub });
  } else if (revocationScope === 'both') {
    // Revoke by both sid and sub
    if (sid) {
      whereConditions.push({ sid });
    }
    if (sub) {
      whereConditions.push({ sub });
    }
  }

  if (whereConditions.length === 0) {
    logger.warn(t('logs.noRevocationConditions'), { sub, sid, revocationScope });
    return;
  }

  // Mark matching tokens as revoked
  const updated = await RevokedToken.update(
    {
      revoked_at: new Date(),
      revocation_reason: reason,
    },
    {
      where: {
        [Op.or]: whereConditions,
        revoked_at: null, // Only revoke tokens that aren't already revoked
      },
    }
  );

  logger.info(t('logs.revokedTokens'), {
    count: updated[0],
    sub,
    sid,
    reason,
    scope: revocationScope,
  });
};

/**
 * Check if a specific JTI is revoked
 */
export const isTokenRevoked = async jti => {
  const RevokedToken = getRevokedTokenModel();

  const revokedToken = await RevokedToken.findOne({
    where: {
      jti,
      revoked_at: { [Op.ne]: null },
    },
  });

  return !!revokedToken;
};
