import { Terminal } from 'lucide-react'

export function Footer() {
  return (
    <footer className="bg-zinc-950 border-t border-zinc-800 mt-12 py-8">
      <div className="container mx-auto px-4">
        <div className="flex flex-col items-center justify-center text-zinc-500 space-y-4">
          <div className="flex items-center gap-2 text-zinc-400 font-mono text-xs uppercase tracking-wider">
            <Terminal size={12} className="text-green-500" />
            LUSDT_BRIDGE_PROTOCOL_V1.0
          </div>
          <p className="text-xs font-mono">
            © 2024 LUSDT SYSTEM. SECURE ASSET TRANSFER.
          </p>
          <div className="flex justify-center space-x-6">
            <a href="#" className="text-xs font-mono hover:text-green-500 transition-colors uppercase">[Documentation]</a>
            <a href="#" className="text-xs font-mono hover:text-green-500 transition-colors uppercase">[Support]</a>
            <a href="#" className="text-xs font-mono hover:text-green-500 transition-colors uppercase">[GitHub]</a>
          </div>
        </div>
      </div>
    </footer>
  )
}