/**
 * Application configuration and environment utilities
 */

/**
 * Returns the canonical application base URL.
 * - Prioritizes VITE_APP_URL if defined (e.g. in .env or CI/CD).
 * - In production mode, defaults to official production domain: https://www.warevo.online.
 * - In browser development, falls back to window.location.origin.
 */
export function getAppUrl(): string {
  // If running in browser on production domain:
  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;
    if (hostname === "www.warevo.online" || hostname === "warevo.online" || hostname.endsWith("warevo.online")) {
      return "https://www.warevo.online";
    }
  }

  // In production mode, always return the production domain unless explicit non-localhost URL is provided
  if (import.meta.env.PROD || import.meta.env.MODE === "production") {
    const envUrl = import.meta.env.VITE_APP_URL || import.meta.env.NEXT_PUBLIC_APP_URL;
    if (envUrl && typeof envUrl === "string" && !envUrl.includes("localhost") && !envUrl.includes("127.0.0.1")) {
      return envUrl.trim().replace(/\/+$/, "");
    }
    return "https://www.warevo.online";
  }

  // In development mode:
  const envUrl = import.meta.env.VITE_APP_URL || import.meta.env.NEXT_PUBLIC_APP_URL;
  if (envUrl && typeof envUrl === "string" && envUrl.trim()) {
    return envUrl.trim().replace(/\/+$/, "");
  }

  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin.replace(/\/+$/, "");
  }

  return "https://www.warevo.online";
}

export const config = {
  /**
   * Check if the app is running in development mode
   */
  isDevelopment: import.meta.env.DEV || import.meta.env.MODE === 'development',

  /**
   * Check if the app is running in production mode
   */
  isProduction: import.meta.env.PROD || import.meta.env.MODE === 'production',

  /**
   * App environment override (for staging, testing, etc.)
   */
  appEnv: import.meta.env.VITE_APP_ENV || import.meta.env.MODE,

  /**
   * Application base URL
   */
  get appUrl(): string {
    return getAppUrl();
  },

  /**
   * Whether to show demo/development features like role switcher and demo login
   */
  get showDemoFeatures(): boolean {
    return this.isDevelopment || this.appEnv === 'development' || this.appEnv === 'demo';
  },

  /**
   * Supabase configuration
   */
  supabase: {
    url: import.meta.env.VITE_SUPABASE_URL || '',
    anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || ''
  }
};
