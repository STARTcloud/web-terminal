#!/usr/bin/env node

import fs from 'fs';

/**
 * Synchronize version between root package.json and configuration files
 * This ensures all configs and documentation have the same version
 */

const rootPackagePath = './package.json';
const webPackagePath = './web/package.json';
const swaggerConfigPath = './config/swagger.js';
const productionConfigPath = './packaging/config/production-config.yaml';
const releasePleaseManifestPath = './.release-please-manifest.json';

try {
  // Read root package.json (single source of truth)
  const rootPackage = JSON.parse(fs.readFileSync(rootPackagePath, 'utf8'));
  const rootVersion = rootPackage.version;

  // 1. Update web package.json
  if (fs.existsSync(webPackagePath)) {
    const webPackage = JSON.parse(fs.readFileSync(webPackagePath, 'utf8'));
    webPackage.version = rootVersion;
    fs.writeFileSync(webPackagePath, `${JSON.stringify(webPackage, null, 2)}\n`);
  }

  // 2. Update swagger config
  let swaggerConfig = fs.readFileSync(swaggerConfigPath, 'utf8');
  swaggerConfig = swaggerConfig.replace(
    /version:\s*['"`][^'"`]*['"`]/g,
    `version: '${rootVersion}'`
  );
  fs.writeFileSync(swaggerConfigPath, swaggerConfig);

  // 4. Update production config (if exists)
  if (fs.existsSync(productionConfigPath)) {
    let productionConfig = fs.readFileSync(productionConfigPath, 'utf8');
    productionConfig = productionConfig.replace(/version:\s*[^\n]*/g, `version: ${rootVersion}`);
    fs.writeFileSync(productionConfigPath, productionConfig);
  }

  // 5. Update release-please manifest (if exists)
  if (fs.existsSync(releasePleaseManifestPath)) {
    const releasePleaseManifest = JSON.parse(fs.readFileSync(releasePleaseManifestPath, 'utf8'));
    releasePleaseManifest['.'] = rootVersion;
    fs.writeFileSync(
      releasePleaseManifestPath,
      `${JSON.stringify(releasePleaseManifest, null, 2)}\n`
    );
  }

  console.log(`✅ Synchronized versions to ${rootVersion}`);
  console.log(`   - Root: ${rootVersion}`);
  console.log(`   - Web: ${rootVersion}`);
  console.log(`   - Swagger: ${rootVersion}`);
  console.log(`   - Production Config: ${rootVersion}`);
  console.log(`   - Release Please Manifest: ${rootVersion}`);
} catch (error) {
  console.error('❌ Error synchronizing versions:', error.message);
  throw new Error(`Version synchronization failed: ${error.message}`);
}
