/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AUTH_URL: string;
  readonly VITE_TRUSTED_ORIGINS: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
