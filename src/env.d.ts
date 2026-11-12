/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Optional: a GoatCounter address where this copy of Chalet counts its own visits */
  readonly VITE_GOATCOUNTER?: string
}

interface Window {
  goatcounter?: { path?: string; title?: string }
}
