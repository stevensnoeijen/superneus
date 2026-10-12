/// <reference types="vite/client" />

/** Content hash of the build (see sourceVersion() in vite.config.js). */
declare const __APP_VERSION__: string;
/** Short git commit of the build, shown as the version label (see gitVersion() in vite.config.js). */
declare const __GIT_SHA__: string;

interface ImportMetaEnv {
  /** Sentry DSN (public); see src/monitoring/sentry.ts. */
  readonly VITE_SENTRY_DSN?: string;
}
