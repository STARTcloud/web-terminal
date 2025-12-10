import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { NodePackageImporter } from "sass";
import fs from "fs";
import YAML from "yaml";
import pkg from "../package.json" with { type: "json" };

// Load configuration from YAML file
// For vite.config.js, we need to handle the config path manually since we're in web/ directory
function loadViteConfig() {
  // Check environment variable first (set by systemd)
  if (process.env.CONFIG_PATH) {
    const configPath = process.env.CONFIG_PATH.startsWith("/")
      ? process.env.CONFIG_PATH
      : `../${process.env.CONFIG_PATH}`;
    return YAML.parse(fs.readFileSync(configPath, "utf8"));
  }

  // Fallback to local config for development
  const localConfigPath = "../config.yaml";
  if (fs.existsSync(localConfigPath)) {
    return YAML.parse(fs.readFileSync(localConfigPath, "utf8"));
  }

  // Final fallback: return default configuration for build
  return {
    frontend: {
      port: 3000,
    },
    server: {
      hostname: "localhost",
      port: 3443,
    },
  };
}

const config = loadViteConfig();

export default defineConfig({
  define: {
    // Define global constants that get replaced at build time from root package.json
    __APP_VERSION__: JSON.stringify(pkg.version),
    __APP_NAME__: JSON.stringify(pkg.name),
  },
  css: {
    preprocessorOptions: {
      scss: {
        api: "modern",
        importers: [new NodePackageImporter()],
      },
    },
  },
  plugins: [react()],
  base: "/",
  publicDir: "public",
  server: {
    port: config.frontend?.port?.value || 3000,
    host: "0.0.0.0",
    https: false, // Disable HTTPS for dev server during build
    hmr: {
      port: config.frontend?.port?.value || 3000,
      host: config.server?.hostname?.value || "localhost",
    },
    proxy: {
      "/api": {
        target: `https://${config.server?.hostname?.value || "localhost"}:8443`,
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    sourcemap: false,
    chunkSizeWarningLimit: 500, // Keep strict 500KB limit for all
    commonjsOptions: {
      defaultIsModuleExports: true,
    },
    rollupOptions: {
      external: ["rollup"],
      output: {
        entryFileNames: `assets/[name].js`,
        chunkFileNames: (chunkInfo) => {
          // Name dynamic import chunks based on their modules
          const facadeModuleId = chunkInfo.facadeModuleId;
          if (facadeModuleId && facadeModuleId.includes("swagger-ui-react")) {
            return "assets/swagger.js";
          }

          // Check if any modules in the chunk are swagger-related
          const moduleIds = Object.keys(chunkInfo.modules || {});
          if (moduleIds.some((id) => id.includes("swagger-ui-react"))) {
            return "assets/swagger.js";
          }

          return "assets/[name].js";
        },
        assetFileNames: (assetInfo) => {
          if (
            assetInfo.name === "favicon.ico" ||
            assetInfo.name === "dark-favicon.ico"
          ) {
            return "[name][extname]";
          }
          return `assets/[name].[ext]`;
        },
        manualChunks: {
          // Core React (essential)
          vendor: ["react", "react-dom", "react-router-dom"],

          // UI frameworks
          ui: ["bootstrap", "react-bootstrap"],

          // HTTP and utilities
          utils: ["axios", "jwt-decode", "prop-types"],

          // Web APIs (safe to separate)
          webapis: ["web-vitals"],

          // Swagger dependencies (split from main swagger chunk)
          swaggerdeps: ["js-yaml", "yaml", "@swagger-api/apidom-core"],
        },
      },
      onwarn: (warning, warn) => {
        // Smart warning suppression: only for swagger-related large chunks
        if (
          warning.message &&
          warning.message.includes("Some chunks are larger than 500 kB")
        ) {
          // Check if warning contains swagger file references
          if (
            warning.message.includes("swagger") ||
            warning.chunkNames?.some((name) => name.includes("swagger"))
          ) {
            console.log(
              "📦 [Bundle] Suppressing Swagger UI size warning - loads on-demand only"
            );
            return;
          }
        }

        // All other warnings pass through (including other large chunks)
        warn(warning);
      },
    },
  },
  optimizeDeps: {
    include: [
      // libraries that need special handling
    ],
    exclude: ["rollup"],
  },
});
