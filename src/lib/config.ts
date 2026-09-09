/**
 * Application configuration and environment utilities
 */

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
