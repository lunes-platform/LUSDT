/// <reference types="vite/client" />

declare interface ImportMetaEnv {
  readonly VITE_BRIDGE_API_URL?: string
  readonly VITE_USE_LOCAL_NODE?: string
  readonly VITE_LOCAL_LUSDT_ADDRESS?: string
  readonly VITE_LOCAL_TAX_MANAGER_ADDRESS?: string
}

declare interface ImportMeta {
  readonly env: ImportMetaEnv
}
