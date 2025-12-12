import { existsSync } from 'fs';
import path from 'path';
import { logAccess, logger } from '../config/logger.js';
import { t } from '../config/i18n.js';

export const errorHandler = (err, req, res, next) => {
  logger.error(t('logs.expressErrorHandler'), { error: err.message, stack: err.stack });

  if (req) {
    logAccess(req, 'ERROR', err.message);
  }

  // Check if response already sent
  if (res.headersSent) {
    return next(err);
  }

  // Serve React app with error state instead of plain text
  const distPath = 'web/dist';
  if (existsSync(distPath)) {
    res.status(500);
    return res.sendFile(path.resolve(distPath, 'index.html'));
  }

  // Fallback to plain message if React app not available
  return res.status(500).send(t('api.internalServerError'));
};
