import { rateLimit } from 'express-rate-limit';
import { existsSync } from 'fs';
import path from 'path';
import configLoader from '../config/configLoader.js';
import { logger } from '../config/logger.js';

export const rateLimiterMiddleware = () => {
  const rateLimitConfig = configLoader.getRateLimitConfig();

  return rateLimit({
    windowMs: rateLimitConfig.window_minutes * 60 * 1000,
    max: rateLimitConfig.max_requests,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: rateLimitConfig.skip_successful_requests,
    skipFailedRequests: rateLimitConfig.skip_failed_requests,
    handler: (req, res) => {
      // Log rate limit hit with Winston
      logger.warn('Rate limit exceeded', {
        ip: req.ip,
        method: req.method,
        url: req.url,
        userAgent: req.get('User-Agent'),
        remaining: res.getHeader('X-RateLimit-Remaining') || 0,
        limit: res.getHeader('X-RateLimit-Limit') || rateLimitConfig.max_requests,
        resetTime: res.getHeader('X-RateLimit-Reset'),
        windowMinutes: rateLimitConfig.window_minutes,
      });

      // Serve React app with error state instead of plain text
      const distPath = 'web/dist';
      if (existsSync(distPath)) {
        res.status(429);
        return res.sendFile(path.resolve(distPath, 'index.html'));
      }
      // Fallback to plain message if React app not available
      return res.status(429).send(rateLimitConfig.message);
    },
  });
};
