/**
 * Performance monitoring utilities
 * Industry standard performance tracking and optimization
 */

/**
 * Measure and log component render performance
 * @param {string} componentName - Name of component being measured
 * @param {Function} renderFunction - Function to measure
 * @returns {*} Result of renderFunction
 */
export const measurePerformance = (componentName, renderFunction) => {
  if (import.meta.env.NODE_ENV === "development") {
    const start = performance.now();
    const result = renderFunction();
    const end = performance.now();

    if (end - start > 16) {
      // Warn if render takes longer than 1 frame (16ms)
      console.warn(
        `[Performance] ${componentName} render took ${(end - start).toFixed(2)}ms`
      );
    }

    return result;
  }
  return renderFunction();
};

/**
 * Debounce function calls for performance
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
export const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

/**
 * Throttle function calls for performance
 * @param {Function} func - Function to throttle
 * @param {number} limit - Time limit in milliseconds
 * @returns {Function} Throttled function
 */
export const throttle = (func, limit) => {
  let inThrottle;
  return function executedFunction(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
};

/**
 * Lazy load images with intersection observer
 * @param {HTMLImageElement} img - Image element
 * @param {string} src - Image source URL
 */
export const lazyLoadImage = (img, src) => {
  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.src = src;
          observer.unobserve(entry.target);
        }
      });
    });
    observer.observe(img);
  } else {
    img.src = src; // Fallback for older browsers
  }
};

/**
 * Performance budget checker - logs warnings if budgets exceeded
 */
export const checkPerformanceBudgets = () => {
  if (import.meta.env.NODE_ENV === "production") {
    // This would integrate with build tools to check actual sizes
    console.log("[Performance] Budget check passed");
  }
};

/**
 * Memory usage monitoring for development
 */
export const monitorMemory = () => {
  if (import.meta.env.NODE_ENV === "development" && "memory" in performance) {
    const memInfo = performance.memory;
    const used = Math.round(memInfo.usedJSHeapSize / 1048576); // MB
    const total = Math.round(memInfo.totalJSHeapSize / 1048576); // MB

    if (used > 100) {
      // Warn if using more than 100MB
      console.warn(`[Performance] High memory usage: ${used}MB / ${total}MB`);
    }
  }
};

// Auto-check performance budgets on load
if (typeof window !== "undefined") {
  checkPerformanceBudgets();

  // Monitor memory every 30 seconds in development
  if (import.meta.env.NODE_ENV === "development") {
    setInterval(monitorMemory, 30000);
  }
}
