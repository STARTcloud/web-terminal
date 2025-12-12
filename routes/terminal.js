import express from 'express';
import os from 'os';
import { spawn } from 'node-pty';
import { Op } from 'sequelize';
import { getTerminalSessionModel } from '../models/TerminalSession.js';
import { logger } from '../config/logger.js';
import { requireAuthentication } from '../middleware/auth.middleware.js';

const router = express.Router();

const shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash';
const SESSION_TIMEOUT_MINUTES = 30;

const activePtyProcesses = new Map();

const isSessionHealthy = async sessionId => {
  try {
    const ptyProcess = activePtyProcesses.get(sessionId);
    if (!ptyProcess) {
      return false;
    }

    try {
      process.kill(ptyProcess.pid, 0);
      return true;
    } catch (error) {
      activePtyProcesses.delete(sessionId);
      return false;
    }
  } catch (error) {
    logger.error('Error checking terminal session health', {
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

  logger.debug('Terminal session record created', {
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

    logger.info('PTY process spawned successfully', {
      session_id: session.id,
      terminal_cookie: session.terminal_cookie,
      pid: ptyProcess.pid,
    });

    ptyProcess.on('exit', (code, signal) => {
      logger.info('PTY process exited', {
        session_id: session.id,
        terminal_cookie: session.terminal_cookie,
        exit_code: code,
        signal,
      });
      activePtyProcesses.delete(session.id);
      session.update({ status: 'closed' });
    });
  } catch (error) {
    logger.error('Failed to spawn PTY process', {
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

    let cleanedCount = 0;
    for (const session of inactiveSessions) {
      const ptyProcess = activePtyProcesses.get(session.id);
      if (ptyProcess) {
        ptyProcess.kill();
        activePtyProcesses.delete(session.id);
      }

      await session.update({ status: 'closed' });
      cleanedCount++;
    }

    if (cleanedCount > 0) {
      logger.info('Terminal cleanup completed', {
        cleaned_sessions: cleanedCount,
        timeout_minutes: SESSION_TIMEOUT_MINUTES,
      });
    }

    return cleanedCount;
  } catch (error) {
    logger.error('Error during terminal session cleanup', {
      error: error.message,
      timeout_minutes: SESSION_TIMEOUT_MINUTES,
    });
    return 0;
  }
};

setInterval(cleanupInactiveSessions, 10 * 60 * 1000);

router.post('/start', requireAuthentication, async (req, res) => {
  try {
    const { terminal_cookie } = req.body;

    if (!terminal_cookie) {
      return res.status(400).json({
        success: false,
        error: 'terminal_cookie is required',
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
      const isHealthy = await isSessionHealthy(existingSession.id);

      if (isHealthy) {
        await existingSession.update({
          last_activity: new Date(),
          last_accessed: new Date(),
        });

        logger.info('Terminal session reused', {
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
      logger.debug('Cleaned up unhealthy terminal session', {
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
        logger.warn('Terminal session collision resolved', {
          terminal_cookie,
        });
      } else {
        throw error;
      }
    }

    spawnPtyProcessAsync(session).catch(error => {
      logger.error('Async PTY spawn failed', {
        session_id: session.id,
        terminal_cookie,
        error: error.message,
      });
    });

    res.json({
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
    logger.error('Terminal session start failed', {
      terminal_cookie: req.body.terminal_cookie,
      error: error.message,
    });
    res.status(500).json({
      success: false,
      error: 'Failed to start terminal session',
    });
  }
});

router.get('/sessions', requireAuthentication, async (req, res) => {
  try {
    const TerminalSession = getTerminalSessionModel();
    const sessions = await TerminalSession.findAll({
      order: [['created_at', 'DESC']],
    });
    res.json(sessions);
  } catch (error) {
    logger.error('Error listing terminal sessions', {
      error: error.message,
    });
    res.status(500).json({ error: 'Failed to list terminal sessions' });
  }
});

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

    res.json({ success: true, message: 'Terminal session stopped.' });
  } catch (error) {
    logger.error('Error stopping terminal session', {
      error: error.message,
      session_id: req.params.sessionId,
    });
    res.status(500).json({ error: 'Failed to stop terminal session' });
  }
});

export const getPtyProcess = sessionId => activePtyProcesses.get(sessionId);

export default router;
