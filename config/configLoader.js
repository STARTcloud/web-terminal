import fs from 'fs';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';
import configMigrator from './configMigrator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class ConfigLoader {
  constructor() {
    this.config = null;
  }

  load() {
    if (!this.config) {
      try {
        // Run config migration first (if needed)
        const migrationResult = configMigrator.migrate();
        if (!migrationResult.success) {
          console.warn('Config migration failed:', migrationResult.error);
        }

        // Check environment variable first (set by systemd)
        const configFiles = [];

        if (process.env.CONFIG_PATH) {
          configFiles.push(process.env.CONFIG_PATH);
        }

        // Then check local files in priority order
        configFiles.push(join(__dirname, '../dev.config.yaml'), join(__dirname, '../config.yaml'));

        let configContent = null;
        let loadedFile = null;

        for (const configFile of configFiles) {
          try {
            configContent = fs.readFileSync(configFile, 'utf8');
            loadedFile = configFile;
            break;
          } catch {
            // Continue to next file
          }
        }

        if (!configContent) {
          throw new Error('No configuration file found. Expected dev.config.yaml, config.yaml');
        }

        this.config = yaml.load(configContent);
        console.log(`Configuration loaded from: ${basename(loadedFile)}`);
      } catch (error) {
        throw new Error(`Failed to load configuration: ${error.message}`);
      }
    }
    return this.config;
  }

  getConfig() {
    if (!this.config) {
      throw new Error('Config not loaded. Call load() first.');
    }
    return this.config;
  }

  getAuthUsers() {
    return this.getConfig().authentication?.local?.users || [];
  }

  getSSLConfig() {
    return this.getConfig().ssl;
  }

  getServerConfig() {
    return (
      this.getConfig().server || {
        domain: 'localhost',
        port: 443,
        show_root_index: false,
      }
    );
  }

  getSwaggerConfig() {
    return (
      this.getConfig().swagger || {
        allow_full_key_retrieval: false,
        allow_temp_key_generation: true,
        temp_key_expiration_hours: 1,
      }
    );
  }

  getDatabaseConfig() {
    return (
      this.getConfig().database || {
        dialect: 'sqlite',
        storage: './file-metadata.db',
        logging: false,
      }
    );
  }

  getAuthenticationConfig() {
    return (
      this.getConfig().authentication || {
        jwt_secret: 'your-jwt-secret-key-change-this',
        jwt_expiration: '24h',
        oidc_providers: {},
        oidc_global_hidden: false,
        basic_auth_hidden: false,
        permission_strategy: 'domain_based',
        domain_mappings: {
          downloads: ['*'],
          uploads: [],
        },
        claims_mappings: {
          downloads: [],
          uploads: [],
        },
      }
    );
  }

  getRateLimitConfig() {
    return (
      this.getConfig().rate_limiting || {
        window_minutes: 10,
        max_requests: 100,
        message: 'Too many requests from this IP, please try again later.',
        skip_successful_requests: false,
        skip_failed_requests: false,
      }
    );
  }

  getLoggingConfig() {
    return (
      this.getConfig().logging || {
        log_directory: '/var/log/web-terminal',
        log_level: 'info',
        max_file_size_mb: 10,
        max_files: 5,
        enable_rotation: true,
        enable_compression: true,
        compression_age_days: 7,
      }
    );
  }

  getCorsConfig() {
    const serverConfig = this.getServerConfig();
    return (
      serverConfig.cors || {
        whitelist: [],
        allow_origin: false,
        preflight_continue: false,
        credentials: false,
      }
    );
  }

  getSecurityConfig() {
    return (
      this.getConfig().security || {
        content_security_policy: {
          enabled: true,
          default_src: ["'self'"],
          script_src: ["'self'", "'unsafe-inline'", "'unsafe-eval'", 'https://cdn.jsdelivr.net'],
          style_src: ["'self'", "'unsafe-inline'"],
          font_src: ["'self'", 'data:'],
          img_src: ["'self'", 'data:', 'blob:', 'https://startcloud.com'],
          connect_src: ["'self'", 'wss:'],
          object_src: ["'none'"],
          media_src: ["'self'"],
          frame_src: ["'self'"],
          child_src: ["'self'"],
          worker_src: ["'self'", 'blob:'],
          manifest_src: ["'self'"],
        },
        hsts: {
          enabled: true,
          max_age: 31536000,
          include_subdomains: true,
          preload: true,
        },
        headers: {
          x_content_type_nosniff: true,
          x_frame_options: 'SAMEORIGIN',
          x_xss_protection: true,
          referrer_policy: 'strict-origin-when-cross-origin',
          cross_origin_embedder_policy: false,
        },
      }
    );
  }

  getI18nConfig() {
    return (
      this.getConfig().internationalization || {
        default_language: 'en',
        supported_languages: [], // Auto-detected from translation files
        fallback_language: 'en',
        auto_detect: true,
        force_language: null,
      }
    );
  }

  getPackageInfo() {
    try {
      const packageContent = fs.readFileSync(join(__dirname, '../package.json'), 'utf8');
      const packageData = JSON.parse(packageContent);
      return {
        name: packageData.name,
        version: packageData.version,
        description: packageData.description,
      };
    } catch (error) {
      console.warn('Failed to read package.json, using defaults:', error.message);
      return {
        name: 'Web-Terminal',
        version: '1.0.0',
        description: 'Web-Terminal Application',
      };
    }
  }
}

export default new ConfigLoader();
