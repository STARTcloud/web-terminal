import fs from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';
import jsonMerger from 'json-merger';
import { randomBytes } from 'crypto';
import { t } from './i18n.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Helper function for basename (using function expression to satisfy linting)
const getBasename = function (path) {
  return path.split(/[\\/]/).pop();
};

class ConfigMigrator {
  constructor() {
    this.templatePath = join(__dirname, '../packaging/config/production-config.yaml');
    this.userConfigPath = process.env.CONFIG_PATH || '/etc/web-terminal/config.yaml';
    this.packagePath = join(__dirname, '../package.json');

    this.devConfigPath = join(__dirname, '../dev.config.yaml');
    this.isDevMode = fs.existsSync(this.devConfigPath);
  }

  /**
   * Check if migration is needed by comparing versions
   */
  isMigrationNeeded() {
    try {
      if (this.isDevMode) {
        return { needed: false, reason: 'dev_mode', appVersion: 'dev' };
      }

      // Get current app version
      const packageData = JSON.parse(fs.readFileSync(this.packagePath, 'utf8'));
      const appVersion = packageData.version;

      // Check if user config exists
      if (!fs.existsSync(this.userConfigPath)) {
        return { needed: true, reason: 'fresh_install', appVersion };
      }

      // Get current config version
      const userConfig = yaml.load(fs.readFileSync(this.userConfigPath, 'utf8'));
      const configVersion = userConfig?.server?.config_version;

      const needed = appVersion !== configVersion;
      return {
        needed,
        reason: needed ? 'version_mismatch' : 'up_to_date',
        appVersion,
        configVersion,
      };
    } catch (error) {
      // Use fallback logging since logger might not be initialized yet
      console.warn(t('config.migrationCheckFailed'), error.message);
      return { needed: false, reason: 'error', error: error.message };
    }
  }

  /**
   * Run the config migration
   */
  migrate() {
    const migrationCheck = this.isMigrationNeeded();

    if (!migrationCheck.needed) {
      console.log(t('config.migrationStatus', { reason: migrationCheck.reason }));
      return { success: true, action: 'none', reason: migrationCheck.reason };
    }

    console.log(t('config.migrationNeeded', { reason: migrationCheck.reason }));
    console.log(
      t('config.versionInfo', {
        appVersion: migrationCheck.appVersion,
        configVersion: migrationCheck.configVersion || 'none',
      })
    );

    try {
      // Create backup of existing config
      if (fs.existsSync(this.userConfigPath)) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = `${this.userConfigPath}.backup.${timestamp}`;
        fs.copyFileSync(this.userConfigPath, backupPath);
        console.log(t('config.backupCreated', { path: backupPath }));
      }

      // Handle fresh install
      if (migrationCheck.reason === 'fresh_install') {
        return this.processFreshInstall();
      }

      // Handle migration - merge template with user config
      const result = this.mergeConfigs();
      console.log(t('config.migrationCompleted'));
      return { success: true, action: 'migrated', ...result };
    } catch (error) {
      console.error(t('config.migrationFailed', { message: error.message }));

      // Attempt to restore backup
      const backupFiles = fs
        .readdirSync(dirname(this.userConfigPath))
        .filter(file => file.startsWith(`${getBasename(this.userConfigPath)}.backup.`))
        .sort()
        .reverse();

      if (backupFiles.length > 0) {
        const latestBackup = join(dirname(this.userConfigPath), backupFiles[0]);
        try {
          fs.copyFileSync(latestBackup, this.userConfigPath);
          console.log(t('config.backupRestored', { path: latestBackup }));
        } catch (restoreError) {
          console.error(t('config.backupRestoreFailed', { message: restoreError.message }));
        }
      }

      return { success: false, action: 'failed', error: error.message };
    }
  }

  /**
   * Merge template with user config using json-merger
   */
  mergeConfigs() {
    try {
      // Use json-merger to merge template with user config
      // Template provides structure and operations, user config provides customizations
      const merged = jsonMerger.mergeFiles([this.templatePath, this.userConfigPath]);

      // Handle JWT secret generation/preservation
      this.handleJWTSecret(merged);

      // Handle config version update (json-merger doesn't process $import)
      this.updateConfigVersion(merged);

      // Write merged result back to user config
      this.ensureConfigDirectory();
      fs.writeFileSync(
        this.userConfigPath,
        yaml.dump(merged, {
          defaultFlowStyle: false,
          lineWidth: -1,
        })
      );

      console.log(t('config.mergedTemplate', { path: this.userConfigPath }));
      return { merged: true };
    } catch (error) {
      throw new Error(t('config.mergeFailed', { message: error.message }));
    }
  }

  /**
   * Update config version to match app version
   */
  updateConfigVersion(config) {
    try {
      const packageData = JSON.parse(fs.readFileSync(this.packagePath, 'utf8'));
      const appVersion = packageData.version;

      if (!config.server) {
        config.server = {};
      }

      config.server.config_version = appVersion;
      console.log(t('config.versionUpdated', { version: appVersion }));
    } catch (error) {
      console.warn(t('config.versionUpdateFailed', { message: error.message }));
    }
  }

  /**
   * Handle JWT secret generation and injection
   */
  handleJWTSecret(config) {
    // Get the template JWT secret to compare against
    const templateConfig = yaml.load(fs.readFileSync(this.templatePath, 'utf8'));
    const templateJwtSecret = templateConfig?.authentication?.jwt_secret;

    const userJwtSecret = config?.authentication?.jwt_secret;

    // Check if JWT secret needs to be generated
    const needsGeneration =
      !userJwtSecret ||
      userJwtSecret === '__JWT_SECRET_FROM_FILE__' ||
      userJwtSecret.includes('change-this') ||
      userJwtSecret.includes('example') ||
      (templateJwtSecret && userJwtSecret === templateJwtSecret);

    if (needsGeneration) {
      // Generate new JWT secret
      const jwtSecret = randomBytes(32).toString('hex');
      config.authentication.jwt_secret = jwtSecret;
      console.log(t('config.jwtSecretGenerated'));

      // Also save to file for postinst compatibility (if needed by other scripts)
      const jwtSecretPath = join(dirname(this.userConfigPath), '.jwt-secret');
      try {
        fs.writeFileSync(jwtSecretPath, jwtSecret);
        console.log(t('config.jwtSecretSaved', { path: jwtSecretPath }));
      } catch (error) {
        console.warn(t('config.jwtSecretSaveFailed', { message: error.message }));
      }
    } else {
      console.log(t('config.jwtSecretExisting'));
    }
  }

  /**
   * Process fresh install config
   */
  processFreshInstall() {
    this.ensureConfigDirectory();

    // Process template through json-merger to resolve $replace operations
    const processed = jsonMerger.mergeObject(yaml.load(fs.readFileSync(this.templatePath, 'utf8')));

    // Handle JWT secret for fresh install
    this.handleJWTSecret(processed);

    // Write processed template to user config
    fs.writeFileSync(
      this.userConfigPath,
      yaml.dump(processed, {
        defaultFlowStyle: false,
        lineWidth: -1,
      })
    );

    console.log(t('config.freshInstallProcessed', { path: this.userConfigPath }));
    return { success: true, action: 'fresh_install' };
  }

  /**
   * Ensure the config directory exists
   */
  ensureConfigDirectory() {
    const configDir = dirname(this.userConfigPath);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
      console.log(t('config.directoryCreated', { dir: configDir }));
    }
  }
}

export default new ConfigMigrator();
