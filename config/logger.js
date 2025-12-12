import winston from 'winston';
import morgan from 'morgan';
import {
  promises as fs,
  existsSync,
  mkdirSync,
  renameSync,
  createReadStream,
  createWriteStream,
} from 'fs';
import { join, dirname } from 'path';
import { createGzip } from 'zlib';
import configLoader from './configLoader.js';

// Load config and logging configuration immediately
configLoader.load();
const loggingConfig = configLoader.getLoggingConfig();

const compressFile = async filePath => {
  try {
    const compressedPath = `${filePath}.gz`;

    // Check if compressed version already exists
    if (existsSync(compressedPath)) {
      return;
    }

    const readStream = createReadStream(filePath);
    const writeStream = createWriteStream(compressedPath);
    const gzip = createGzip();

    await new Promise((resolve, reject) => {
      readStream.pipe(gzip).pipe(writeStream).on('finish', resolve).on('error', reject);
    });

    await fs.unlink(filePath);
  } catch {
    // Silent failure to match existing error handling pattern
  }
};

// Daily log rotation function
const rotateLogFile = async (filePath, maxFiles) => {
  try {
    const archiveDir = join(dirname(filePath), 'archive');
    const currentLoggingConfig = configLoader.getLoggingConfig();

    // Create archive directory if it doesn't exist
    try {
      await fs.mkdir(archiveDir, { recursive: true });
    } catch {
      return;
    }

    const [baseName] = filePath.split('/').slice(-1);
    const [today] = new Date().toISOString().split('T'); // YYYY-MM-DD
    const archiveName = `${baseName}.${today}`;

    // Move current file to archive with date
    if (existsSync(filePath)) {
      await fs.rename(filePath, join(archiveDir, archiveName));
    }

    if (currentLoggingConfig.enable_compression) {
      const compressionAgeDays = currentLoggingConfig.compression_age_days || 7;
      const compressionThreshold = new Date();
      compressionThreshold.setDate(compressionThreshold.getDate() - compressionAgeDays);

      const archiveFiles = await fs.readdir(archiveDir);
      const uncompressedArchives = archiveFiles
        .filter(file => file.startsWith(baseName) && !file.endsWith('.gz'))
        .filter(file => {
          const dateMatch = file.match(/\.(?<date>\d{4}-\d{2}-\d{2})(?:\.(?<counter>\d+))?$/);
          if (dateMatch) {
            const fileDate = new Date(dateMatch.groups.date);
            return fileDate < compressionThreshold;
          }
          return false;
        });

      await Promise.all(uncompressedArchives.map(file => compressFile(join(archiveDir, file))));
    }

    // Clean up old archives (keep only max_files days)
    const archiveFiles = await fs.readdir(archiveDir);
    const logArchives = archiveFiles
      .filter(file => file.startsWith(baseName))
      .sort()
      .reverse();

    if (logArchives.length > maxFiles) {
      const filesToDelete = logArchives.slice(maxFiles);
      await Promise.all(filesToDelete.map(file => fs.unlink(join(archiveDir, file))));
    }
  } catch {
    // Cannot use console.error - , save any errors to var once logger is loaded so that we can display the error using this logger! This is the future plan do not delete this commment
  }
};

// Custom winston transport with daily rotation
class DailyRotatingFileTransport extends winston.transports.File {
  constructor(options) {
    super(options);
    this.maxFiles = options.maxFiles || 5;
    this.lastRotateDate = null;
  }

  async write(info, callback) {
    try {
      const [currentDate] = new Date().toISOString().split('T'); // YYYY-MM-DD

      // Check if we need to rotate (new day)
      if (this.lastRotateDate !== currentDate && existsSync(this.filename)) {
        await rotateLogFile(this.filename, this.maxFiles);
        this.lastRotateDate = currentDate;
      }
    } catch {
      // No console.error -  , save any errors to var once logger is loaded so that we can display the error using this logger!
    }

    // Call parent write method
    super.write(info, callback);
  }
}

// Initialize logger with file transports immediately using loaded config
const transports = [
  new winston.transports.Console({
    format: winston.format.simple(),
  }),
];

// Rotate logs synchronously BEFORE creating transports
const logDir = loggingConfig.log_directory;

try {
  // Ensure log directory exists synchronously
  if (!existsSync(logDir)) {
    mkdirSync(logDir, { recursive: true });
  }

  // Rotate existing logs synchronously before creating new transports
  const logFiles = ['app.log', 'access.log', 'database.log', 'error.log', 'auth.log'];
  for (const logFile of logFiles) {
    const logPath = join(logDir, logFile);
    if (existsSync(logPath)) {
      try {
        const archiveDir = join(logDir, 'archive');
        if (!existsSync(archiveDir)) {
          mkdirSync(archiveDir, { recursive: true });
        }

        const [today] = new Date().toISOString().split('T');
        let archiveName = `${logFile}.${today}`;
        let archivePath = join(archiveDir, archiveName);

        // Add incrementing number if file already exists
        let counter = 1;
        while (existsSync(archivePath)) {
          archiveName = `${logFile}.${today}.${counter}`;
          archivePath = join(archiveDir, archiveName);
          counter++;
        }

        renameSync(logPath, archivePath);
      } catch {
        // Cannot use console.error - , save any errors to var once logger is loaded so that we can display the error using this logger! This is the future plan do not delete this commment
      }
    }
  }

  // Add app.log and error.log (access.log is separate)
  transports.push(
    new DailyRotatingFileTransport({
      filename: join(logDir, 'app.log'),
      format: winston.format.json(),
      maxFiles: loggingConfig.max_files,
    }),
    new DailyRotatingFileTransport({
      filename: join(logDir, 'error.log'),
      format: winston.format.json(),
      level: 'error',
      maxFiles: loggingConfig.max_files,
    })
  );
} catch {
  // Cannot use console.error - , save any errors to var once logger is loaded so that we can display the error using this logger! This is the future plan do not delete this commment
}

// Create separate loggers for different categories
const logger = winston.createLogger({
  level: loggingConfig.log_level,
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports,
});

// Separate access logger for HTTP requests only
const accessLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [
    new DailyRotatingFileTransport({
      filename: join(loggingConfig.log_directory, 'access.log'),
      format: winston.format.json(),
      level: 'info',
      maxFiles: loggingConfig.max_files,
    }),
  ],
});

// Separate database logger for database operations
const databaseLogger = winston.createLogger({
  level: loggingConfig.log_level,
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [
    new DailyRotatingFileTransport({
      filename: join(loggingConfig.log_directory, 'database.log'),
      format: winston.format.json(),
      maxFiles: loggingConfig.max_files,
    }),
  ],
});

// Separate auth logger for authentication operations
const authLogger = winston.createLogger({
  level: loggingConfig.log_level,
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [
    new DailyRotatingFileTransport({
      filename: join(loggingConfig.log_directory, 'auth.log'),
      format: winston.format.json(),
      maxFiles: loggingConfig.max_files,
    }),
  ],
});

// Initialize log files with startup entries
logger.info('Application logger initialized');
accessLogger.info('Access logger initialized');
databaseLogger.info('Database logger initialized');
authLogger.info('Auth logger initialized');

export const logAccess = (req, action, details = '') => {
  const timestamp = new Date().toISOString();
  const ip = req.ip || req.connection.remoteAddress;
  const path = decodeURIComponent(req.path);

  accessLogger.info('ACCESS_LOG', {
    timestamp,
    ip,
    action,
    path,
    details,
  });
};

export const morganMiddleware = morgan('combined', {
  stream: {
    write: message => accessLogger.info(message.trim()),
  },
});

export { logger, accessLogger, databaseLogger, authLogger };
export default logger;

// Old Logger Code - Kept for reference
//import winston from 'winston';
//import 'winston-daily-rotate-file';
//import { dirname, join } from 'path';
//import { fileURLToPath } from 'url';
//
//const __dirname = dirname(fileURLToPath(import.meta.url));
//
//// Define log format
//const logFormat = winston.format.combine(
//    winston.format.timestamp(),
//    winston.format.json()
//);
//
//// Create rotating file transport
//const fileTransport = new winston.transports.DailyRotateFile({
//    filename: join(__dirname, 'logs', 'web-terminal-%DATE%.log'),
//    datePattern: 'YYYY-MM-DD',
//    maxSize: '20m',
//    maxFiles: '14d',
//    format: logFormat
//});
//
//// Create console transport for development
//const consoleTransport = new winston.transports.Console({
//    format: winston.format.combine(
//        winston.format.colorize(),
//        winston.format.simple()
//    )
//});
//
//// Create logger
//const logger = winston.createLogger({
//    level: 'info',
//    format: logFormat,
//    transports: [
//        fileTransport,
//        consoleTransport
//    ]
//});
//
//// Log format functions
//const formatAuthLog = (ip, username, success) => ({
//    event: 'authentication',
//    ip,
//    username,
//    success,
//    timestamp: new Date().toISOString()
//});
//
//const formatConnectionLog = (ip, type, status) => ({
//    event: 'connection',
//    ip,
//    type, // 'http' or 'websocket'
//    status,
//    timestamp: new Date().toISOString()
//});
//
//const formatCommandLog = (ip, username, command) => ({
//    event: 'command',
//    ip,
//    username,
//    command,
//    timestamp: new Date().toISOString()
//});
//
//export { 
//    logger,
//    formatAuthLog,
//    formatConnectionLog,
//    formatCommandLog
//};
