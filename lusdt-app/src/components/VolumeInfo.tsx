import { useState, useEffect } from 'react'
import { useLunesContract } from '../hooks/useLunesContract'
import { TrendingUp, Info, Activity } from 'lucide-react'
import { cn } from '../utils/cn'

export function VolumeInfo() {
  const { getMonthlyVolume } = useLunesContract()
  const [volume, setVolume] = useState('0')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const fetchVolume = async () => {
      setLoading(true)
      try {
        const vol = await getMonthlyVolume()
        setVolume(vol)
      } catch (error) {
        console.error('Erro ao buscar volume:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchVolume()
  }, [getMonthlyVolume])

  const volumeUsd = parseFloat(volume) / 1000000 // Converter para USD

  const getTier = () => {
    if (volumeUsd <= 10000) {
      return { name: 'STANDARD', fee: '0.6%', progress: (volumeUsd / 10000) * 100, level: 1 }
    } else if (volumeUsd <= 100000) {
      return { name: 'PREMIUM', fee: '0.5%', progress: ((volumeUsd - 10000) / 90000) * 100, level: 2 }
    } else {
      return { name: 'VIP', fee: '0.3%', progress: 100, level: 3 }
    }
  }

  const tier = getTier()

  return (
    <div className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-sm relative overflow-hidden flex flex-col justify-between">
      <div className="absolute top-0 right-0 p-2 opacity-5">
        <Activity size={80} />
      </div>

      <div className="flex flex-col mb-6 relative z-10">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-bold font-mono text-zinc-100 flex items-center gap-2 uppercase tracking-wider">
            <span className="text-green-500">vol_metrics</span>
            <span>// MONTHLY</span>
          </h3>
          <div className="flex items-center space-x-1 text-[10px] font-mono sm:text-xs text-zinc-500 border border-zinc-800 px-2 py-1 rounded-sm">
            <Info size={10} className="text-zinc-500" />
            <span>IMPACTS_FEES</span>
          </div>
        </div>

        {loading ? (
          <div className="animate-pulse flex items-baseline gap-2">
            <div className="h-6 w-24 bg-zinc-800 rounded-sm"></div>
            <div className="h-4 w-12 bg-zinc-800 rounded-sm"></div>
          </div>
        ) : (
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold font-mono text-white tracking-tighter">
              ${volumeUsd.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
            </span>
            <span className="text-xs font-mono text-zinc-500">USD AGGREGATED</span>
          </div>
        )}
      </div>

      <div className="space-y-4 relative z-10">
        {/* Tier Info */}
        <div className="flex justify-between items-center border-t border-zinc-800 pt-4">
          <div className="text-xs font-mono text-zinc-500">CURRENT TIER</div>
          <div className={cn(
            "text-xs font-bold font-mono px-2 py-0.5 rounded-sm border",
            tier.level === 3 ? "bg-green-500/10 text-green-500 border-green-500/50" :
              tier.level === 2 ? "bg-yellow-500/10 text-yellow-500 border-yellow-500/50" :
                "bg-zinc-800 text-zinc-400 border-zinc-700"
          )}>
            [{tier.name}] FEE: {tier.fee}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-[10px] font-mono text-zinc-600">
            <span>$0</span>
            <span>$10K</span>
            <span>$100K+</span>
          </div>
          <div className="relative h-1.5 bg-zinc-800 rounded-sm overflow-hidden">
            {/* Background segments */}
            <div className="absolute inset-0 flex">
              <div className="w-1/3 border-r border-zinc-900 h-full bg-zinc-800/50"></div>
              <div className="w-1/3 border-r border-zinc-900 h-full bg-zinc-800/50"></div>
              <div className="w-1/3 h-full bg-zinc-800/50"></div>
            </div>

            {/* Active Bar */}
            <div
              className={cn(
                "h-full transition-all duration-700 ease-out relative",
                tier.level === 3 ? "bg-green-500" :
                  tier.level === 2 ? "bg-yellow-500" : "bg-zinc-500"
              )}
              style={{ width: `${Math.min(tier.progress, 100)}%` }}
            >
              <div className="absolute right-0 top-0 bottom-0 w-px bg-white/50 shadow-[0_0_10px_white]"></div>
            </div>
          </div>
        </div>

        {/* Next Tier Info */}
        {tier.level < 3 && (
          <div className="mt-2 text-[10px] font-mono text-zinc-500 text-right">
            NEXT_TARGET: <span className="text-zinc-300">{tier.level === 1 ? '$10K' : '$100K'}</span> //
            FEE_DROP: <span className="text-green-500">{tier.level === 1 ? '0.5%' : '0.3%'}</span>
          </div>
        )}
      </div>
    </div>
  )
}