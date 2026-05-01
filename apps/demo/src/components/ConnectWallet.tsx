'use client'

import { useTempoAccount } from '@/hooks/useTempoAccount'

export function ConnectWallet() {
  const { address, isConnected, isConnecting, connect, disconnect } = useTempoAccount()

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-sm font-mono text-zinc-400">
          {address.slice(0, 6)}…{address.slice(-4)}
        </span>
        <button
          onClick={() => disconnect()}
          className="text-xs px-3 py-1 rounded border border-zinc-700 hover:bg-zinc-800 transition-colors"
        >
          disconnect
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => connect()}
      disabled={isConnecting}
      className="px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-sm font-medium transition-colors"
    >
      {isConnecting ? 'connecting…' : 'connect wallet'}
    </button>
  )
}
