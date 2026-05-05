'use client'

import { MppStore } from '@/components/MppStore'
import { ConnectWallet } from '@/components/ConnectWallet'
import { useTempoAccount } from '@/hooks/useTempoAccount'

export default function StorePage() {
  const { isConnected } = useTempoAccount()

  return (
    <main className="max-w-2xl mx-auto px-4 py-12 space-y-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight mb-1">MPP Store</h1>
        <p className="text-sm text-zinc-400">
          Pay-per-view content gated by MPP. Payments route through virtual addresses → SplitForwarder → recipients.
        </p>
      </div>

      <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
        <a href="/" className="text-xs text-zinc-500 hover:text-zinc-300">← back to forwarder</a>
        <ConnectWallet />
      </div>

      {!isConnected ? (
        <div className="text-center py-12 text-zinc-500 text-sm">
          Connect your wallet to purchase content.
        </div>
      ) : (
        <MppStore />
      )}
    </main>
  )
}
