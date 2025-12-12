import express from 'express';
import { rateLimit } from 'express-rate-limit';
import configLoader from '../config/configLoader.js';
import { sseLogger as logger } from '../config/logger.js';
import { requireAuthentication } from '../middleware/auth.middleware.js';
import { t } from '../config/i18n.js';

const router = express.Router();

// Rate limiter for SSE endpoint to prevent DoS attacks
const sseLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 SSE connections per window
  message: t('rateLimit.sseConnectionsExceeded'),
  standardHeaders: true,
  legacyHeaders: false,
});

// Track connected clients (from DigitalOcean article)
let clients = [];

/**
 * @swagger
 * /api/events:
 *   get:
 *     summary: Server-Sent Events stream
 *     description: Establishes a Server-Sent Events connection for real-time system updates (legacy endpoint, may not be actively used in terminal application)
 *     tags: [Events]
 *     security:
 *       - JwtAuth: []
 *     responses:
 *       200:
 *         description: SSE connection established
 *         content:
 *           text/event-stream:
 *             schema:
 *               type: string
 *               description: Server-Sent Events stream for real-time updates
 *               example: |
 *                 data: []
 *         headers:
 *           Content-Type:
 *             schema:
 *               type: string
 *               example: text/event-stream
 *           Connection:
 *             schema:
 *               type: string
 *               example: keep-alive
 *           Cache-Control:
 *             schema:
 *               type: string
 *               example: no-cache
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/', sseLimiter, requireAuthentication, (req, res) => {
  // Set max listeners based on configuration to prevent false memory leak warnings
  const serverConfig = configLoader.getServerConfig();
  const maxConnections = serverConfig.sse_max_connections || 1000;
  res.setMaxListeners(maxConnections);

  const headers = {
    'Content-Type': 'text/event-stream',
    Connection: 'keep-alive',
    'Cache-Control': 'no-cache',
  };
  res.writeHead(200, headers);

  const data = `data: ${JSON.stringify([])}\n\n`;
  res.write(data);

  const clientId = Date.now();
  const newClient = {
    id: clientId,
    response: res,
  };
  clients.push(newClient);

  logger.info(t('logs.sseClientConnected'), {
    clientId,
    total: clients.length,
  });

  req.on('close', () => {
    logger.info(t('logs.sseClientDisconnected'), {
      clientId,
      total: clients.length - 1,
    });
    clients = clients.filter(client => client.id !== clientId);
  });
});

export const sendChecksumUpdate = (filePath, checksum, fileStats = null) => {
  logger.info(t('logs.sseSendingChecksumUpdate'), {
    filePath,
    checksum: `${checksum.substring(0, 8)}...`,
  });

  const eventData = JSON.stringify({
    type: 'checksum_complete',
    filePath,
    checksum,
    size: fileStats?.size || null,
    mtime: fileStats?.mtime || null,
    timestamp: new Date().toISOString(),
  });

  // Send to all connected clients (from DigitalOcean pattern)
  clients.forEach(client => {
    try {
      // Send custom event (from articles)
      client.response.write(`event: checksum-update\n`);
      client.response.write(`data: ${eventData}\n\n`);
    } catch (error) {
      logger.error(t('logs.errorSendingSseMessage'), { error: error.message });
      // Remove failed client
      clients = clients.filter(c => c.id !== client.id);
    }
  });

  logger.info(t('logs.sseEventSentSuccessfully'));
};

// Function to broadcast file deletion events
export const sendFileDeleted = (filePath, isDirectory = false) => {
  logger.info(t('logs.sseSendingFileDeletionEvent'), {
    filePath,
    isDirectory,
  });

  const eventData = JSON.stringify({
    type: 'file_deleted',
    filePath,
    isDirectory,
    timestamp: new Date().toISOString(),
  });

  // Send to all connected clients
  clients.forEach(client => {
    try {
      client.response.write(`event: file-deleted\n`);
      client.response.write(`data: ${eventData}\n\n`);
    } catch (error) {
      logger.error(t('logs.errorSendingSseDeleteMessage'), { error: error.message });
      clients = clients.filter(c => c.id !== client.id);
    }
  });

  logger.info(t('logs.sseFileDeletionEventSent'));
};

// Function to broadcast file addition events
export const sendFileAdded = (filePath, fileStats = null) => {
  logger.info(t('logs.sseSendingFileAdditionEvent'), {
    filePath,
  });

  const eventData = JSON.stringify({
    type: 'file_added',
    filePath,
    size: fileStats?.size || null,
    mtime: fileStats?.mtime || null,
    timestamp: new Date().toISOString(),
  });

  // Send to all connected clients
  clients.forEach(client => {
    try {
      client.response.write(`event: file-added\n`);
      client.response.write(`data: ${eventData}\n\n`);
    } catch (error) {
      logger.error(t('logs.errorSendingSseFileAdditionMessage'), { error: error.message });
      clients = clients.filter(c => c.id !== client.id);
    }
  });

  logger.info(t('logs.sseFileAdditionEventSent'));
};

// Function to broadcast folder creation events
export const sendFolderCreated = folderPath => {
  logger.info(t('logs.sseSendingFolderCreationEvent'), {
    folderPath,
  });

  const eventData = JSON.stringify({
    type: 'folder_created',
    folderPath,
    timestamp: new Date().toISOString(),
  });

  // Send to all connected clients
  clients.forEach(client => {
    try {
      client.response.write(`event: folder-created\n`);
      client.response.write(`data: ${eventData}\n\n`);
    } catch (error) {
      logger.error(t('logs.errorSendingFolderCreationMessage'), { error: error.message });
      clients = clients.filter(c => c.id !== client.id);
    }
  });

  logger.info(t('logs.sseFolderCreationEventSent'));
};

// Function to broadcast file/folder rename events
export const sendFileRenamed = (oldPath, newPath, isDirectory = false) => {
  logger.info(t('logs.sseSendingFileRenameEvent'), {
    oldPath,
    newPath,
    isDirectory,
  });

  const eventData = JSON.stringify({
    type: 'file_renamed',
    oldPath,
    newPath,
    isDirectory,
    timestamp: new Date().toISOString(),
  });

  // Send to all connected clients
  clients.forEach(client => {
    try {
      client.response.write(`event: file-renamed\n`);
      client.response.write(`data: ${eventData}\n\n`);
    } catch (error) {
      logger.error(t('logs.errorSendingSseRenameMessage'), { error: error.message });
      clients = clients.filter(c => c.id !== client.id);
    }
  });

  logger.info(t('logs.sseFileRenameEventSent'));
};

// Function to broadcast checksum progress updates
export const sendChecksumProgress = progressData => {
  logger.info(t('logs.sseSendingChecksumProgressEvent'), {
    total: progressData.total,
    complete: progressData.complete,
    percentage: progressData.percentage,
  });

  const eventData = JSON.stringify({
    type: 'checksum_progress',
    ...progressData,
    timestamp: new Date().toISOString(),
  });

  // Send to all connected clients
  clients.forEach(client => {
    try {
      client.response.write(`event: checksum-progress\n`);
      client.response.write(`data: ${eventData}\n\n`);
    } catch (error) {
      logger.error(t('logs.errorSendingSseProgressMessage'), { error: error.message });
      clients = clients.filter(c => c.id !== client.id);
    }
  });

  logger.info(t('logs.sseChecksumProgressEventSent'));
};

export default router;
