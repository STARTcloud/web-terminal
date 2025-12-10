import { promises as fs } from 'fs';
import https from 'https';
import { execSync } from 'child_process';
import { dirname } from 'path';
import logger from '../config/logger.js';

export const generateSSLCertificatesIfNeeded = async sslConfig => {
  if (!sslConfig?.cert || !sslConfig?.key) {
    return false;
  }

  const keyPath = sslConfig.key;
  const certPath = sslConfig.cert;

  try {
    await fs.access(keyPath);
    await fs.access(certPath);
    logger.info('SSL certificates already exist');
    return false;
  } catch {
    // Certificates don't exist, generate them
  }

  try {
    logger.info('Generating SSL certificates...');

    const sslDir = dirname(keyPath);
    await fs.mkdir(sslDir, { recursive: true, mode: 0o700 });

    const opensslCmd = `openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout "${keyPath}" -out "${certPath}" -subj "/C=US/ST=State/L=City/O=FileServer/CN=localhost"`;

    execSync(opensslCmd, { stdio: 'pipe' });

    await fs.chmod(keyPath, 0o600);
    await fs.chmod(certPath, 0o600);

    logger.info('SSL certificates generated successfully');
    return true;
  } catch (error) {
    logger.error('Failed to generate SSL certificates', { error: error.message });
    return false;
  }
};

export const setupHTTPSServer = async (app, sslConfig, port) => {
  if (!sslConfig?.cert || !sslConfig?.key) {
    logger.info('No SSL configuration found');
    return null;
  }

  await generateSSLCertificatesIfNeeded(sslConfig);

  try {
    const privateKey = await fs.readFile(sslConfig.key, 'utf8');
    const certificate = await fs.readFile(sslConfig.cert, 'utf8');

    const credentials = { key: privateKey, cert: certificate };
    const httpsServer = https.createServer(credentials, app);

    httpsServer.listen(port, () => {
      logger.info(`HTTPS Server running at https://localhost:${port}`);
    });

    return httpsServer;
  } catch (error) {
    logger.error('SSL Certificate Error', { error: error.message });
    logger.info('HTTPS server not started due to SSL certificate issues');
    return null;
  }
};
