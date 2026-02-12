// Polyfills para compatibilidade com bibliotecas Node.js no navegador
import { Buffer } from 'buffer'

// Definir globalmente no navegador
if (typeof window !== 'undefined') {
  // @ts-ignore
  window.Buffer = Buffer
  // @ts-ignore
  window.global = window
  // @ts-ignore
  window.process = {
    env: {},
    nextTick: (fn: Function) => setTimeout(fn, 0),
    version: '',
    platform: 'browser'
  } as any
}

// Definir globalmente
// @ts-ignore
globalThis.Buffer = Buffer
// @ts-ignore
globalThis.global = globalThis

// Exportar para uso em outros módulos
export { Buffer }