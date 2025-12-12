import express from 'express';
import os from 'os';
import { spawn } from 'node-pty';
import { Op } from 'sequelize';
import { getTerminalSessionModel } from '../models/TerminalSession.js';
import { logger } from '../config/logger.js';
import { requireAuthentication } from '../middleware/auth.middleware.js';
import { t } from '../config/i18n.js';

const router = express.Router();

const shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash';
const SESSION_TIMEOUT_MINUTES = 30;

const activePtyProcesses = new Map();

const isSessionHealthy = sessionId => {
  try {
    const ptyProcess = activePtyProcesses.get(sessionId);
    if (!ptyProcess) {
      return false;
    }

    try {
      process.kill(ptyProcess.pid, 0);
      return true;
    } catch (pidError) {
      logger.debug(t('logs.processNoLongerExists'), {
        pid: ptyProcess.pid,
        error: pidError.message,
      });
      activePtyProcesses.delete(sessionId);
      return false;
    }
  } catch (error) {
    logger.error(t('logs.errorCheckingSessionHealth'), {
      error: error.message,
      session_id: sessionId,
    });
    return false;
  }
};

const createSessionRecord = async terminalCookie => {
  const TerminalSession = getTerminalSessionModel();

  const session = await TerminalSession.create({
    terminal_cookie: terminalCookie,
    pid: 0,
    status: 'connecting',
  });

  logger.debug(t('logs.sessionRecordCreated'), {
    terminal_cookie: terminalCookie,
  });

  return session;
};

const spawnPtyProcessAsync = async session => {
  try {
    const ptyProcess = spawn(shell, [], {
      name: 'xterm-color',
      cols: 80,
      rows: 30,
      env: process.env,
    });

    await session.update({
      pid: ptyProcess.pid,
      status: 'active',
    });

    activePtyProcesses.set(session.id, ptyProcess);

    logger.info(t('logs.ptyProcessSpawned'), {
      session_id: session.id,
      terminal_cookie: session.terminal_cookie,
      pid: ptyProcess.pid,
    });

    ptyProcess.on('exit', (code, signal) => {
      logger.info(t('logs.ptyProcessExited'), {
        session_id: session.id,
        terminal_cookie: session.terminal_cookie,
        exit_code: code,
        signal,
      });
      activePtyProcesses.delete(session.id);
      session.update({ status: 'closed' });
    });
  } catch (error) {
    logger.error(t('logs.failedToSpawnPty'), {
      session_id: session.id,
      terminal_cookie: session.terminal_cookie,
      error: error.message,
    });
    await session.update({ status: 'failed' });
  }
};

const cleanupInactiveSessions = async () => {
  const timeoutAgo = new Date(Date.now() - SESSION_TIMEOUT_MINUTES * 60 * 1000);

  try {
    const TerminalSession = getTerminalSessionModel();
    const inactiveSessions = await TerminalSession.findAll({
      where: {
        status: 'active',
        last_activity: { [Op.lt]: timeoutAgo },
      },
    });

    // Kill PTY processes and collect update promises
    const updatePromises = [];
    for (const session of inactiveSessions) {
      const ptyProcess = activePtyProcesses.get(session.id);
      if (ptyProcess) {
        ptyProcess.kill();
        activePtyProcesses.delete(session.id);
      }
      updatePromises.push(session.update({ status: 'closed' }));
    }

    // Update all sessions in parallel
    await Promise.all(updatePromises);

    const cleanedCount = inactiveSessions.length;
    if (cleanedCount > 0) {
      logger.info(t('logs.terminalCleanupCompleted'), {
        cleaned_sessions: cleanedCount,
        timeout_minutes: SESSION_TIMEOUT_MINUTES,
      });
    }

    return cleanedCount;
  } catch (error) {
    logger.error(t('logs.errorDuringCleanup'), {
      error: error.message,
      timeout_minutes: SESSION_TIMEOUT_MINUTES,
    });
    return 0;
  }
};

setInterval(cleanupInactiveSessions, 10 * 60 * 1000);

/**
 * @swagger
 * /api/terminal/start:
 *   post:
 *     summary: Start a new terminal session
 *     description: Creates a new terminal session with PTY process or reuses existing active session
 *     tags: [Terminal]
 *     security:
 *       - JwtAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - terminal_cookie
 *             properties:
 *               terminal_cookie:
 *                 type: string
 *                 description: Unique identifier for the terminal session
 *                 example: "session-12345"
 *     responses:
 *       200:
 *         description: Terminal session started or reused successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       description: Session identifier
 *                     websocket_url:
 *                       type: string
 *                       description: WebSocket URL for terminal I/O
 *                       example: "/ws/terminal/1"
 *                     reused:
 *                       type: boolean
 *                       description: Whether existing session was reused
 *                     created_at:
 *                       type: string
 *                       format: date-time
 *                     buffer:
 *                       type: string
 *                       description: Terminal buffer content
 *                     status:
 *                       type: string
 *                       enum: [connecting, active]
 *       400:
 *         description: Missing terminal_cookie parameter
 *       401:
 *         description: Authentication required
 *       500:
 *         description: Failed to start terminal session
 */
router.post('/start', requireAuthentication, async (req, res) => {
  try {
    const { terminal_cookie } = req.body;

    if (!terminal_cookie) {
      return res.status(400).json({
        success: false,
        error: t('terminal.cookieRequired'),
      });
    }

    const TerminalSession = getTerminalSessionModel();

    const existingSession = await TerminalSession.findOne({
      where: {
        terminal_cookie,
        status: 'active',
      },
    });

    if (existingSession) {
      const isHealthy = isSessionHealthy(existingSession.id);

      if (isHealthy) {
        await existingSession.update({
          last_activity: new Date(),
          last_accessed: new Date(),
        });

        logger.info(t('logs.terminalSessionReused'), {
          terminal_cookie,
          session_id: existingSession.id,
        });

        return res.json({
          success: true,
          data: {
            id: existingSession.terminal_cookie,
            websocket_url: `/ws/terminal/${existingSession.id}`,
            reused: true,
            created_at: existingSession.created_at,
            buffer: existingSession.session_buffer || '',
            status: 'active',
          },
        });
      }
    }

    if (existingSession) {
      const ptyProcess = activePtyProcesses.get(existingSession.id);
      if (ptyProcess) {
        ptyProcess.kill();
        activePtyProcesses.delete(existingSession.id);
      }
      await existingSession.destroy();
      logger.debug(t('logs.cleanedUpUnhealthySession'), {
        terminal_cookie,
        session_id: existingSession.id,
      });
    }

    let session;

    try {
      session = await createSessionRecord(terminal_cookie);
    } catch (error) {
      if (error.name === 'SequelizeUniqueConstraintError') {
        session = await TerminalSession.findOne({ where: { terminal_cookie } });
        if (!session) {
          throw new Error('Uniqueness error but session not found');
        }
        logger.warn(t('logs.sessionCollisionResolved'), {
          terminal_cookie,
        });
      } else {
        throw error;
      }
    }

    spawnPtyProcessAsync(session).catch(error => {
      logger.error(t('logs.asyncPtySpawnFailed'), {
        session_id: session.id,
        terminal_cookie,
        error: error.message,
      });
    });

    return res.json({
      success: true,
      data: {
        id: session.terminal_cookie,
        websocket_url: `/ws/terminal/${session.id}`,
        reused: false,
        created_at: session.created_at,
        buffer: '',
        status: 'connecting',
      },
    });
  } catch (error) {
    logger.error(t('logs.terminalSessionStartFailed'), {
      terminal_cookie: req.body.terminal_cookie,
      error: error.message,
    });
    return res.status(500).json({
      success: false,
      error: t('terminal.sessionFailed'),
    });
  }
});

/**
 * @swagger
 * /api/terminal/sessions:
 *   get:
 *     summary: List all terminal sessions
 *     description: Retrieve all terminal sessions for the authenticated user
 *     tags: [Terminal]
 *     security:
 *       - JwtAuth: []
 *     responses:
 *       200:
 *         description: List of terminal sessions
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                   terminal_cookie:
 *                     type: string
 *                   pid:
 *                     type: integer
 *                   status:
 *                     type: string
 *                     enum: [connecting, active, closed, failed]
 *                   created_at:
 *                     type: string
 *                     format: date-time
 *                   last_activity:
 *                     type: string
 *                     format: date-time
 *       401:
 *         description: Authentication required
 *       500:
 *         description: Failed to list sessions
 */
router.get('/sessions', requireAuthentication, async (req, res) => {
  try {
    logger.debug(t('logs.listingTerminalSessions'), {
      user: req.user?.email || req.user?.username,
    });
    const TerminalSession = getTerminalSessionModel();
    const sessions = await TerminalSession.findAll({
      order: [['created_at', 'DESC']],
    });
    res.json(sessions);
  } catch (error) {
    logger.error(t('logs.errorListingSessions'), {
      error: error.message,
    });
    res.status(500).json({ error: t('terminal.listSessionsFailed') });
  }
});

/**
 * @swagger
 * /api/terminal/sessions/{sessionId}/stop:
 *   delete:
 *     summary: Stop a terminal session
 *     description: Terminates an active terminal session by killing the PTY process
 *     tags: [Terminal]
 *     security:
 *       - JwtAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: Terminal session ID
 *     responses:
 *       200:
 *         description: Session stopped successfully
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
 *                   example: "Terminal session stopped"
 *       401:
 *         description: Authentication required
 *       500:
 *         description: Failed to stop session
 */
router.delete('/sessions/:sessionId/stop', requireAuthentication, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const ptyProcess = activePtyProcesses.get(sessionId);

    if (ptyProcess) {
      ptyProcess.kill();
      activePtyProcesses.delete(sessionId);
    }

    const TerminalSession = getTerminalSessionModel();
    const session = await TerminalSession.findByPk(sessionId);
    if (session) {
      await session.update({ status: 'closed' });
    }

    res.json({ success: true, message: t('terminal.sessionStopped') });
  } catch (error) {
    logger.error(t('logs.errorStoppingSession'), {
      error: error.message,
      session_id: req.params.sessionId,
    });
    res.status(500).json({ error: t('terminal.stopSessionFailed') });
  }
});

export const getPtyProcess = sessionId => activePtyProcesses.get(sessionId);

export default router;
