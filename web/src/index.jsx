import React from "react";
import { createRoot } from "react-dom/client";
import { onCLS, onINP, onFCP, onLCP, onTTFB } from "web-vitals";

import App from "./App";
import "./utils/performance";
import { registerServiceWorker } from "./utils/pwa";
import "bootstrap/dist/css/bootstrap.min.css";
import "./index.css";

// Web Vitals monitoring - industry standard performance tracking
const sendToAnalytics = (metric) => {
  console.log(`[Web Vitals] ${metric.name}: ${metric.value}`);
  // In production, send to your analytics service:
  // analytics.track('web-vital', metric);
};

onCLS(sendToAnalytics);
onINP(sendToAnalytics);
onFCP(sendToAnalytics);
onLCP(sendToAnalytics);
onTTFB(sendToAnalytics);

// PWA setup - register service worker and handle install prompts
window.addEventListener("beforeinstallprompt", (e) => {
  // Prevent automatic install prompt
  e.preventDefault();
  // Store the event for later use
  window.deferredPrompt = e;
  console.log("[PWA] Install prompt available");
});

// Handle PWA installation
window.addEventListener("appinstalled", () => {
  console.log("[PWA] App installed successfully");
  window.deferredPrompt = null;
});

// Register service worker for offline functionality
registerServiceWorker().then((registration) => {
  if (registration) {
    console.log("[PWA] Ready for offline use");
  }
});

const container = document.getElementById("root");
const root = createRoot(container);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
